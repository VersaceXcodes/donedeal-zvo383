import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useAppStore, CategoryTree } from '@/store/main';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const fetchCategories = async (): Promise<CategoryTree[]> => {
  const { data } = await axios.get<CategoryTree[]>(
    `${API_BASE}/api/categories`
  );
  return data;
};

const GV_SideDrawer: React.FC = () => {
  const navigate = useNavigate();

  // global state
  const isOpen = useAppStore((s) => s.nav.is_side_drawer_open);
  const categories = useAppStore((s) => s.nav.categories);
  const setNavCategories = useAppStore((s) => s.set_nav_categories);
  const isAuthenticated = useAppStore((s) => s.auth.is_authenticated);
  const logout = useAppStore((s) => s.logout);

  // local state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchActive, setIsSearchActive] = useState<boolean>(false);

  // fetch categories if not loaded
  useQuery<CategoryTree[], Error>({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    onSuccess: setNavCategories,
    enabled: categories.length === 0,
    staleTime: Infinity
  });

  const handleClose = () => {
    useAppStore.getState().toggle_side_drawer(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      handleClose();
      navigate(`/search?query=${encodeURIComponent(q)}`);
      setSearchQuery('');
      setIsSearchActive(false);
    }
  };

  const handleLinkClick = (to: string) => {
    handleClose();
    navigate(to);
  };

  const handleLogout = () => {
    logout();
    handleClose();
    navigate('/');
  };

  return (
    <>
      {/* overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={handleClose}
        />
      )}

      {/* drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-white z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Menu</h2>
          <button
            onClick={handleClose}
            className="text-gray-800 text-2xl leading-none focus:outline-none"
            aria-label="Close menu"
          >
            &times;
          </button>
        </div>

        {/* search */}
        <form onSubmit={handleSearchSubmit} className="p-4">
          <div className="relative">
            <input
              type="text"
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchActive(true)}
              onBlur={() => setIsSearchActive(false)}
            />
            {isSearchActive && searchQuery && (
              <div className="absolute top-full left-0 right-0 bg-white shadow mt-1 max-h-48 overflow-auto">
                {/* suggestions would go here */}
                <p className="p-2 text-gray-500">No suggestions</p>
              </div>
            )}
          </div>
        </form>

        {/* categories */}
        <nav className="px-4 py-2 overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            Categories
          </h3>
          <ul>
            {categories.map((cat) => (
              <li key={cat.uid} className="mb-1">
                <button
                  onClick={() => handleLinkClick(`/categories/${cat.uid}`)}
                  className="text-gray-800 hover:text-blue-600 focus:outline-none"
                >
                  {cat.name}
                </button>
                {cat.children.length > 0 && (
                  <ul className="pl-4 mt-1">
                    {cat.children.map((sub) => (
                      <li key={sub.uid} className="mb-1">
                        <button
                          onClick={() =>
                            handleLinkClick(`/categories/${sub.uid}`)
                          }
                          className="text-gray-700 hover:text-blue-600 focus:outline-none text-sm"
                        >
                          {sub.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* auth controls */}
        <div className="border-t px-4 py-4">
          {!isAuthenticated ? (
            <div className="space-y-2">
              <button
                onClick={() => handleLinkClick('/login')}
                className="block w-full text-left text-gray-800 hover:text-blue-600 focus:outline-none"
              >
                Login
              </button>
              <button
                onClick={() => handleLinkClick('/signup')}
                className="block w-full text-left text-gray-800 hover:text-blue-600 focus:outline-none"
              >
                Sign Up
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => handleLinkClick('/profile/setup')}
                className="block w-full text-left text-gray-800 hover:text-blue-600 focus:outline-none"
              >
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="block w-full text-left text-gray-800 hover:text-blue-600 focus:outline-none"
              >
                Logout
              </button>
            </div>
          )}

          {/* Sell Item */}
          <div className="mt-4">
            <button
              onClick={() =>
                handleLinkClick(
                  isAuthenticated
                    ? '/listings/new/step1'
                    : '/login'
                )
              }
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none"
            >
              Sell Item
            </button>
          </div>
        </div>

        {/* footer */}
        <footer className="absolute bottom-0 w-full border-t px-4 py-4">
          <ul className="space-y-2 text-sm text-gray-600">
            <li>
              <Link
                to="/terms"
                onClick={handleClose}
                className="hover:text-blue-600"
              >
                Terms &amp; Conditions
              </Link>
            </li>
            <li>
              <Link
                to="/privacy"
                onClick={handleClose}
                className="hover:text-blue-600"
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link
                to="/help"
                onClick={handleClose}
                className="hover:text-blue-600"
              >
                Help
              </Link>
            </li>
          </ul>
        </footer>
      </div>
    </>
  );
};

export default GV_SideDrawer;