import React from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface UserDetail {
  uid: string;
  email: string;
  phone?: string;
  display_name: string;
  profile_pic_url?: string;
  role: 'buyer' | 'seller' | 'admin';
  is_email_verified: boolean;
  is_phone_verified: boolean;
  created_at: string;
  last_login_at: string;
}

interface ActivityLogEntry {
  id: string;
  action: string;
  description: string;
  timestamp: string;
}

interface ListingSummary {
  uid: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AdminUserDetailPayload {
  user: UserDetail;
  activityLog: ActivityLogEntry[];
  listingsSummary: ListingSummary[];
}

const UV_AdminUserDetail: React.FC = () => {
  const { userId = '' } = useParams<{ userId: string }>();
  const token = useAppStore(state => state.auth.token);
  const addToast = useAppStore(state => state.add_toast);
  const queryClient = useQueryClient();

  // Fetch user detail, activity log, listings summary
  const {
    data,
    isLoading,
    isError,
    error
  } = useQuery<AdminUserDetailPayload, Error>(
    ['adminUser', userId],
    async () => {
      const res = await axios.get<AdminUserDetailPayload>(
        `${API_BASE_URL}/api/admin/users/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    },
    { enabled: !!token && !!userId }
  );

  // Helper to update status
  const updateStatus = async (status: 'suspended' | 'banned' | 'active'): Promise<UserDetail> => {
    const res = await axios.put<UserDetail>(
      `${API_BASE_URL}/api/admin/users/${userId}/status`,
      { status },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  };

  const suspendMutation = useMutation(() => updateStatus('suspended'), {
    onSuccess: () => {
      queryClient.invalidateQueries(['adminUser', userId]);
      addToast({ id: Date.now().toString(), type: 'success', message: 'User suspended' });
    },
    onError: (err: Error) => {
      addToast({ id: Date.now().toString(), type: 'error', message: err.message });
    }
  });

  const banMutation = useMutation(() => updateStatus('banned'), {
    onSuccess: () => {
      queryClient.invalidateQueries(['adminUser', userId]);
      addToast({ id: Date.now().toString(), type: 'success', message: 'User banned' });
    },
    onError: (err: Error) => {
      addToast({ id: Date.now().toString(), type: 'error', message: err.message });
    }
  });

  const unbanMutation = useMutation(() => updateStatus('active'), {
    onSuccess: () => {
      queryClient.invalidateQueries(['adminUser', userId]);
      addToast({ id: Date.now().toString(), type: 'success', message: 'User unbanned' });
    },
    onError: (err: Error) => {
      addToast({ id: Date.now().toString(), type: 'error', message: err.message });
    }
  });

  return (
    <>
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Admin: User Detail</h1>
          <Link
            to="/admin/users"
            className="text-blue-600 hover:underline"
          >
            &larr; Back to Users
          </Link>
        </div>

        {isLoading && (
          <div className="text-gray-600">Loading user data...</div>
        )}

        {isError && (
          <div className="text-red-500">
            Error loading user: {error?.message}
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Personal Info */}
            <div className="bg-white shadow rounded p-6">
              <div className="flex items-center space-x-4">
                {data.user.profile_pic_url ? (
                  <img
                    src={data.user.profile_pic_url}
                    alt="Profile"
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded-full" />
                )}
                <div>
                  <h2 className="text-xl font-semibold">
                    {data.user.display_name}
                  </h2>
                  <p className="text-gray-700">{data.user.email}</p>
                  {data.user.phone && (
                    <p className="text-gray-700">{data.user.phone}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 text-gray-800">
                <div>
                  <p>
                    <span className="font-medium">Role:</span>{' '}
                    {data.user.role}
                  </p>
                  <p>
                    <span className="font-medium">Email Verified:</span>{' '}
                    {data.user.is_email_verified ? 'Yes' : 'No'}
                  </p>
                  <p>
                    <span className="font-medium">Phone Verified:</span>{' '}
                    {data.user.is_phone_verified ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <p>
                    <span className="font-medium">Created At:</span>{' '}
                    {new Date(data.user.created_at).toLocaleString()}
                  </p>
                  <p>
                    <span className="font-medium">Last Login At:</span>{' '}
                    {new Date(data.user.last_login_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex space-x-2">
                <button
                  onClick={() => suspendMutation.mutate()}
                  disabled={suspendMutation.isLoading}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  Suspend
                </button>
                <button
                  onClick={() => banMutation.mutate()}
                  disabled={banMutation.isLoading}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  Ban
                </button>
                <button
                  onClick={() => unbanMutation.mutate()}
                  disabled={unbanMutation.isLoading}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  Unban
                </button>
              </div>
            </div>

            {/* Activity Log */}
            <div className="bg-white shadow rounded p-6">
              <h3 className="text-lg font-semibold mb-4">Activity Log</h3>
              {data.activityLog.length === 0 ? (
                <p className="text-gray-600">No activity found.</p>
              ) : (
                <ul className="space-y-4">
                  {data.activityLog.map((entry) => (
                    <li key={entry.id} className="border-b pb-2">
                      <p className="font-medium">
                        {entry.action}{' '}
                        <span className="text-sm text-gray-500">
                          ({new Date(entry.timestamp).toLocaleString()})
                        </span>
                      </p>
                      <p className="text-gray-700">{entry.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Listings Summary */}
            <div className="bg-white shadow rounded p-6">
              <h3 className="text-lg font-semibold mb-4">
                Listing Summary
              </h3>
              {data.listingsSummary.length === 0 ? (
                <p className="text-gray-600">No listings found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border px-3 py-2 text-left">
                          Title
                        </th>
                        <th className="border px-3 py-2">Status</th>
                        <th className="border px-3 py-2">Created</th>
                        <th className="border px-3 py-2">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.listingsSummary.map((l) => (
                        <tr key={l.uid} className="hover:bg-gray-50">
                          <td className="border px-3 py-2">{l.title}</td>
                          <td className="border px-3 py-2">{l.status}</td>
                          <td className="border px-3 py-2">
                            {new Date(l.created_at).toLocaleDateString()}
                          </td>
                          <td className="border px-3 py-2">
                            {new Date(l.updated_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_AdminUserDetail;