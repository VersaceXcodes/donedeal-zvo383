import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/main';

const GV_AdminSidebar: React.FC = () => {
  // Local collapse state
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  // Global logout action
  const logout = useAppStore(state => state.logout);
  const navigate = useNavigate();
  const location = useLocation();

  // Toggle collapse/expand
  const handleToggle = () => setIsCollapsed(prev => !prev);

  // Perform logout then navigate to admin login
  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  // Admin nav items
  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: '🏠' },
    { name: 'Users', path: '/admin/users', icon: '👥' },
    { name: 'Listings', path: '/admin/listings', icon: '📃' },
    { name: 'Reports', path: '/admin/reports', icon: '🚩' },
    { name: 'Categories', path: '/admin/categories', icon: '📂' },
    { name: 'Settings', path: '/admin/settings', icon: '⚙️' }
  ];

  return (
    <>
      <div className={`flex flex-col bg-gray-800 text-gray-100 h-screen overflow-hidden transition-all ease-in-out duration-200 ${isCollapsed ? 'w-20' : 'w-64'}`}>
        {/* Logo / Title */}
        <div className="py-4 px-2 flex items-center justify-center border-b border-gray-700">
          <span className="text-xl font-bold truncate">
            {isCollapsed ? 'MM' : 'MarketMate Admin'}
          </span>
        </div>
        {/* Navigation Links */}
        <nav className="flex-1 mt-4">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-4 py-2 px-3 hover:bg-gray-700 ${isActive ? 'bg-gray-700' : ''}`}
              >
                <span className="text-lg">{item.icon}</span>
                {!isCollapsed && <span className="text-sm truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
        {/* Logout and Collapse Controls */}
        <div className="px-2 pb-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 py-2 px-3 mt-4 hover:bg-gray-700 rounded"
          >
            <span className="text-lg">🔒</span>
            {!isCollapsed && <span className="text-sm">Logout</span>}
          </button>
          <button
            onClick={handleToggle}
            className="w-full flex items-center justify-center py-2 mt-2 hover:bg-gray-700 rounded"
          >
            <span className={`text-lg transform transition-transform duration-200`}>
              {isCollapsed ? '»' : '«'}
            </span>
          </button>
        </div>
      </div>
    </>
  );
};

export default GV_AdminSidebar;