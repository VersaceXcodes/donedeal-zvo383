import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useSearchParams, Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

interface Notification {
  uid: string;
  type: string;
  metadata: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  total: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const UV_NotificationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterType = searchParams.get('type') || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const per_page = 20;

  const unreadCount = useAppStore(state => state.nav.unread_notifications_count);
  const setUnreadCount = useAppStore(state => state.set_unread_notifications_count);
  const addToast = useAppStore(state => state.add_toast);

  // Fetch notifications
  const {
    data,
    isLoading,
    isError,
    error
  } = useQuery<NotificationsResponse, Error>(
    ['notifications', filterType, pageParam],
    async () => {
      const { data } = await axios.get<NotificationsResponse>(
        `${API_BASE_URL}/api/notifications`,
        {
          params: {
            type: filterType || undefined,
            page: pageParam,
            per_page
          },
          headers: {
            Authorization: `Bearer ${useAppStore.getState().auth.token}`
          }
        }
      );
      return data;
    },
    {
      keepPreviousData: true
    }
  );

  // Mark single notification as read
  const markOne = useMutation<void, Error, string>({
    mutationFn: async (uid: string) => {
      await axios.post(
        `${API_BASE_URL}/api/notifications/${uid}/read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${useAppStore.getState().auth.token}`
          }
        }
      );
    },
    onSuccess: (_data, uid) => {
      queryClient.invalidateQueries(['notifications', filterType, pageParam]);
      setUnreadCount(Math.max(unreadCount - 1, 0));
      addToast({
        id: `mark-read-${uid}-${Date.now()}`,
        type: 'success',
        message: 'Notification marked as read'
      });
    },
    onError: (err) => {
      addToast({
        id: `mark-read-error-${Date.now()}`,
        type: 'error',
        message: err.message
      });
    }
  });

  // Mark all notifications as read
  const markAll = useMutation<void, Error, void>({
    mutationFn: async () => {
      await axios.post(
        `${API_BASE_URL}/api/notifications/read-all`,
        {},
        {
          headers: {
            Authorization: `Bearer ${useAppStore.getState().auth.token}`
          }
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      setUnreadCount(0);
      addToast({
        id: `mark-all-${Date.now()}`,
        type: 'success',
        message: 'All notifications marked as read'
      });
    },
    onError: (err) => {
      addToast({
        id: `mark-all-error-${Date.now()}`,
        type: 'error',
        message: err.message
      });
    }
  });

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / per_page);

  // Handlers
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const t = e.target.value;
    const params = new URLSearchParams();
    if (t) params.set('type', t);
    params.set('page', '1');
    setSearchParams(params);
  };

  const handlePage = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    if (newPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(newPage));
    }
    setSearchParams(params);
  };

  return (
    <>
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <button
            onClick={() => markAll.mutate()}
            disabled={unreadCount === 0 || markAll.isLoading}
            className={`px-4 py-2 rounded ${
              unreadCount === 0 || markAll.isLoading
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Mark All as Read
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <label htmlFor="filter" className="font-medium">Filter:</label>
          <select
            id="filter"
            value={filterType}
            onChange={handleFilterChange}
            className="border rounded px-2 py-1"
          >
            <option value="">All</option>
            <option value="message">Messages</option>
            <option value="offer">Offers</option>
            <option value="favorite">Favorites</option>
          </select>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading…</div>
        ) : isError ? (
          <div className="text-center text-red-500 py-8">
            {(error as Error).message}
          </div>
        ) : (
          <ul className="divide-y">
            {data!.notifications.map((n) => {
              const threadId = n.metadata.thread_id || n.metadata.threadId;
              const listingId = n.metadata.listing_uid || n.metadata.listingUid;
              const to = threadId
                ? `/messages/${threadId}`
                : listingId
                ? `/listings/${listingId}`
                : '#';
              const description =
                n.metadata.text || n.metadata.message || n.type;
              const icon =
                n.type === 'message'
                  ? '💬'
                  : n.type === 'offer'
                  ? '💰'
                  : n.type === 'favorite'
                  ? '❤️'
                  : '🔔';
              return (
                <li key={n.uid} className={`py-3 ${n.is_read ? '' : 'bg-gray-100'}`}>
                  <Link
                    to={to}
                    onClick={() => {
                      if (!n.is_read) markOne.mutate(n.uid);
                    }}
                    className="flex items-center space-x-3"
                  >
                    <span className="text-xl">{icon}</span>
                    <div className="flex-1">
                      <p className="truncate">{description}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination */}
        {!isLoading && !isError && totalPages > 1 && (
          <div className="flex justify-center items-center space-x-4 mt-4">
            <button
              onClick={() => handlePage(pageParam - 1)}
              disabled={pageParam <= 1}
              className={`px-3 py-1 rounded ${
                pageParam <= 1
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Prev
            </button>
            <span>
              Page {pageParam} of {totalPages}
            </span>
            <button
              onClick={() => handlePage(pageParam + 1)}
              disabled={pageParam >= totalPages}
              className={`px-3 py-1 rounded ${
                pageParam >= totalPages
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_NotificationsPage;