import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

interface Counterparty {
  uid: string;
  displayName: string;
  profilePicUrl: string;
}

type OfferStatus = 'pending' | 'accepted' | 'declined' | 'countered' | 'sold';

interface Offer {
  uid: string;
  listingUid: string;
  listingTitle: string;
  listingThumbnailUrl: string;
  counterparty: Counterparty;
  amount: number;
  currency: string;
  status: OfferStatus;
  createdAt: string;
}

interface OffersResponse {
  offers: Offer[];
  total: number;
}

interface NewOfferPayload {
  listing_uid: string;
  amount: number;
  message?: string;
  type: 'offer';
  counter_offer_uid?: string;
}

const UV_ProfileOffers: React.FC = () => {
  // URL filters & pagination
  const [searchParams, setSearchParams] = useSearchParams();
  const typeParam = searchParams.get('type') || 'incoming';
  const statusParam = searchParams.get('status') || 'pending';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const perPageParam = parseInt(searchParams.get('per_page') || '20', 10);

  // Global state
  const token = useAppStore(state => state.auth.token);
  const socket = useAppStore(state => state.socket);
  const addToast = useAppStore(state => state.add_toast);

  const queryClient = useQueryClient();

  // Fetch offers
  const fetchOffers = async (): Promise<OffersResponse> => {
    if (!token) throw new Error('Not authenticated');
    const { data } = await axios.get<OffersResponse>(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/me/offers`,
      {
        params: {
          type: typeParam,
          status: statusParam,
          page: pageParam,
          per_page: perPageParam
        },
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return data;
  };

  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery<OffersResponse, Error>(
    ['offers', typeParam, statusParam, pageParam, perPageParam],
    fetchOffers,
    { keepPreviousData: true }
  );

  // Mutations: Accept & Decline
  const acceptMutation = useMutation<void, Error, string>(
    async (offerUid) => {
      if (!token) throw new Error('Not authenticated');
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/offers/${offerUid}`,
        { status: 'accepted' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['offers', typeParam, statusParam, pageParam, perPageParam]);
        addToast({
          id: Math.random().toString(),
          type: 'success',
          message: 'Offer accepted'
        });
      },
      onError: (err) => {
        addToast({
          id: Math.random().toString(),
          type: 'error',
          message: `Error accepting offer: ${err.message}`
        });
      }
    }
  );

  const declineMutation = useMutation<void, Error, string>(
    async (offerUid) => {
      if (!token) throw new Error('Not authenticated');
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/offers/${offerUid}`,
        { status: 'declined' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['offers', typeParam, statusParam, pageParam, perPageParam]);
        addToast({
          id: Math.random().toString(),
          type: 'success',
          message: 'Offer declined'
        });
      },
      onError: (err) => {
        addToast({
          id: Math.random().toString(),
          type: 'error',
          message: `Error declining offer: ${err.message}`
        });
      }
    }
  );

  // Counter-offer modal state
  const [showModal, setShowModal] = useState(false);
  const [modalOffer, setModalOffer] = useState<Offer | null>(null);
  const [modalAmount, setModalAmount] = useState<number>(0);
  const [modalMessage, setModalMessage] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);

  const makeOfferMutation = useMutation<void, Error, NewOfferPayload>(
    async (payload) => {
      if (!token) throw new Error('Not authenticated');
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/offers`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['offers', typeParam, statusParam, pageParam, perPageParam]);
        addToast({
          id: Math.random().toString(),
          type: 'success',
          message: 'Counter-offer sent'
        });
        setShowModal(false);
        setModalOffer(null);
        setModalAmount(0);
        setModalMessage('');
        setModalError(null);
      },
      onError: (err) => {
        setModalError(err.message);
      }
    }
  );

  // Real-time updates via WebSocket
  useEffect(() => {
    if (!socket) return;
    const handler = () => refetch();
    socket.on('offer:new', handler);
    return () => {
      socket.off('offer:new', handler);
    };
  }, [socket, refetch]);

  // Handlers for filter changes
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const np = new URLSearchParams(searchParams);
    np.set('type', e.target.value);
    np.set('page', '1');
    setSearchParams(np);
  };
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const np = new URLSearchParams(searchParams);
    np.set('status', e.target.value);
    np.set('page', '1');
    setSearchParams(np);
  };

  // Pagination
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / perPageParam);
  const goToPage = (newPage: number) => {
    const np = new URLSearchParams(searchParams);
    np.set('page', String(newPage));
    setSearchParams(np);
  };

  return (
    <>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">My Offers</h1>

        {/* Filters */}
        <div className="flex space-x-4 mb-4">
          <div>
            <label className="block text-sm font-medium">Type</label>
            <select
              value={typeParam}
              onChange={handleTypeChange}
              className="mt-1 block w-full border rounded p-2"
            >
              <option value="incoming">Incoming</option>
              <option value="outgoing">Outgoing</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Status</label>
            <select
              value={statusParam}
              onChange={handleStatusChange}
              className="mt-1 block w-full border rounded p-2"
            >
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
              <option value="countered">Countered</option>
              <option value="sold">Sold</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-8">Loading offers...</div>
        ) : isError ? (
          <div className="text-red-600">
            Error loading offers: {error?.message}
          </div>
        ) : (data?.offers.length || 0) === 0 ? (
          <div className="text-center py-8">No offers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left">Counterparty</th>
                  <th className="px-4 py-2 text-left">Listing</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data!.offers.map(offer => (
                  <tr key={offer.uid} className="border-t">
                    <td className="px-4 py-2 flex items-center space-x-2">
                      <img
                        src={offer.counterparty.profilePicUrl}
                        alt={offer.counterparty.displayName}
                        className="w-8 h-8 rounded-full"
                      />
                      <span>{offer.counterparty.displayName}</span>
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        to={`/listings/${offer.listingUid}`}
                        className="flex items-center space-x-2"
                      >
                        <img
                          src={offer.listingThumbnailUrl}
                          alt={offer.listingTitle}
                          className="w-12 h-12 object-cover rounded"
                        />
                        <span>{offer.listingTitle}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {new Intl.NumberFormat(undefined, {
                        style: 'currency',
                        currency: offer.currency
                      }).format(offer.amount)}
                    </td>
                    <td className="px-4 py-2">
                      {new Date(offer.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-1 rounded-full text-sm ${
                          offer.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : offer.status === 'accepted'
                            ? 'bg-green-100 text-green-800'
                            : offer.status === 'declined'
                            ? 'bg-red-100 text-red-800'
                            : offer.status === 'countered'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {offer.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center space-x-2">
                      {typeParam === 'incoming' && offer.status === 'pending' && (
                        <>
                          <button
                            onClick={() => acceptMutation.mutate(offer.uid)}
                            disabled={acceptMutation.isLoading}
                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => declineMutation.mutate(offer.uid)}
                            disabled={declineMutation.isLoading}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => {
                              setModalOffer(offer);
                              setModalAmount(offer.amount);
                              setModalMessage('');
                              setModalError(null);
                              setShowModal(true);
                            }}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                          >
                            Counter
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => goToPage(pageParam - 1)}
              disabled={pageParam <= 1}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span>
              Page {pageParam} of {totalPages}
            </span>
            <button
              onClick={() => goToPage(pageParam + 1)}
              disabled={pageParam >= totalPages}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Counter Offer Modal */}
      {showModal && modalOffer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              Counter Offer: {modalOffer.listingTitle}
            </h2>
            {modalError && (
              <div className="text-red-600 mb-2">{modalError}</div>
            )}
            <label className="block text-sm font-medium">Amount</label>
            <input
              type="number"
              value={modalAmount}
              onChange={e => setModalAmount(Number(e.target.value))}
              className="mt-1 block w-full border rounded p-2 mb-4"
            />
            <label className="block text-sm font-medium">Message (optional)</label>
            <textarea
              value={modalMessage}
              onChange={e => setModalMessage(e.target.value)}
              className="mt-1 block w-full border rounded p-2 mb-4"
              rows={3}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowModal(false);
                  setModalOffer(null);
                  setModalError(null);
                }}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (modalAmount <= 0) {
                    setModalError('Amount must be greater than zero');
                    return;
                  }
                  makeOfferMutation.mutate({
                    listing_uid: modalOffer.listingUid,
                    amount: modalAmount,
                    message: modalMessage,
                    type: 'offer',
                    counter_offer_uid: modalOffer.uid
                  });
                }}
                disabled={makeOfferMutation.isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                Send Offer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_ProfileOffers;