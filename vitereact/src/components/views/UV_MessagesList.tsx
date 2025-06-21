import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface OtherUser {
  uid: string;
  displayName: string;
  profilePicUrl: string;
}

interface ConversationThread {
  threadUid: string;
  listingUid: string;
  listingThumbnailUrl: string;
  listingTitle: string;
  otherUser: OtherUser;
  lastMessageSnippet: string;
  lastActivityAt: string;
  unreadCount: number;
}

interface FetchThreadsResponse {
  threads: ConversationThread[];
  page: number;
  per_page: number;
  total: number;
}

const fetchConversations = async (
  search: string,
  page: number,
  per_page: number,
  token: string
): Promise<FetchThreadsResponse> => {
  if (!token) throw new Error('Unauthorized');
  const { data } = await axios.get<FetchThreadsResponse>(
    `${API_BASE_URL}/api/conversations`,
    {
      params: { search, page, per_page },
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return data;
};

const UV_MessagesList: React.FC = () => {
  const token = useAppStore(state => state.auth.token);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') ?? '';
  const initialPage = parseInt(searchParams.get('page') ?? '1', 10);
  const perPage = parseInt(searchParams.get('per_page') ?? '20', 10);
  const [inputValue, setInputValue] = useState<string>(searchQuery);

  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery<FetchThreadsResponse, Error>(
    ['conversations', searchQuery, perPage],
    ({ pageParam = initialPage }) =>
      fetchConversations(searchQuery, pageParam, perPage, token ?? ''),
    {
      getNextPageParam: lastPage => {
        const maxPage = Math.ceil(lastPage.total / lastPage.per_page);
        return lastPage.page < maxPage ? lastPage.page + 1 : undefined;
      }
    }
  );

  const threads: ConversationThread[] =
    data?.pages.flatMap(page => page.threads) ?? [];

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      },
      { root: null, rootMargin: '0px', threshold: 1.0 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMoreRef.current, hasNextPage, fetchNextPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (inputValue) params.set('search', inputValue);
    if (perPage) params.set('per_page', perPage.toString());
    setSearchParams(params);
  };

  return (
    <>
      <div className="p-4 max-w-3xl mx-auto">
        <form onSubmit={handleSearchSubmit} className="mb-4 flex">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Search conversations"
            className="flex-1 border border-gray-300 rounded-l px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-r hover:bg-blue-600"
          >
            Search
          </button>
        </form>

        {isLoading ? (
          <div className="text-center text-gray-500">Loading...</div>
        ) : isError ? (
          <div className="text-center text-red-500">
            Error loading conversations: {error.message}
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center text-gray-500">
            No conversations found.
          </div>
        ) : (
          <div>
            {threads.map(thread => (
              <div
                key={thread.threadUid}
                onClick={() => navigate(`/messages/${thread.threadUid}`)}
                className="cursor-pointer hover:bg-gray-100 p-4 flex items-start border-b"
              >
                <img
                  src={thread.otherUser.profilePicUrl}
                  alt={thread.otherUser.displayName}
                  className="w-12 h-12 rounded-full mr-4 flex-shrink-0"
                />
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-800">
                      {thread.otherUser.displayName}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(thread.lastActivityAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <div className="flex items-center">
                      <img
                        src={thread.listingThumbnailUrl}
                        alt={thread.listingTitle}
                        className="w-10 h-10 object-cover mr-2 rounded"
                      />
                      <span className="text-sm text-gray-700 truncate">
                        {thread.listingTitle}
                      </span>
                    </div>
                    {thread.unreadCount > 0 && (
                      <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-600 text-sm mt-2 truncate">
                    {thread.lastMessageSnippet}
                  </div>
                </div>
              </div>
            ))}

            <div ref={loadMoreRef}></div>
            {isFetchingNextPage && (
              <div className="text-center text-gray-500 py-2">
                Loading more...
              </div>
            )}
            {!hasNextPage && (
              <div className="text-center text-gray-500 py-2">
                No more conversations.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default UV_MessagesList;