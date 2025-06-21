import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

interface ListingSummary {
  uid: string;
  title: string;
  sellerUid: string;
  sellerName: string;
  categoryUid: string;
  categoryName: string;
  status: string;
  created_at: string;
}

interface Pagination {
  page: number;
  per_page: number;
  total: number;
}

interface AdminListingsResponse {
  listings: ListingSummary[];
  pagination: Pagination;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const UV_AdminListingsList: React.FC = () => {
  // global auth
  const token = useAppStore(state => state.auth.token);
  const addToast = useAppStore(state => state.add_toast);

  // URL params
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') ?? '';
  const searchParam = searchParams.get('search') ?? '';
  const pageParam = parseInt(searchParams.get('page') ?? '1', 10);
  const perPageParam = parseInt(searchParams.get('per_page') ?? '20', 10);

  // local filter form state
  const [statusFilter, setStatusFilter] = useState(statusParam);
  const [searchFilter, setSearchFilter] = useState(searchParam);

  useEffect(() => {
    setStatusFilter(statusParam);
  }, [statusParam]);
  useEffect(() => {
    setSearchFilter(searchParam);
  }, [searchParam]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params: Record<string,string> = {};
    if (statusFilter) params.status = statusFilter;
    if (searchFilter) params.search = searchFilter;
    params.page = '1';
    params.per_page = perPageParam.toString();
    setSearchParams(params);
  };

  // compose filters object for query
  const filters = useMemo(() => ({
    status: statusParam || undefined,
    search: searchParam || undefined,
    page: pageParam,
    per_page: perPageParam
  }), [statusParam, searchParam, pageParam, perPageParam]);

  const queryClient = useQueryClient();

  // fetch listings
  const {
    data,
    isLoading,
    isError,
    error
  } = useQuery<AdminListingsResponse, Error>(
    ['admin_listings', filters],
    async () => {
      const resp = await axios.get<AdminListingsResponse>(
        `${API_BASE}/api/admin/listings`,
        {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
          params: filters
        }
      );
      return resp.data;
    },
    { keepPreviousData: true }
  );

  const listings = data?.listings ?? [];
  const pagination = data?.pagination ?? { page: 1, per_page: perPageParam, total: 0 };
  const totalPages = Math.ceil(pagination.total / pagination.per_page);

  // selection state
  const [selectedListingIds, setSelectedListingIds] = useState<string[]>([]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedListingIds(listings.map(l => l.uid));
    } else {
      setSelectedListingIds([]);
    }
  };
  const handleSelectOne = (uid: string, checked: boolean) => {
    setSelectedListingIds(prev =>
      checked
        ? [...prev, uid]
        : prev.filter(id => id !== uid)
    );
  };

  // individual mutations
  const approveMutation = useMutation<void, Error, string>(
    async (uid) => {
      await axios.put(
        `${API_BASE}/api/admin/listings/${uid}/status`,
        { action: 'approve' },
        { headers: { Authorization: token ? `Bearer ${token}` : '' } }
      );
    },
    {
      onSuccess: (_, uid) => {
        addToast({ id: `toast_${Date.now()}`, type: 'success', message: `Listing ${uid} approved.` });
        queryClient.invalidateQueries(['admin_listings']);
      },
      onError: (err) => {
        addToast({ id: `toast_${Date.now()}`, type: 'error', message: err.message });
      }
    }
  );
  const removeMutation = useMutation<void, Error, string>(
    async (uid) => {
      await axios.put(
        `${API_BASE}/api/admin/listings/${uid}/status`,
        { action: 'remove' },
        { headers: { Authorization: token ? `Bearer ${token}` : '' } }
      );
    },
    {
      onSuccess: (_, uid) => {
        addToast({ id: `toast_${Date.now()}`, type: 'success', message: `Listing ${uid} removed.` });
        queryClient.invalidateQueries(['admin_listings']);
      },
      onError: (err) => {
        addToast({ id: `toast_${Date.now()}`, type: 'error', message: err.message });
      }
    }
  );

  // reject modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTargetIds, setRejectTargetIds] = useState<string[]>([]);
  const [isRejectSubmitting, setIsRejectSubmitting] = useState(false);

  const openRejectModal = (uids: string[]) => {
    setRejectTargetIds(uids);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };
  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) return;
    setIsRejectSubmitting(true);
    try {
      await Promise.all(
        rejectTargetIds.map(uid =>
          axios.put(
            `${API_BASE}/api/admin/listings/${uid}/status`,
            { action: 'reject', reason: rejectReason },
            { headers: { Authorization: token ? `Bearer ${token}` : '' } }
          )
        )
      );
      addToast({
        id: `toast_${Date.now()}`,
        type: 'success',
        message: `Rejected ${rejectTargetIds.length} listing(s).`
      });
      setSelectedListingIds(prev =>
        prev.filter(id => !rejectTargetIds.includes(id))
      );
      queryClient.invalidateQueries(['admin_listings']);
      setIsRejectModalOpen(false);
    } catch (err: any) {
      addToast({ id: `toast_${Date.now()}`, type: 'error', message: err.message });
    } finally {
      setIsRejectSubmitting(false);
    }
  };

  // bulk actions loading
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const performBulkAction = async (action: 'approve' | 'remove') => {
    if (!selectedListingIds.length) return;
    setIsBulkLoading(true);
    try {
      await Promise.all(
        selectedListingIds.map(uid =>
          axios.put(
            `${API_BASE}/api/admin/listings/${uid}/status`,
            { action },
            { headers: { Authorization: token ? `Bearer ${token}` : '' } }
          )
        )
      );
      addToast({
        id: `toast_${Date.now()}`,
        type: 'success',
        message: `Bulk ${action} succeeded (${selectedListingIds.length}).`
      });
      setSelectedListingIds([]);
      queryClient.invalidateQueries(['admin_listings']);
    } catch (err: any) {
      addToast({ id: `toast_${Date.now()}`, type: 'error', message: err.message });
    } finally {
      setIsBulkLoading(false);
    }
  };

  // pagination handlers
  const gotoPage = (newPage: number) => {
    const params: Record<string,string> = {};
    if (statusParam) params.status = statusParam;
    if (searchParam) params.search = searchParam;
    params.page = newPage.toString();
    params.per_page = perPageParam.toString();
    setSearchParams(params);
  };

  return (
    <>
      {/* Filters */}
      <form
        onSubmit={handleFilterSubmit}
        className="flex flex-wrap items-end space-x-4 mb-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            className="mt-1 block w-full border-gray-300 rounded"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="sold">Sold</option>
            <option value="expired">Expired</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Search</label>
          <input
            type="text"
            className="mt-1 block w-full border-gray-300 rounded"
            placeholder="ID or Title"
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
          />
        </div>
        <div>
          <button
            type="submit"
            className="mt-5 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Filter
          </button>
        </div>
      </form>

      {/* Bulk Actions */}
      <div className="flex items-center space-x-2 mb-4">
        <button
          onClick={() => performBulkAction('approve')}
          disabled={!selectedListingIds.length || isBulkLoading}
          className="px-3 py-1 bg-green-500 text-white rounded disabled:opacity-50"
        >
          Approve Selected
        </button>
        <button
          onClick={() => openRejectModal(selectedListingIds)}
          disabled={!selectedListingIds.length || isBulkLoading}
          className="px-3 py-1 bg-yellow-500 text-white rounded disabled:opacity-50"
        >
          Reject Selected
        </button>
        <button
          onClick={() => performBulkAction('remove')}
          disabled={!selectedListingIds.length || isBulkLoading}
          className="px-3 py-1 bg-red-500 text-white rounded disabled:opacity-50"
        >
          Remove Selected
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2">
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={
                    listings.length > 0 &&
                    selectedListingIds.length === listings.length
                  }
                />
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">ID</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Title</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Seller</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Category</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Posted On</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-4 text-center">Loading...</td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={8} className="p-4 text-center text-red-600">
                  {error?.message}
                </td>
              </tr>
            ) : listings.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-center">No listings found.</td>
              </tr>
            ) : (
              listings.map(l => (
                <tr key={l.uid}>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedListingIds.includes(l.uid)}
                      onChange={e => handleSelectOne(l.uid, e.target.checked)}
                    />
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-800">{l.uid}</td>
                  <td className="px-4 py-2 text-sm text-gray-800">{l.title}</td>
                  <td className="px-4 py-2 text-sm text-gray-800">{l.sellerName}</td>
                  <td className="px-4 py-2 text-sm text-gray-800">{l.categoryName}</td>
                  <td className="px-4 py-2 text-sm text-gray-800">{l.status}</td>
                  <td className="px-4 py-2 text-sm text-gray-800">
                    {new Date(l.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-sm space-x-1">
                    {l.status === 'pending' && (
                      <>
                        <button
                          onClick={() => approveMutation.mutate(l.uid)}
                          className="px-2 py-1 bg-green-500 text-white rounded text-xs"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => openRejectModal([l.uid])}
                          className="px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <Link
                      to={`/admin/listings/${l.uid}`}
                      className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => removeMutation.mutate(l.uid)}
                      className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-700">
          Page {pagination.page} of {totalPages}
        </div>
        <div className="space-x-2">
          <button
            onClick={() => gotoPage(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Prev
          </button>
          <button
            onClick={() => gotoPage(pagination.page + 1)}
            disabled={pagination.page >= totalPages}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Reject {rejectTargetIds.length > 1 ? 'Listings' : 'Listing'}</h2>
            <textarea
              className="w-full border-gray-300 rounded p-2 mb-4"
              rows={4}
              placeholder="Rejection reason"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                disabled={isRejectSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                disabled={!rejectReason.trim() || isRejectSubmitting}
              >
                {isRejectSubmitting ? 'Submitting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_AdminListingsList;