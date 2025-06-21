import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient
} from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

interface ListingCard {
  uid: string;
  title: string;
  thumbnailUrl: string;
  price: number;
  location: string;
  datePosted: string;
  isFavorited: boolean;
  negotiable: boolean;
}

interface CategoryTree {
  uid: string;
  name: string;
  children: CategoryTree[];
}

const UV_HomeFeed: React.FC = () => {
  const token = useAppStore(state => state.auth.token);
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const queryClient = useQueryClient();
  const ITEMS_PER_PAGE = 10;

  // Fetch featured listings
  const {
    data: featuredListings = [],
    isLoading: isLoadingFeatured,
    isError: isErrorFeatured,
    error: errorFeatured
  } = useQuery<ListingCard[], Error>({
    queryKey: ['featuredListings'],
    queryFn: async () => {
      const res = await axios.get<ListingCard[]>(
        `${baseURL}/api/listings?featured=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    }
  });

  // Fetch quick categories
  const {
    data: quickCategories = [],
    isLoading: isLoadingCategories,
    isError: isErrorCategories,
    error: errorCategories
  } = useQuery<CategoryTree[], Error>({
    queryKey: ['quickCategories'],
    queryFn: async () => {
      const res = await axios.get<CategoryTree[]>(
        `${baseURL}/api/categories?featured=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    }
  });

  // Infinite query for recent listings
  const {
    data: recentPages,
    isLoading: isLoadingRecent,
    isError: isErrorRecent,
    error: errorRecent,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery<ListingCard[], Error>({
    queryKey: ['recentListings'],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await axios.get<ListingCard[]>(
        `${baseURL}/api/listings?sort=newest&page=${pageParam}&per_page=${ITEMS_PER_PAGE}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === ITEMS_PER_PAGE ? allPages.length + 1 : undefined;
    }
  });

  const recentListings = recentPages?.pages.flat() ?? [];

  // Sentinel ref for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => {
      if (loadMoreRef.current) observer.unobserve(loadMoreRef.current);
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Favorite toggle mutation
  const favoriteMutation = useMutation<
    void,
    Error,
    { uid: string; current: boolean },
    {
      previousRecent?: typeof recentPages;
      previousFeatured?: ListingCard[];
    }
  >(
    async ({ uid, current }) => {
      if (current) {
        await axios.delete(`${baseURL}/api/listings/${uid}/favorite`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(
          `${baseURL}/api/listings/${uid}/favorite`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    },
    {
      onMutate: async ({ uid, current }) => {
        await queryClient.cancelQueries(['recentListings']);
        await queryClient.cancelQueries(['featuredListings']);
        const previousRecent = queryClient.getQueryData(['recentListings']);
        const previousFeatured = queryClient.getQueryData<ListingCard[]>([
          'featuredListings'
        ]);

        // Optimistic update recent
        queryClient.setQueryData<any>(['recentListings'], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: ListingCard[]) =>
              page.map(item =>
                item.uid === uid
                  ? { ...item, isFavorited: !current }
                  : item
              )
            )
          };
        });
        // Optimistic update featured
        if (previousFeatured) {
          queryClient.setQueryData<ListingCard[]>(['featuredListings'], [
            ...previousFeatured.map(item =>
              item.uid === uid
                ? { ...item, isFavorited: !current }
                : item
            )
          ]);
        }

        return { previousRecent, previousFeatured };
      },
      onError: (_err, _vars, context) => {
        if (context?.previousRecent) {
          queryClient.setQueryData(['recentListings'], context.previousRecent);
        }
        if (context?.previousFeatured) {
          queryClient.setQueryData<ListingCard[]>(
            ['featuredListings'],
            context.previousFeatured
          );
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries(['recentListings']);
        queryClient.invalidateQueries(['featuredListings']);
      }
    }
  );

  const isLoading =
    isLoadingFeatured || isLoadingCategories || isLoadingRecent;
  const errorMessage =
    (isErrorFeatured && errorFeatured?.message) ||
    (isErrorCategories && errorCategories?.message) ||
    (isErrorRecent && errorRecent?.message) ||
    null;

  return (
    <>
      <div className="container mx-auto p-4">
        {isLoading && (
          <div className="flex justify-center items-center py-10">
            Loading...
          </div>
        )}
        {errorMessage && (
          <div className="text-red-500 text-center py-10">
            {errorMessage}
          </div>
        )}
        {!isLoading && !errorMessage && (
          <>
            {/* Featured Carousel */}
            {featuredListings.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">
                  Featured Listings
                </h2>
                <div className="flex space-x-4 overflow-x-auto pb-2">
                  {featuredListings.map(item => (
                    <div
                      key={item.uid}
                      className="min-w-[300px] relative flex-shrink-0"
                    >
                      <Link to={`/listings/${item.uid}`}>
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <div className="absolute bottom-0 left-0 w-full bg-black bg-opacity-50 text-white p-2 rounded-b-lg">
                          {item.title}
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Categories */}
            {quickCategories.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">
                  Browse Categories
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                  {quickCategories.map(cat => (
                    <Link
                      key={cat.uid}
                      to={`/categories/${cat.uid}`}
                      className="border rounded-lg p-4 text-center hover:shadow-md"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Listings Grid */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">
                New & Recommended
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {recentListings.map(item => (
                  <div key={item.uid} className="relative">
                    {item.negotiable && (
                      <span className="absolute top-2 left-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                        Negotiable
                      </span>
                    )}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        favoriteMutation.mutate({
                          uid: item.uid,
                          current: item.isFavorited
                        });
                      }}
                      className="absolute top-2 right-2 z-10 text-red-500"
                    >
                      {item.isFavorited ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          className="w-6 h-6"
                        >
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 
                            4.42 3 7.5 3c1.74 0 3.41.81 
                            4.5 2.09C13.09 3.81 14.76 3 
                            16.5 3 19.58 3 22 5.42 22 8.5c0 
                            3.78-3.4 6.86-8.55 11.54L12 
                            21.35z" />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          className="w-6 h-6"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4.318 
                              6.318a4.5 4.5 0 010 
                              6.364L12 20.364l7.682-7.682a4.5 
                              4.5 0 00-6.364-6.364L12 
                              7.636l-1.318-1.318a4.5 4.5 
                              0 00-6.364 0z"
                          />
                        </svg>
                      )}
                    </button>
                    <Link to={`/listings/${item.uid}`}>
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <div className="p-2">
                        <h3 className="font-semibold truncate">
                          {item.title}
                        </h3>
                        <p className="text-gray-600">
                          ${item.price.toFixed(2)}
                        </p>
                        <p className="text-gray-500 text-sm">
                          {item.location}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {new Date(item.datePosted).toLocaleDateString()}
                        </p>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
              <div ref={loadMoreRef} className="h-6" />
              {isFetchingNextPage && (
                <div className="flex justify-center py-4">Loading more...</div>
              )}
              {!hasNextPage && (
                <div className="text-center text-gray-500 py-4">
                  No more listings
                </div>
              )}
            </div>

            {/* Footer */}
            <footer className="mt-8 text-center text-gray-500 text-sm">
              © 2025 MarketMate. All rights reserved.
            </footer>
          </>
        )}
      </div>
    </>
  );
};

export default UV_HomeFeed;