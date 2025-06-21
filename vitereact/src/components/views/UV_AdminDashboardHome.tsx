import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore, AdminMetrics } from '@/store/main';
import { Link } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const UV_AdminDashboardHome: React.FC = () => {
  // Global store selectors
  const token = useAppStore(state => state.auth.token);
  const globalMetrics = useAppStore(state => state.admin.metrics);
  const setAdminMetrics = useAppStore(state => state.set_admin_metrics);
  const addToast = useAppStore(state => state.add_toast);

  // Fetch metrics via React Query
  const {
    data: metrics = globalMetrics,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery<AdminMetrics, Error>({
    queryKey: ['admin', 'dashboard', 'metrics'],
    queryFn: async () => {
      if (!token) {
        throw new Error('Unauthorized: missing auth token');
      }
      const response = await axios.get<AdminMetrics>(
        `${API_BASE_URL}/api/admin/dashboard`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      return response.data;
    },
    initialData: globalMetrics,
    refetchInterval: 60000, // polling every 60s
    onSuccess: data => {
      setAdminMetrics(data);
    },
    onError: err => {
      const toastId = Date.now().toString();
      addToast({ id: toastId, type: 'error', message: err.message });
    }
  });

  // Quick action tiles
  const quickActions: { title: string; to: string }[] = [
    { title: 'Manage Users', to: '/admin/users' },
    { title: 'Manage Listings', to: '/admin/listings' },
    { title: 'Manage Reports', to: '/admin/reports' },
    { title: 'Manage Categories', to: '/admin/categories' }
  ];

  return (
    <>
      {/* Loading or Error States */}
      {isLoading && (
        <div className="text-center py-8">
          <p className="text-gray-600">Loading metrics...</p>
        </div>
      )}
      {isError && (
        <div className="text-center py-8">
          <p className="text-red-500 mb-2">Failed to load metrics.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-4 bg-white rounded shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{metrics.total_users}</p>
          </div>
          <div className="p-4 bg-white rounded shadow">
            <h3 className="text-sm font-medium text-gray-500">New Users (7d)</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{metrics.new_users_7d}</p>
          </div>
          <div className="p-4 bg-white rounded shadow">
            <h3 className="text-sm font-medium text-gray-500">Active Listings</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{metrics.active_listings}</p>
          </div>
          <div className="p-4 bg-white rounded shadow">
            <h3 className="text-sm font-medium text-gray-500">New Listings (7d)</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{metrics.new_listings_7d}</p>
          </div>
          <div className="p-4 bg-white rounded shadow">
            <h3 className="text-sm font-medium text-gray-500">Pending Reports</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{metrics.pending_reports}</p>
          </div>
          <div className="p-4 bg-white rounded shadow">
            <h3 className="text-sm font-medium text-gray-500">Open Reports</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{metrics.open_reports}</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
        {quickActions.map(action => (
          <Link
            key={action.to}
            to={action.to}
            className="flex flex-col items-center justify-center p-6 bg-white rounded shadow hover:bg-gray-50 transition"
          >
            <p className="text-lg font-medium text-blue-600">{action.title}</p>
          </Link>
        ))}
      </div>
    </>
  );
};

export default UV_AdminDashboardHome;