import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface ListingCard {
  uid: string;
  title: string;
  imageUrl: string;
  price: number;
  currency: string;
  status: string;
  expiresAt: string;
}

interface ListingsResponse {
  listings: ListingCard[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
  };
}

const UV_ProfileListings: React.FC = () => {
  const token = useAppStore(state => state.auth.token);
  const addToast = useAppStore(state => state.add_toast);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Parse URL params
  const searchParams = new URLSearchParams(location.search);
  const statusFilter = searchParams.get('status') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const per_page = parseInt(searchParams.get('per_page') || '20', 10);

  // Fetch listings
  const fetchListings = async (): Promise<ListingsResponse> => {
    if (!token) {
      throw new Error('Unauthorized');
    }
    const params: Record<string, any> = { page, per_page };
    if (statusFilter) params.status = statusFilter;
    const { data } = await axios.get<ListingsResponse>(
      `${API_BASE_URL}/api/users/me/listings`,
      {
        params,
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return data;
  };

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<ListingsResponse, Error>(
    ['profileListings', statusFilter, page, per_page],
    fetchListings,
    { keepPreviousData: true, enabled: !!token }
  );

  const listings = data?.listings || [];
  const total = data?.pagination.total || 0;
  const totalPages = Math.ceil(total / per_page);

  // Delete mutation
  const deleteMutation = useMutation<void, Error, string>(
    async (uid: string) => {
      if (!token) throw new Error('Unauthorized');
      await axios.delete(`${API_BASE_URL}/api/listings/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['profileListings', statusFilter, page, per_page]);
        addToast({ id: `delete-success-${Date.now()}`, type: 'success', message: 'Listing deleted.' });
      },
      onError: (err) => {
        addToast({ id: `delete-error-${Date.now()}`, type: 'error', message: err.message });
      },
    }
  );

  // Mark as sold mutation
  const markSoldMutation = useMutation<void, Error, string>(
    async (uid: string) => {
      if (!token) throw new Error('Unauthorized');
      await axios.post(
        `${API_BASE_URL}/api/listings/${uid}/mark-sold`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['profileListings', statusFilter, page, per_page]);
        addToast({ id: `sold-success-${Date.now()}`, type: 'success', message: 'Listing marked as sold.' });
      },
      onError: (err) => {
        addToast({ id: `sold-error-${Date.now()}`, type: 'error', message: err.message });
      },
    }
  );

  // Handlers
  const handleFilterChange = (newStatus: string) => {
    const params = new URLSearchParams();
    if (newStatus) params.set('status', newStatus);
    params.set('page', '1');
    params.set('per_page', per_page.toString());
    navigate(`${location.pathname}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    const params = new URLSearchParams(location.search);
    params.set('page', newPage.toString());
    params.set('per_page', per_page.toString());
    navigate(`${location.pathname}?${params.toString()}`);
  };

  const handleEdit = (uid: string) => {
    navigate(`/listings/${uid}/edit/step1`);
  };

  const handleDelete = (uid: string) => {
    if (window.confirm('Are you sure you want to delete this listing?')) {
      deleteMutation.mutate(uid);
    }
  };

  const handleMarkSold = (uid: string) => {
    if (window.confirm('Mark this listing as sold?')) {
      markSoldMutation.mutate(uid);
    }
  };

  return (
    <>
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">My Listings</h1>
          <Link
            to="/listings/new/step1"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
          >
            Sell an Item
          </Link>
        </div>

        <div className="mb-4 flex items-center">
          <label htmlFor="statusFilter" className="mr-2 font-medium">
            Status:
          </label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={e => handleFilterChange(e.target.value)}
            className="border border-gray-300 rounded p-2"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="sold">Sold</option>
          </select>
        </div>

        {isLoading && <p>Loading listings...</p>}
        {isError && (
          <p className="text-red-600">Error: {error?.message || 'Failed to load listings.'}</p>
        )}
        {!isLoading && listings.length === 0 && (
          <p className="text-gray-600">No listings found for the selected filter.</p>
        )}

        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {listings.map(listing => (
            <div
              key={listing.uid}
              className="border rounded shadow-sm flex flex-col overflow-hidden"
            >
              <img
                src={listing.imageUrl}
                alt={listing.title}
                className="w-full h-40 object-cover"
              />
              <div className="p-4 flex-1 flex flex-col">
                <h2 className="font-semibold text-lg mb-1">{listing.title}</h2>
                <p className="text-gray-700 mb-2">
                  {listing.currency}
                  {listing.price.toFixed(2)}
                </p>
                <span className="inline-block bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded mb-4">
                  {listing.status}
                </span>
                <div className="mt-auto space-x-2">
                  <button
                    onClick={() => handleEdit(listing.uid)}
                    className="bg-green-500 hover:bg-green-600 text-white text-sm px-3 py-1 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(listing.uid)}
                    className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded"
                  >
                    Delete
                  </button>
                  {listing.status !== 'sold' && (
                    <button
                      onClick={() => handleMarkSold(listing.uid)}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm px-3 py-1 rounded"
                    >
                      Mark as Sold
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center items-center space-x-4">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
            >
              Prev
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_ProfileListings;