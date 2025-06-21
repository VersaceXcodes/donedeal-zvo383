import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface Message {
  uid: string;
  sender_uid: string;
  content: string;
  timestamp: string;
  is_read: boolean;
}

interface OtherUser {
  uid: string;
  displayName: string;
  profilePicUrl: string;
}

interface Thread {
  uid: string;
  listingUid: string;
  listingTitle: string;
  other_user: OtherUser;
  lastMessageAt: string;
  unreadCount: number;
}

const UV_MessageThread: React.FC = () => {
  const { threadId } = useParams<{ threadId: string }>();
  const [searchParams] = useSearchParams();
  if (!threadId) return null;

  // Global store
  const currentUserUid = useAppStore(state => state.auth.user?.uid || '');
  const navUnreadCount = useAppStore(state => state.nav.unread_messages_count);
  const setNavUnreadCount = useAppStore(state => state.set_unread_messages_count);

  // Pagination from URL or defaults
  const initialPage = parseInt(searchParams.get('page') ?? '1', 10);
  const initialPerPage = parseInt(searchParams.get('per_page') ?? '50', 10);

  // Local state
  const [page, setPage] = useState<number>(initialPage);
  const [perPage] = useState<number>(initialPerPage);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [thread, setThread] = useState<Thread | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);

  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch thread summary
  useQuery<Thread, Error>(
    ['thread', threadId],
    async () => {
      const resp = await axios.get(`${API_BASE_URL}/api/conversations/${threadId}`);
      return resp.data;
    },
    {
      onSuccess: data => {
        setThread(data);
      },
      onError: err => {
        setError(err.message);
      }
    }
  );

  // Mark thread read mutation
  const markReadMutation = useMutation<void, Error>(
    async () => {
      await axios.put(`${API_BASE_URL}/api/conversations/${threadId}/read`);
    },
    {
      onSuccess: () => {
        if (thread?.unreadCount) {
          setNavUnreadCount(Math.max(navUnreadCount - thread.unreadCount, 0));
          setThread(prev => (prev ? { ...prev, unreadCount: 0 } : prev));
        }
      }
    }
  );

  // Fetch paginated messages
  useQuery<{ messages: Message[]; has_more: boolean }, Error>(
    ['messages', threadId, page, perPage],
    async () => {
      const resp = await axios.get(
        `${API_BASE_URL}/api/conversations/${threadId}/messages?page=${page}&per_page=${perPage}`
      );
      return resp.data;
    },
    {
      keepPreviousData: true,
      onSuccess: data => {
        setError(null);
        if (page === 1) {
          setMessages(data.messages);
        } else {
          // prepend older messages at top
          setMessages(prev => [...data.messages, ...prev]);
        }
        setHasMore(data.has_more);
        if (data.messages.length > 0) {
          markReadMutation.mutate();
        }
      },
      onError: err => {
        setError(err.message);
      }
    }
  );

  // Send message (optimistic update)
  const sendMutation = useMutation<Message, Error, string>(
    async content => {
      const resp = await axios.post(
        `${API_BASE_URL}/api/conversations/${threadId}/messages`,
        { content }
      );
      return resp.data;
    },
    {
      onMutate: async content => {
        setError(null);
        await queryClient.cancelQueries(['messages', threadId, page, perPage]);
        const optimistic: Message = {
          uid: `temp-${Date.now()}`,
          sender_uid: currentUserUid,
          content,
          timestamp: new Date().toISOString(),
          is_read: false
        };
        setMessages(prev => [...prev, optimistic]);
        return { optimisticId: optimistic.uid };
      },
      onError: (err, _content, context) => {
        if (context?.optimisticId) {
          setMessages(prev => prev.filter(m => m.uid !== context.optimisticId));
        }
        setError(err.message);
      },
      onSuccess: (data, _content, context) => {
        if (context?.optimisticId) {
          setMessages(prev =>
            prev.map(m => (m.uid === context.optimisticId ? data : m))
          );
        }
        setNewMessage('');
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  );

  // Block / Unblock mutations
  const blockMutation = useMutation<void, Error>(
    async () => {
      if (!thread) throw new Error('Thread not loaded');
      await axios.post(`${API_BASE_URL}/api/users/${thread.other_user.uid}/block`);
    },
    { onSuccess: () => setIsBlocked(true), onError: err => setError(err.message) }
  );
  const unblockMutation = useMutation<void, Error>(
    async () => {
      if (!thread) throw new Error('Thread not loaded');
      await axios.delete(`${API_BASE_URL}/api/users/${thread.other_user.uid}/block`);
    },
    { onSuccess: () => setIsBlocked(false), onError: err => setError(err.message) }
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLoadMore = () => {
    if (hasMore) setPage(prev => prev + 1);
  };
  const handleSend = () => {
    if (newMessage.trim() === '') return;
    sendMutation.mutate(newMessage.trim());
  };

  // Prepare message elements with date separators
  const messageElements: React.ReactNode[] = [];
  let lastDateStr = '';
  messages.forEach(msg => {
    const dateStr = new Date(msg.timestamp).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    if (dateStr !== lastDateStr) {
      messageElements.push(
        <div
          key={`date-${dateStr}`}
          className="text-center text-xs text-gray-500 my-2"
        >
          {dateStr}
        </div>
      );
      lastDateStr = dateStr;
    }
    messageElements.push(
      <div
        key={msg.uid}
        className={`flex ${
          msg.sender_uid === currentUserUid ? 'justify-end' : 'justify-start'
        } mb-1`}
      >
        <div
          className={`max-w-xs px-3 py-2 rounded-lg ${
            msg.sender_uid === currentUserUid
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-800'
          }`}
        >
          <div>{msg.content}</div>
          <div className="text-right text-[10px] text-gray-600 mt-1 flex items-center justify-end">
            <span>
              {new Date(msg.timestamp).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
            {msg.sender_uid === currentUserUid && msg.is_read && (
              <span className="ml-1">✓</span>
            )}
          </div>
        </div>
      </div>
    );
  });

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <div className="flex items-center">
            <img
              src={thread?.other_user.profilePicUrl}
              alt={thread?.other_user.displayName}
              className="w-10 h-10 rounded-full mr-2"
            />
            <Link
              to={`/profile/${thread?.other_user.uid}`}
              className="font-semibold text-gray-800"
            >
              {thread?.other_user.displayName}
            </Link>
          </div>
          <button
            onClick={() =>
              isBlocked
                ? unblockMutation.mutate()
                : blockMutation.mutate()
            }
            className="text-sm text-blue-600 hover:underline"
          >
            {isBlocked ? 'Unblock' : 'Block User'}
          </button>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-auto px-4 py-2">
          {hasMore && (
            <div className="flex justify-center mb-2">
              <button
                onClick={handleLoadMore}
                disabled={sendMutation.isLoading}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Load More
              </button>
            </div>
          )}
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-4">
              No messages yet.
            </div>
          ) : (
            messageElements
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="text-red-500 text-sm px-4 mb-2">{error}</div>
        )}

        {/* Input Bar */}
        <div className="px-4 py-2 border-t">
          {isBlocked ? (
            <div className="text-center text-gray-500">
              You have blocked this user.
            </div>
          ) : (
            <div className="flex items-center">
              <textarea
                value={newMessage}
                onChange={e => {
                  setNewMessage(e.target.value);
                  setError(null);
                }}
                placeholder="Type a message..."
                maxLength={1000}
                rows={2}
                className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring"
              />
              <button
                onClick={handleSend}
                disabled={
                  newMessage.trim() === '' || sendMutation.isLoading
                }
                className="ml-2 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                Send
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_MessageThread;