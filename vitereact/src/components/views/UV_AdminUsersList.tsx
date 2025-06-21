import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface UserSummary {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  joined_on: string;
}

interface FetchUsersResponse {
  users: UserSummary[];
  total: number;
}

const UV_AdminUsersList: React.FC = () => {
  const token = useAppStore(state => state.auth.token);
  const addToast = useAppStore(state => state.add_toast);
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') || '';
  const searchParam = searchParams.get('search') || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const perPageParam = parseInt(searchParams.get('per_page') || '20', 10);

  const [searchInput, setSearchInput] = useState(searchParam);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  useEffect(() => {
    setSearchInput(searchParam);
  }, [searchParam]);

  // Fetch users query
  const fetchUsers = async (): Promise<FetchUsersResponse> => {
    const params: Record<string, any> = {
      page: pageParam,
      per_page: perPageParam
    };
    if (statusParam) params.status = statusParam;
    if (searchParam) params.search = searchParam;
    const { data } = await axios.get<FetchUsersResponse>(
      `${API_BASE_URL}/api/admin/users`,
      {
        params,
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return data;
  };

  const { data, isLoading, error } = useQuery<FetchUsersResponse, Error>(
    ['admin_users', statusParam, searchParam, pageParam, perPageParam],
    fetchUsers,
    { keepPreviousData: true }
  );

  // Mutation for updating user status
  const updateStatusMutation = useMutation<
    unknown,
    Error,
    { uid: string; status: 'suspended' | 'banned' }
  >(
    ({ uid, status }) =>
      axios.put(
        `${API_BASE_URL}/api/admin/users/${uid}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      ),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin_users']);
        addToast({
          id: `${Date.now()}`,
          type: 'success',
          message: 'User status updated'
        });
      },
      onError: (err) => {
        addToast({
          id: `${Date.now()}`,
          type: 'error',
          message: err.message
        });
      }
    }
  );

  // Handlers
  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams);
    if (val) params.set('status', val);
    else params.delete('status');
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams);
    if (searchInput) params.set('search', searchInput);
    else params.delete('search');
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const toggleSelectAll = () => {
    if (data && selectedUserIds.length === data.users.length) {
      setSelectedUserIds([]);
    } else if (data) {
      setSelectedUserIds(data.users.map(u => u.uid));
    }
  };

  const toggleSelect = (uid: string) => {
    setSelectedUserIds((ids) =>
      ids.includes(uid) ? ids.filter(i => i !== uid) : [...ids, uid]
    );
  };

  const handleSingleAction = (uid: string, action: 'suspend' | 'ban') => {
    updateStatusMutation.mutate({ uid, status: action === 'ban' ? 'banned' : 'suspended' });
  };

  const handleBulkAction = (action: 'suspend' | 'ban') => {
    selectedUserIds.forEach(uid =>
      updateStatusMutation.mutate({ uid, status: action === 'ban' ? 'banned' : 'suspended' })
    );
    setSelectedUserIds([]);
  };

  const total = data?.total || 0;
  const totalPages = Math.ceil(total / perPageParam);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Filters & Bulk Actions */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-2 items-center">
            <select
              value={statusParam}
              onChange={handleStatusFilterChange}
              className="border rounded px-2 py-1"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
            <input
              type="text"
              placeholder="Search name or email"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="border rounded px-2 py-1"
            />
            <button
              onClick={handleSearch}
              className="bg-blue-600 text-white px-4 py-1 rounded"
            >
              Search
            </button>
          </div>
          <div className="flex space-x-2">
            <button
              disabled={selectedUserIds.length === 0}
              onClick={() => handleBulkAction('suspend')}
              className="bg-yellow-500 text-white px-3 py-1 rounded disabled:opacity-50"
            >
              Suspend Selected
            </button>
            <button
              disabled={selectedUserIds.length === 0}
              onClick={() => handleBulkAction('ban')}
              className="bg-red-600 text-white px-3 py-1 rounded disabled:opacity-50"
            >
              Ban Selected
            </button>
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 table-auto">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={data ? selectedUserIds.length === data.users.length : false}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  ID
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Phone
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Joined On
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-2 text-center">
                    Loading...
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={8} className="px-4 py-2 text-center text-red-500">
                    {error.message}
                  </td>
                </tr>
              )}
              {!isLoading && !error && data && data.users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-2 text-center">
                    No users found.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !error &&
                data &&
                data.users.map((user) => (
                  <tr key={user.uid} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.uid)}
                        onChange={() => toggleSelect(user.uid)}
                      />
                    </td>
                    <td className="px-4 py-2">{user.uid}</td>
                    <td className="px-4 py-2">{user.name}</td>
                    <td className="px-4 py-2">{user.email}</td>
                    <td className="px-4 py-2">{user.phone || '-'}</td>
                    <td className="px-4 py-2">{user.status}</td>
                    <td className="px-4 py-2">
                      {new Date(user.joined_on).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 space-x-2">
                      <Link
                        to={`/admin/users/${user.uid}`}
                        className="text-blue-600 hover:underline"
                      >
                        View
                      </Link>
                      {user.status !== 'suspended' && (
                        <button
                          onClick={() => handleSingleAction(user.uid, 'suspend')}
                          className="text-yellow-600 hover:underline"
                        >
                          Suspend
                        </button>
                      )}
                      {user.status !== 'banned' && (
                        <button
                          onClick={() => handleSingleAction(user.uid, 'ban')}
                          className="text-red-600 hover:underline"
                        >
                          Ban
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing page {pageParam} of {totalPages} ({total} users)
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              disabled={pageParam <= 1}
              onClick={() => handlePageChange(pageParam - 1)}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={pageParam >= totalPages}
              onClick={() => handlePageChange(pageParam + 1)}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_AdminUsersList;