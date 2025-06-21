import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

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

interface FetchSearchResponse {
  listings: ListingCard[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
  };
}

const UV_SearchResults: React.FC = () => {
  const token = useAppStore(state => state.auth.token);
  const categories = useAppStore(state => state.nav.categories);

  const [searchParams, setSearchParams] = useSearchParams();

  // Helpers to parse params
  const parseNumber = (v: string | null): number | null => {
    if (v === null) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  };
  const parseBoolean = (v: string | null): boolean | null => {
    if (v === 'true') return true;
    if (v === 'false') return false;
    return null;
  };

  // Read URL-driven state
  const query = searchParams.get('query') || '';
  const category_uid = searchParams.get('category_uid') || '';
  const price_min = parseNumber(searchParams.get('price_min'));
  const price_max = parseNumber(searchParams.get('price_max'));
  const negotiable = parseBoolean(searchParams.get('negotiable')) || false;
  const condition = searchParams.get('condition') || '';
  const date_posted = searchParams.get('date_posted') || '';
  const sort = searchParams.get('sort') || 'newest';
  const page = parseNumber(searchParams.get('page')) || 1;
  const perPage = parseNumber(searchParams.get('per_page')) || 20;

  // Controlled inputs
  const [searchInput, setSearchInput] = useState<string>(query);
  const [filterCategory, setFilterCategory] = useState<string>(category_uid);
  const [filterPriceMin, setFilterPriceMin] = useState<number | ''>(price_min ?? '');
  const [filterPriceMax, setFilterPriceMax] = useState<number | ''>(price_max ?? '');
  const [filterNegotiable, setFilterNegotiable] = useState<boolean>(negotiable);
  const [filterCondition, setFilterCondition] = useState<string>(condition);
  const [filterDatePosted, setFilterDatePosted] = useState<string>(date_posted);

  // Keep inputs in sync when URL params change
  useEffect(() => { setSearchInput(query); }, [query]);
  useEffect(() => {
    setFilterCategory(category_uid);
    setFilterPriceMin(price_min ?? '');
    setFilterPriceMax(price_max ?? '');
    setFilterNegotiable(negotiable);
    setFilterCondition(condition);
    setFilterDatePosted(date_posted);
  }, [category_uid, price_min, price_max, negotiable, condition, date_posted]);

  // Fetch search results
  const {
    data: searchData,
    isLoading,
    isError,
    error
  } = useQuery<FetchSearchResponse, Error>(
    ['searchResults', { query, category_uid, price_min, price_max, negotiable, condition, date_posted, sort, page, perPage }],
    async () => {
      const params: Record<string, any> = {
        query: query || undefined,
        category_uid: category_uid || undefined,
        price_min: price_min ?? undefined,
        price_max: price_max ?? undefined,
        negotiable: negotiable || undefined,
        condition: condition || undefined,
        date_posted: date_posted || undefined,
        sort,
        page,
        per_page: perPage
      };
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const { data } = await axios.get<FetchSearchResponse>(
        `${API_BASE_URL}/api/listings`,
        { params, headers }
      );
      return data;
    },
    { keepPreviousData: true }
  );

  // Fetch popular items for no-results suggestion
  const { data: popularData } = useQuery<ListingCard[]>(
    ['popularItems'],
    async () => {
      const { data } = await axios.get<FetchSearchResponse>(
        `${API_BASE_URL}/api/listings`,
        { params: { sort: 'newest', page: 1, per_page: 5 } }
      );
      return data.listings;
    }
  );

  // Handlers
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const np = new URLSearchParams(searchParams.toString());
    if (searchInput) np.set('query', searchInput);
    else np.delete('query');
    np.set('page', '1');
    setSearchParams(np);
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const np = new URLSearchParams(searchParams.toString());
    // category
    if (filterCategory) np.set('category_uid', filterCategory);
    else np.delete('category_uid');
    // price min/max
    if (filterPriceMin !== '') np.set('price_min', String(filterPriceMin));
    else np.delete('price_min');
    if (filterPriceMax !== '') np.set('price_max', String(filterPriceMax));
    else np.delete('price_max');
    // negotiable
    if (filterNegotiable) np.set('negotiable', 'true');
    else np.delete('negotiable');
    // condition
    if (filterCondition) np.set('condition', filterCondition);
    else np.delete('condition');
    // date_posted
    if (filterDatePosted) np.set('date_posted', filterDatePosted);
    else np.delete('date_posted');
    np.set('page', '1');
    setSearchParams(np);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const np = new URLSearchParams(searchParams.toString());
    np.set('sort', e.target.value);
    np.set('page', '1');
    setSearchParams(np);
  };

  const handlePageChange = (newPage: number) => {
    const np = new URLSearchParams(searchParams.toString());
    np.set('page', String(newPage));
    setSearchParams(np);
  };

  const listings = searchData?.listings || [];
  const pagination = searchData?.pagination || { page, perPage, total: 0 };

  const sortOptions = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'distance', label: 'Distance: Nearest' }
  ];

  return (
    <>
      <div className="container mx-auto px-4 py-6">
        {/* Search box */}
        <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search listings..."
            className="flex-1 border rounded px-2 py-1"
          />
          <button type="submit" className="bg-blue-500 text-white px-4 py-1 rounded">
            Search
          </button>
        </form>

        <div className="flex mt-6">
          {/* Filters panel */}
          <div className="w-64 mr-6">
            <h2 className="font-semibold mb-4">Filters</h2>
            <form onSubmit={handleFilterSubmit} className="space-y-4">
              <div>
                <label className="block mb-1">Category</label>
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="w-full border rounded px-2 py-1"
                >
                  <option value="">All</option>
                  {categories.map(cat => (
                    <option key={cat.uid} value={cat.uid}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1">Price Min</label>
                <input
                  type="number"
                  value={filterPriceMin}
                  onChange={e => setFilterPriceMin(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Min"
                  className="w-full border rounded px-2 py-1"
                />
              </div>
              <div>
                <label className="block mb-1">Price Max</label>
                <input
                  type="number"
                  value={filterPriceMax}
                  onChange={e => setFilterPriceMax(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Max"
                  className="w-full border rounded px-2 py-1"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="negotiable"
                  checked={filterNegotiable}
                  onChange={e => setFilterNegotiable(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="negotiable">Negotiable</label>
              </div>
              <div>
                <label className="block mb-1">Condition</label>
                <select
                  value={filterCondition}
                  onChange={e => setFilterCondition(e.target.value)}
                  className="w-full border rounded px-2 py-1"
                >
                  <option value="">All</option>
                  <option value="new">New</option>
                  <option value="like_new">Like New</option>
                  <option value="good">Good</option>
                  <option value="acceptable">Acceptable</option>
                </select>
              </div>
              <div>
                <label className="block mb-1">Date Posted</label>
                <select
                  value={filterDatePosted}
                  onChange={e => setFilterDatePosted(e.target.value)}
                  className="w-full border rounded px-2 py-1"
                >
                  <option value="">Any time</option>
                  <option value="24h">Last 24h</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-500 text-white py-2 rounded"
              >
                Apply Filters
              </button>
            </form>
          </div>

          {/* Results */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-4">
              <div className="text-gray-600">
                {pagination.total} result{pagination.total !== 1 ? 's' : ''} found
              </div>
              <div className="flex items-center">
                <label htmlFor="sort" className="mr-2">Sort by:</label>
                <select
                  id="sort"
                  value={sort}
                  onChange={handleSortChange}
                  className="border rounded px-2 py-1"
                >
                  {sortOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {isLoading && (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900" />
              </div>
            )}

            {isError && (
              <p className="text-red-500">Error loading search results: {error?.message}</p>
            )}

            {!isLoading && !isError && listings.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map(item => (
                  <Link
                    key={item.uid}
                    to={`/listings/${item.uid}`}
                    className="border rounded overflow-hidden hover:shadow-lg"
                  >
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-full h-40 object-cover"
                    />
                    <div className="p-2">
                      <h3 className="font-medium">{item.title}</h3>
                      <p className="text-blue-600 font-semibold">${item.price.toFixed(2)}</p>
                      <p className="text-sm text-gray-500">{item.location}</p>
                      <div className="flex justify-between items-center mt-1 text-sm">
                        {item.negotiable && <span className="text-green-600">Negotiable</span>}
                        <span>{item.isFavorited ? '♥' : '♡'}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {!isLoading && !isError && listings.length === 0 && (
              <div className="text-center py-10">
                <p className="text-xl mb-4">No results found for "{query}".</p>
                {categories.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold mb-2">Browse Categories</h3>
                    <div className="flex justify-center flex-wrap">
                      {categories.map(cat => (
                        <Link
                          key={cat.uid}
                          to={`/categories/${cat.uid}`}
                          className="text-blue-500 underline mx-2 my-1"
                        >
                          {cat.name}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
                {popularData && popularData.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold mt-6 mb-2">Popular Items</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                      {popularData.map(item => (
                        <Link
                          key={item.uid}
                          to={`/listings/${item.uid}`}
                          className="border p-2 rounded hover:shadow"
                        >
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            className="w-full h-24 object-cover mb-1"
                          />
                          <p className="text-sm">{item.title}</p>
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Pagination */}
            {!isLoading && !isError && pagination.total > pagination.perPage && (
              <div className="flex justify-center items-center mt-8">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-4 py-1 border rounded-l disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="px-6 py-1 border-t border-b">
                  Page {pagination.page} of {Math.ceil(pagination.total / pagination.perPage)}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page * pagination.perPage >= pagination.total}
                  className="px-4 py-1 border rounded-r disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_SearchResults;