import React, { useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

interface Category {
  uid: string;
  name: string;
  description: string;
  parentUid: string | null;
}

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

const UV_CategoryBrowse: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const token = useAppStore(state => state.auth.token);

  const [searchParams, setSearchParams] = useSearchParams();
  const priceMinParam = searchParams.get('price_min');
  const priceMaxParam = searchParams.get('price_max');
  const negotiableParam = searchParams.get('negotiable');
  const conditionParam = searchParams.get('condition');
  const datePostedParam = searchParams.get('date_posted');
  const sortParam = searchParams.get('sort') || 'newest';

  const price_min = priceMinParam !== null ? parseFloat(priceMinParam) : null;
  const price_max = priceMaxParam !== null ? parseFloat(priceMaxParam) : null;
  const negotiable = negotiableParam === 'true' ? true : negotiableParam === 'false' ? false : null;
  const condition = conditionParam || null;
  const date_posted = datePostedParam || null;
  const sort = sortParam;

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value == null || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    // reset pagination when filters/sort change
    params.delete('page');
    setSearchParams(params, { replace: true });
  };

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Fetch category metadata
  const {
    data: category,
    isLoading: isCategoryLoading,
    isError: isCategoryError,
    error: categoryError
  } = useQuery<Category, Error>(
    ['category', categoryId],
    async () => {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const { data } = await axios.get<Category>(
        `${apiBase}/api/categories/${categoryId}`,
        { headers }
      );
      return data;
    },
    { enabled: !!categoryId }
  );

  // Infinite listings fetch
  const perPage = 20;
  const {
    data,
    isLoading: isListingsLoading,
    isError: isListingsError,
    error: listingsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery<ListingCard[], Error>(
    ['categoryListings', categoryId, price_min, price_max, negotiable, condition, date_posted, sort],
    async ({ pageParam = 1 }) => {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const params: Record<string, any> = {
        category_uid: categoryId,
        page: pageParam,
        per_page: perPage
      };
      if (price_min != null) params.price_min = price_min;
      if (price_max != null) params.price_max = price_max;
      if (negotiable != null) params.negotiable = negotiable;
      if (condition) params.condition = condition;
      if (date_posted) params.date_posted = date_posted;
      if (sort) params.sort = sort;
      const { data } = await axios.get<ListingCard[]>(
        `${apiBase}/api/listings`,
        { params, headers }
      );
      return data;
    },
    {
      getNextPageParam: (lastPage) =>
        lastPage.length === perPage ? undefined : undefined // we'll compute below
    }
  );

  // Flatten pages into one array
  const listings = data?.pages.flat() ?? [];

  // Intersection observer for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchNextPage();
      }
    });
    observer.observe(loadMoreRef.current);
    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, fetchNextPage]);

  return (
    <>
      {/* Loading / Error */}
      {(isCategoryLoading || isListingsLoading) && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      {!isCategoryLoading && isCategoryError && (
        <div className="p-4 text-red-600">
          {categoryError?.message || 'Failed to load category.'}
        </div>
      )}
      {!isCategoryLoading && !isCategoryError && (
        <>
          {/* Category Header */}
          <div className="px-4 py-2">
            <h1 className="text-3xl font-semibold">{category?.name}</h1>
            <p className="text-gray-600 mt-1">{category?.description}</p>
          </div>

          <div className="flex flex-col md:flex-row">
            {/* Filters Sidebar */}
            <aside className="hidden md:block md:w-1/4 p-4 space-y-4 bg-white shadow rounded">
              <div>
                <label className="block mb-1 font-medium">Price Range</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={price_min != null ? price_min : ''}
                    onChange={e => {
                      let v = e.target.value === '' ? null : parseFloat(e.target.value);
                      if (v !== null && isNaN(v)) v = null;
                      updateParam('price_min', v != null ? String(v) : null);
                    }}
                    className="w-1/2 border rounded p-1"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={price_max != null ? price_max : ''}
                    onChange={e => {
                      let v = e.target.value === '' ? null : parseFloat(e.target.value);
                      if (v !== null && isNaN(v)) v = null;
                      updateParam('price_max', v != null ? String(v) : null);
                    }}
                    className="w-1/2 border rounded p-1"
                  />
                </div>
              </div>
              <div>
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={negotiable === true}
                    onChange={e =>
                      updateParam('negotiable', e.target.checked ? 'true' : null)
                    }
                    className="h-4 w-4"
                  />
                  <span className="ml-2">Negotiable Only</span>
                </label>
              </div>
              <div>
                <label className="block mb-1 font-medium">Condition</label>
                <select
                  value={condition ?? ''}
                  onChange={e =>
                    updateParam('condition', e.target.value || null)
                  }
                  className="w-full border rounded p-1"
                >
                  <option value="">Any</option>
                  <option value="new">New</option>
                  <option value="like_new">Like New</option>
                  <option value="good">Good</option>
                  <option value="acceptable">Acceptable</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 font-medium">Date Posted</label>
                <select
                  value={date_posted ?? ''}
                  onChange={e =>
                    updateParam('date_posted', e.target.value || null)
                  }
                  className="w-full border rounded p-1"
                >
                  <option value="">Any</option>
                  <option value="24h">Last 24h</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                </select>
              </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 p-4">
              {/* Sort & Count */}
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="font-medium">{listings.length}</span> Listings
                </div>
                <div>
                  <label className="mr-2 font-medium">Sort:</label>
                  <select
                    value={sort}
                    onChange={e => updateParam('sort', e.target.value)}
                    className="border rounded p-1"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="price_asc">Price: Low → High</option>
                    <option value="price_desc">Price: High → Low</option>
                  </select>
                </div>
              </div>

              {/* Listings Grid or No-Results */}
              {isListingsError ? (
                <div className="text-red-600">
                  {listingsError?.message || 'Error loading listings.'}
                </div>
              ) : listings.length === 0 ? (
                <div className="text-center py-20">
                  <p>No listings found. Try adjusting filters or</p>
                  <Link
                    to="/listings/new/step1"
                    className="text-blue-600 underline"
                  >
                    create a listing
                  </Link>
                  .
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {listings.map(item => (
                    <div key={item.uid} className="border rounded overflow-hidden">
                      <Link to={`/listings/${item.uid}`}>
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-full h-40 object-cover"
                        />
                        <div className="p-2">
                          <h2 className="font-semibold">{item.title}</h2>
                          <p className="text-blue-600 font-bold">${item.price}</p>
                          <p className="text-gray-500 text-sm">{item.location}</p>
                          <p className="text-gray-400 text-xs">{item.datePosted}</p>
                        </div>
                      </Link>
                      <div className="p-2 flex justify-between items-center">
                        {item.negotiable && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Negotiable
                          </span>
                        )}
                        <button className="text-red-500">
                          {item.isFavorited ? '♥' : '♡'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Infinite Scroll Sentinel & Loader */}
              <div ref={loadMoreRef} />
              {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default UV_CategoryBrowse;