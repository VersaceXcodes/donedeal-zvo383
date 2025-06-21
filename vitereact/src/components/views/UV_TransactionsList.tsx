import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

interface Transaction {
  uid: string;
  listingUid: string;
  listingTitle: string;
  listingThumbnailUrl: string;
  counterpart: {
    uid: string;
    displayName: string;
    profilePicUrl: string;
  };
  amount: number;
  currency: string;
  status: 'accepted' | 'sold';
  updatedAt: string;
}

interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const UV_TransactionsList: React.FC = () => {
  const token = useAppStore(state => state.auth.token);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filters & pagination from URL (with defaults)
  const typeParam = searchParams.get('type') || 'all';
  const statusParam = searchParams.get('status') || 'sold';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const perPageParam = parseInt(searchParams.get('per_page') || '20', 10);

  // Data fetching via React Query
  const fetchTransactions = async (): Promise<TransactionsResponse> => {
    if (!token) {
      throw new Error('Unauthorized');
    }
    const response = await axios.get<TransactionsResponse>(
      `${API_BASE_URL}/api/users/me/transactions`,
      {
        params: {
          type: typeParam === 'all' ? undefined : typeParam,
          status: statusParam,
          page: pageParam,
          per_page: perPageParam
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  };

  const {
    data,
    isLoading,
    isError,
    error
  } = useQuery<TransactionsResponse, Error>(
    ['transactions', typeParam, statusParam, pageParam, perPageParam],
    fetchTransactions,
    { keepPreviousData: true }
  );

  const transactions = data?.transactions || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / perPageParam);

  // Handlers
  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    params.set('page', '1'); // reset to first page when filters change
    setSearchParams(params);
  };

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    setSearchParams(params);
  };

  const handleRowClick = (listingUid: string) => {
    navigate(`/listings/${listingUid}`);
  };

  return (
    <>
      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-4">My Transactions</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              value={typeParam}
              onChange={e => updateFilters('type', e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            >
              <option value="all">All</option>
              <option value="offer">Offer</option>
              <option value="buy_now">Buy Now</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              value={statusParam}
              onChange={e => updateFilters('status', e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            >
              <option value="sold">Sold</option>
              <option value="accepted">Accepted</option>
            </select>
          </div>
        </div>

        {/* Loading / Error */}
        {isLoading && (
          <div className="text-center py-8">Loading transactions...</div>
        )}
        {isError && (
          <div className="text-center py-8 text-red-600">
            Error: {error?.message}
          </div>
        )}

        {/* Transactions Table */}
        {!isLoading && !isError && transactions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No transactions found.
          </div>
        )}
        {!isLoading && !isError && transactions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Counterparty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map(tx => (
                  <tr
                    key={tx.uid}
                    className="hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleRowClick(tx.listingUid)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap flex items-center space-x-4">
                      <img
                        src={tx.listingThumbnailUrl}
                        alt={tx.listingTitle}
                        className="h-12 w-12 object-cover rounded"
                      />
                      <span className="text-sm font-medium text-gray-900">
                        {tx.listingTitle}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <img
                          src={tx.counterpart.profilePicUrl}
                          alt={tx.counterpart.displayName}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                        <span className="text-sm text-gray-700">
                          {tx.counterpart.displayName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Intl.NumberFormat(undefined, {
                        style: 'currency',
                        currency: tx.currency
                      }).format(tx.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          tx.status === 'sold'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(tx.updatedAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !isError && totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => goToPage(pageParam - 1)}
              disabled={pageParam <= 1}
              className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm text-gray-700">
              Page {pageParam} of {totalPages}
            </span>
            <button
              onClick={() => goToPage(pageParam + 1)}
              disabled={pageParam >= totalPages}
              className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_TransactionsList;