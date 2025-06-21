import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Link, useSearchParams } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface Draft {
  uid: string;
  title: string;
  thumbnailUrl: string;
  lastUpdated: string;
}

interface FetchDraftsResponse {
  drafts: Array<{
    uid: string;
    title: string;
    thumbnail_url: string;
    last_updated: string;
  }>;
  page: number;
  per_page: number;
  total: number;
}

const fetchDrafts = async (
  page: number,
  perPage: number,
  token: string
): Promise<{ drafts: Draft[]; page: number; perPage: number; total: number }> => {
  const { data } = await axios.get<FetchDraftsResponse>(
    `${API_BASE_URL}/api/users/me/drafts?page=${page}&per_page=${perPage}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return {
    drafts: data.drafts.map(d => ({
      uid: d.uid,
      title: d.title,
      thumbnailUrl: d.thumbnail_url,
      lastUpdated: d.last_updated
    })),
    page: data.page,
    perPage: data.per_page,
    total: data.total
  };
};

const deleteDraft = async (uid: string, token: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/api/listings/${uid}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

const UV_ProfileDrafts: React.FC = () => {
  const token = useAppStore(state => state.auth.token);
  const addToast = useAppStore(state => state.add_toast);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('per_page') || '20', 10);

  const {
    data,
    isLoading,
    isError,
    error
  } = useQuery<{ drafts: Draft[]; page: number; perPage: number; total: number }, Error>(
    ['profileDrafts', page, perPage],
    () => fetchDrafts(page, perPage, token!),
    { enabled: !!token }
  );

  const mutation = useMutation<void, Error, string>({
    mutationFn: uid => deleteDraft(uid, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profileDrafts'] });
      addToast({
        id: `${Date.now()}`,
        type: 'success',
        message: 'Draft deleted successfully.'
      });
    },
    onError: err => {
      addToast({
        id: `${Date.now()}`,
        type: 'error',
        message: err.message || 'Failed to delete draft.'
      });
    }
  });

  const totalPages = data ? Math.ceil(data.total / data.perPage) : 1;

  return (
    <>
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold">My Draft Listings</h1>
          <Link
            to="/listings/new/step1"
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2 rounded"
          >
            Create New Listing
          </Link>
        </div>

        {isLoading && <p>Loading drafts...</p>}
        {isError && <p className="text-red-500">Error: {error.message}</p>}

        {!isLoading && data && data.drafts.length === 0 && (
          <p>No drafts found. Click "Create New Listing" to get started.</p>
        )}

        {!isLoading && data && data.drafts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.drafts.map(draft => (
              <div key={draft.uid} className="border rounded shadow p-4 relative">
                <span className="absolute top-2 left-2 bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded">
                  Draft
                </span>
                <img
                  src={draft.thumbnailUrl}
                  alt={draft.title}
                  className="w-full h-40 object-cover rounded mb-2"
                />
                <h2 className="font-semibold text-lg mb-1">{draft.title}</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Last edited: {new Date(draft.lastUpdated).toLocaleString()}
                </p>
                <div className="flex space-x-2">
                  <Link
                    to={`/listings/${draft.uid}/edit/step1`}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white text-center px-3 py-2 rounded"
                  >
                    Edit Draft
                  </Link>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          'Are you sure you want to delete this draft?'
                        )
                      ) {
                        mutation.mutate(draft.uid);
                      }
                    }}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && data && data.drafts.length > 0 && (
          <div className="flex justify-between items-center mt-6">
            <Link
              to={`/profile/me/drafts?page=${Math.max(page - 1, 1)}&per_page=${perPage}`}
              className={`px-4 py-2 rounded ${
                page <= 1
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              Previous
            </Link>
            <span>
              Page {page} of {totalPages}
            </span>
            <Link
              to={`/profile/me/drafts?page=${Math.min(page + 1, totalPages)}&per_page=${perPage}`}
              className={`px-4 py-2 rounded ${
                page >= totalPages
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              Next
            </Link>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_ProfileDrafts;