import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { useNavigate, useLocation, Link } from 'react-router-dom';

interface AdminMetrics {
  total_users: number;
  new_users_7d: number;
  active_listings: number;
  new_listings_7d: number;
  pending_reports: number;
  open_reports: number;
}

const fetchAdminMetrics = async (): Promise<AdminMetrics> => {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const { data } = await axios.get<AdminMetrics>(`${base}/api/admin/dashboard`);
  return data;
};

const GV_AdminTopBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setAdminMetrics = useAppStore(state => state.set_admin_metrics);
  const logout = useAppStore(state => state.logout);
  const metrics = useAppStore(state => state.admin.metrics);
  const user = useAppStore(state => state.auth.user);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);

  // Fetch metrics on mount
  useQuery<AdminMetrics, Error>({
    queryKey: ['adminMetrics'],
    queryFn: fetchAdminMetrics,
    onSuccess: data => setAdminMetrics(data),
  });

  // Close profile menu on navigation
  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [location.pathname]);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(location.search);
    if (searchQuery) {
      params.set('search', searchQuery);
    } else {
      params.delete('search');
    }
    navigate(`${location.pathname}?${params.toString()}`);
  };

  const handleToggleProfile = () => {
    setIsProfileMenuOpen(open => !open);
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <>
      <div className="sticky top-0 z-20 bg-white border-b">
        <div className="flex items-center h-16 px-6">
          {/* Metrics Cards */}
          <div className="flex items-center space-x-4">
            <div className="bg-gray-50 rounded-lg p-3 flex flex-col items-center">
              <div className="text-sm text-gray-600">Total Users</div>
              <div className="mt-1 text-xl font-semibold text-gray-800">
                {metrics.total_users}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 flex flex-col items-center">
              <div className="text-sm text-gray-600">Active Listings</div>
              <div className="mt-1 text-xl font-semibold text-gray-800">
                {metrics.active_listings}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 flex flex-col items-center">
              <div className="text-sm text-gray-600">Open Reports</div>
              <div className="mt-1 text-xl font-semibold text-gray-800">
                {metrics.open_reports}
              </div>
            </div>
          </div>

          {/* Search Input */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 mx-6 max-w-lg"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchInput}
              placeholder="Search admin tables…"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </form>

          {/* Profile Dropdown */}
          <div className="relative">
            {user?.profile_pic_url ? (
              <img
                src={user.profile_pic_url}
                alt="Admin Profile"
                className="w-8 h-8 rounded-full cursor-pointer"
                onClick={handleToggleProfile}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full bg-gray-400 text-white flex items-center justify-center cursor-pointer"
                onClick={handleToggleProfile}
              >
                {user?.display_name?.[0]?.toUpperCase() || 'A'}
              </div>
            )}
            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-lg z-30">
                <Link
                  to={`/admin/users/${user?.uid}`}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default GV_AdminTopBar;