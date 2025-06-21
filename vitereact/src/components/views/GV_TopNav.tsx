import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore, CategoryTree } from '@/store/main';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const GV_TopNav: React.FC = () => {
  const navigate = useNavigate();

  // Global auth/nav state & actions
  const isAuthenticated = useAppStore(s => s.auth.is_authenticated);
  const user = useAppStore(s => s.auth.user);
  const categories = useAppStore(s => s.nav.categories);
  const unreadMessagesCount = useAppStore(s => s.nav.unread_messages_count);
  const unreadNotificationsCount = useAppStore(s => s.nav.unread_notifications_count);
  const isSideDrawerOpen = useAppStore(s => s.nav.is_side_drawer_open);

  const setNavCategories = useAppStore(s => s.set_nav_categories);
  const setUnreadMessagesCount = useAppStore(s => s.set_unread_messages_count);
  const setUnreadNotificationsCount = useAppStore(s => s.set_unread_notifications_count);
  const toggleSideDrawer = useAppStore(s => s.toggle_side_drawer);
  const logout = useAppStore(s => s.logout);

  // Local UI state
  const [isSearchActive, setIsSearchActive] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);
  const [isNotificationsDropdownOpen, setIsNotificationsDropdownOpen] = useState<boolean>(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState<boolean>(false);

  // Fetch categories on mount
  useQuery<CategoryTree[], Error>(
    ['navCategories'],
    async () => {
      const { data } = await axios.get<CategoryTree[]>(`${BASE_URL}/api/categories`);
      return data;
    },
    {
      onSuccess: setNavCategories,
    }
  );

  // Fetch unread counts when authenticated
  useQuery<{ unread_messages_count: number; unread_notifications_count: number }, Error>(
    ['userStats'],
    async () => {
      const { data } = await axios.get<{ unread_messages_count: number; unread_notifications_count: number }>(
        `${BASE_URL}/api/users/me`
      );
      return {
        unread_messages_count: data.unread_messages_count,
        unread_notifications_count: data.unread_notifications_count,
      };
    },
    {
      enabled: isAuthenticated,
      onSuccess: ({ unread_messages_count, unread_notifications_count }) => {
        setUnreadMessagesCount(unread_messages_count);
        setUnreadNotificationsCount(unread_notifications_count);
      },
    }
  );

  // Handlers
  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      navigate(`/search?query=${encodeURIComponent(q)}`);
      setIsSearchActive(false);
    }
  };
  const handleSuggestionClick = (cat: CategoryTree) => {
    navigate(`/categories/${cat.uid}`);
    setSearchQuery('');
    setIsSearchActive(false);
  };
  const toggleProfileMenu = () => setIsProfileMenuOpen(prev => !prev);
  const toggleNotificationsDropdown = () => setIsNotificationsDropdownOpen(prev => !prev);
  const toggleCategoryMenu = () => setIsCategoryMenuOpen(prev => !prev);
  const handleHamburgerClick = () => toggleSideDrawer(!isSideDrawerOpen);

  // Simple autocomplete: filter top-level categories
  const filteredCategories = searchQuery
    ? categories.filter(cat =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 bg-white shadow z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left: Hamburger (mobile), Logo, Category menu (desktop) */}
          <div className="flex items-center">
            <button
              className="md:hidden p-2 focus:outline-none"
              onClick={handleHamburgerClick}
              aria-label="Open menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link
              to={isAuthenticated ? '/home' : '/'}
              className="flex items-center ml-2 md:ml-0"
            >
              <img
                src="https://picsum.photos/seed/logo/32/32"
                alt="MarketMate Logo"
                className="h-8 w-8 mr-2"
              />
              <span className="text-xl font-bold text-gray-800">MarketMate</span>
            </Link>
            <div
              className="hidden md:block relative ml-6"
              onMouseEnter={() => setIsCategoryMenuOpen(true)}
              onMouseLeave={() => setIsCategoryMenuOpen(false)}
            >
              <button
                className="flex items-center p-2 text-gray-700 hover:text-gray-900 focus:outline-none"
                onClick={toggleCategoryMenu}
                aria-haspopup="true"
                aria-expanded={isCategoryMenuOpen}
              >
                <span>Categories</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4 ml-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isCategoryMenuOpen && (
                <div className="absolute top-full left-0 bg-white shadow-lg py-4 w-screen max-w-md">
                  <div className="grid grid-cols-2 gap-4 px-4">
                    {categories.map(cat => (
                      <div key={cat.uid}>
                        <Link
                          to={`/categories/${cat.uid}`}
                          className="font-medium text-gray-800 hover:underline"
                        >
                          {cat.name}
                        </Link>
                        {cat.children.length > 0 && (
                          <ul className="mt-2 ml-4 space-y-1">
                            {cat.children.map(child => (
                              <li key={child.uid}>
                                <Link
                                  to={`/categories/${child.uid}`}
                                  className="text-gray-600 hover:text-gray-800"
                                >
                                  {child.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center: Search */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 mx-4 max-w-lg">
            <input
              type="text"
              placeholder="Search items..."
              className="w-full border border-gray-300 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onFocus={() => setIsSearchActive(true)}
              onBlur={() => setIsSearchActive(false)}
              onChange={handleSearchInput}
            />
            {isSearchActive && filteredCategories.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 shadow z-10 max-h-60 overflow-auto rounded-md">
                {filteredCategories.map(cat => (
                  <div
                    key={cat.uid}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    onMouseDown={() => handleSuggestionClick(cat)}
                  >
                    {cat.name}
                  </div>
                ))}
              </div>
            )}
          </form>

          {/* Right: Auth controls */}
          <div className="flex items-center space-x-4">
            {!isAuthenticated ? (
              <>
                <Link to="/login" className="text-gray-700 hover:text-gray-900">
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700"
                >
                  Sign Up
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/listings/new/step1"
                  className="bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700"
                >
                  Sell Item
                </Link>
                <Link to="/messages" className="relative text-gray-700 hover:text-gray-900" aria-label="Messages">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                  {unreadMessagesCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                      {unreadMessagesCount}
                    </span>
                  )}
                </Link>
                <div className="relative">
                  <button
                    className="text-gray-700 hover:text-gray-900 p-2 focus:outline-none"
                    onClick={toggleNotificationsDropdown}
                    aria-label="Notifications"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                    {unreadNotificationsCount > 0 && (
                      <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                        {unreadNotificationsCount}
                      </span>
                    )}
                  </button>
                  {isNotificationsDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 shadow-lg rounded-md z-20">
                      <div className="p-4 text-center text-gray-500">No new notifications</div>
                      <div className="border-t">
                        <Link
                          to="/notifications"
                          className="block text-center px-4 py-2 text-blue-600 hover:bg-gray-100"
                        >
                          View all
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button onClick={toggleProfileMenu} className="focus:outline-none" aria-label="Profile menu">
                    {user?.profile_pic_url ? (
                      <img
                        src={user.profile_pic_url}
                        alt={user.display_name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-8 h-8 rounded-full bg-gray-200 p-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5.121 17.804A13.937 13.937 0 0112 15c2.928 0 5.659.944 7.879 2.804M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    )}
                  </button>
                  {isProfileMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 shadow-lg rounded-md z-20">
                      <Link
                        to="/profile/me/listings"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                      >
                        My Listings
                      </Link>
                      <Link
                        to="/profile/me/drafts"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                      >
                        My Drafts
                      </Link>
                      <Link
                        to="/profile/me/favorites"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                      >
                        Favorites
                      </Link>
                      <Link
                        to="/profile/me/offers"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                      >
                        My Offers
                      </Link>
                      <Link
                        to="/profile/me/transactions"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                      >
                        Transactions
                      </Link>
                      <Link
                        to="/profile/me/settings"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                      >
                        Settings
                      </Link>
                      <button
                        onClick={() => {
                          logout();
                          navigate('/login');
                        }}
                        className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default GV_TopNav;