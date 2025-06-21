import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useSearchParams, Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface FavoriteItem {
  uid: string;
  title: string;
  thumbnailUrl: string;
  price: number;
  currency: string;
  isNegotiable: boolean;
  location: string;
  datePosted: string;
}

interface Pagination {
  page: number;
  per_page: number;
  total: number;
}

interface FavoritesResponse {
  favorites: FavoriteItem[];
  pagination: Pagination;
}

const UV_ProfileFavorites: React.FC = () => {
  const token = useAppStore(state => state.auth.token);
  const addToast = useAppStore(state => state.ui.add_toast);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const perPageParam = parseInt(searchParams.get('per_page') || '20', 10);

  // Fetch favorites
  const { data, isLoading, isError, error } = useQuery<FavoritesResponse, Error>({
    queryKey: ['favorites', pageParam, perPageParam],
    enabled: !!token,
    queryFn: async () => {
      const { data } = await axios.get<FavoritesResponse>(
        `${API_BASE_URL}/api/users/me/favorites`,
        {
          params: { page: pageParam, per_page: perPageParam },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      return data;
    },
    keepPreviousData: true
  });

  // Unfavorite mutation
  const unfavoriteMutation = useMutation<void, Error, string>({
    mutationFn: async (uid) => {
      await axios.delete(
        `${API_BASE_URL}/api/listings/${uid}/favorite`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    onMutate: async (uid) => {
      await queryClient.cancelQueries({ queryKey: ['favorites', pageParam, perPageParam] });
      const previous = queryClient.getQueryData<FavoritesResponse>(['favorites', pageParam, perPageParam]);
      if (previous) {
        queryClient.setQueryData<FavoritesResponse>(
          ['favorites', pageParam, perPageParam],
          {
            ...previous,
            favorites: previous.favorites.filter(item => item.uid !== uid),
            pagination: {
              ...previous.pagination,
              total: previous.pagination.total - 1
            }
          }
        );
      }
      return { previous };
    },
    onError: (_err, _uid, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(['favorites', pageParam, perPageParam], context.previous);
      }
      addToast({
        id: `fav-error-${Date.now()}`,
        type: 'error',
        message: 'Could not remove favorite.'
      });
    },
    onSuccess: (_data, uid) => {
      addToast({
        id: `fav-removed-${uid}-${Date.now()}`,
        type: 'success',
        message: 'Removed from favorites.'
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    }
  });

  const total = data?.pagination.total ?? 0;
  const lastPage = Math.ceil(total / perPageParam);

  const changePage = (newPage: number) => {
    const params: Record<string,string> = {};
    params.page = String(newPage);
    params.per_page = String(perPageParam);
    setSearchParams(params);
  };

  return (
    <>
      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-4">My Favorites</h1>

        {isLoading && (
          <div className="text-center py-10">Loading favorites...</div>
        )}

        {isError && (
          <div className="text-center py-10 text-red-600">
            <p>Error: {error.message}</p>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['favorites', pageParam, perPageParam] })}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && data && data.favorites.length === 0 && (
          <div className="text-center py-20">
            <p className="mb-4">You haven&rsquo;t favorited any listings yet.</p>
            <Link
              to="/search"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Browse Listings
            </Link>
          </div>
        )}

        {!isLoading && data && data.favorites.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.favorites.map(item => (
                <div key={item.uid} className="relative bg-white shadow rounded overflow-hidden">
                  <Link to={`/listings/${item.uid}`}>
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-4">
                      <h2 className="font-medium text-lg mb-1">{item.title}</h2>
                      <p className="text-blue-600 font-semibold">
                        {item.currency} {item.price.toFixed(2)}
                        {item.isNegotiable && (
                          <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">Negotiable</span>
                        )}
                      </p>
                      <p className="text-gray-500 text-sm mt-1">{item.location}</p>
                      <p className="text-gray-400 text-xs mt-1">Posted {item.datePosted}</p>
                    </div>
                  </Link>
                  <button
                    onClick={() => unfavoriteMutation.mutate(item.uid)}
                    className="absolute top-2 right-2 p-1 bg-white rounded-full hover:bg-gray-100"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-red-500"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center mt-8">
              <button
                disabled={pageParam <= 1}
                onClick={() => changePage(pageParam - 1)}
                className={`px-4 py-2 rounded ${pageParam > 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
              >
                Previous
              </button>
              <span>
                Page {pageParam} of {lastPage}
              </span>
              <button
                disabled={pageParam >= lastPage}
                onClick={() => changePage(pageParam + 1)}
                className={`px-4 py-2 rounded ${pageParam < lastPage ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default UV_ProfileFavorites;