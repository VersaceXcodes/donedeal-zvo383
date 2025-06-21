import React, { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

interface ListingDetail {
  uid: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  negotiable: boolean;
  condition: string;
  createdAt: string;
  expiresAt: string;
  favoritesCount: number;
  viewsCount: number;
  category_uid: string;
  status: 'draft'|'pending'|'active'|'sold'|'expired'|'archived';
}

interface ListingImage {
  uid: string;
  url: string;
  sortOrder: number;
}

interface SellerInfo {
  uid: string;
  displayName: string;
  profilePicUrl: string;
  memberSince: string;
  location: string;
  listingsCount: number;
}

interface ListingApiResponse {
  listing: ListingDetail;
  images: ListingImage[];
  seller: SellerInfo;
  isFavorited: boolean;
  isOwner: boolean;
  offersCount: number;
}

const UV_ListingDetail: React.FC = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useAppStore(state => state.auth.token);
  const isAuthenticated = useAppStore(state => state.auth.is_authenticated);
  const addToast = useAppStore(state => state.add_toast);

  // Axios instance with auth header
  const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  // Fetch listing detail
  const { data, isLoading, isError, error } = useQuery<ListingApiResponse, Error>(
    ['listing', listingId],
    async () => {
      const { data } = await axiosInstance.get<ListingApiResponse>(`/api/listings/${listingId}`);
      return data;
    },
    { enabled: !!listingId }
  );

  // Related listings by category
  const { data: related, isLoading: relatedLoading } = useQuery<ListingDetail[], Error>(
    ['relatedListings', listingId],
    async () => {
      if (!data) return [];
      const { data: arr } = await axiosInstance.get<ListingDetail[]>(
        `/api/listings?category_uid=${data.listing.category_uid}&per_page=6`
      );
      return arr.filter(l => l.uid !== listingId);
    },
    { enabled: !!data }
  );

  // Mutations
  const toggleFavorite = useMutation(
    async () => {
      if (!data) return;
      const url = `/api/listings/${listingId}/favorite`;
      return data.isFavorited
        ? axiosInstance.delete(url)
        : axiosInstance.post(url);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['listing', listingId]);
      },
      onError: (err: any) => {
        addToast({ id: `${Date.now()}`, type: 'error', message: err.message });
      }
    }
  );

  const markSold = useMutation(
    () => axiosInstance.post(`/api/listings/${listingId}/mark-sold`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['listing', listingId]);
        addToast({ id: `${Date.now()}`, type: 'success', message: 'Marked as sold' });
      },
      onError: (err: any) => {
        addToast({ id: `${Date.now()}`, type: 'error', message: err.message });
      }
    }
  );

  const deleteListing = useMutation(
    () => axiosInstance.delete(`/api/listings/${listingId}`),
    {
      onSuccess: () => {
        addToast({ id: `${Date.now()}`, type: 'success', message: 'Listing deleted' });
        navigate('/profile/me/listings');
      },
      onError: (err: any) => {
        addToast({ id: `${Date.now()}`, type: 'error', message: err.message });
      }
    }
  );

  const renewListing = useMutation(
    (duration: number) => axiosInstance.post(`/api/listings/${listingId}/renew`, { duration }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['listing', listingId]);
        addToast({ id: `${Date.now()}`, type: 'success', message: 'Listing renewed' });
        setShowRenewModal(false);
      },
      onError: (err: any) => {
        addToast({ id: `${Date.now()}`, type: 'error', message: err.message });
      }
    }
  );

  const makeOffer = useMutation(
    (payload: { amount: number; message: string; type: 'offer'|'buy_now' }) =>
      axiosInstance.post('/api/offers', { listing_uid: listingId, ...payload }),
    {
      onSuccess: (_, vars) => {
        addToast({
          id: `${Date.now()}`,
          type: 'success',
          message: vars.type === 'offer' ? 'Offer sent' : 'Purchase successful'
        });
        setShowMakeOfferModal(false);
        setShowBuyNowModal(false);
        if (vars.type === 'buy_now') {
          navigate('/profile/me/transactions');
        }
        queryClient.invalidateQueries(['listing', listingId]);
      },
      onError: (err: any) => {
        addToast({ id: `${Date.now()}`, type: 'error', message: err.message });
      }
    }
  );

  // UI state
  const [currentImage, setCurrentImage] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewDuration, setRenewDuration] = useState(30);
  const [showMakeOfferModal, setShowMakeOfferModal] = useState(false);
  const [showBuyNowModal, setShowBuyNowModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState<number>(data?.listing.price || 0);
  const [offerMessage, setOfferMessage] = useState('');

  const isOwner = data?.isOwner;

  // Handlers
  const handlePrev = () => {
    if (!data) return;
    setCurrentImage(i => (i === 0 ? data.images.length - 1 : i - 1));
  };
  const handleNext = () => {
    if (!data) return;
    setCurrentImage(i => (i === data.images.length - 1 ? 0 : i + 1));
  };
  const onTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (diff > 50) handleNext();
    else if (diff < -50) handlePrev();
    setTouchStartX(null);
  };
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  // Render
  if (isLoading) {
    return <> <div className="p-4 text-center">Loading listing...</div> </>;
  }
  if (isError) {
    return <> <div className="p-4 text-center text-red-600">{error?.message}</div> </>;
  }
  if (!data) {
    return <> <div className="p-4 text-center">No data</div> </>;
  }

  const { listing, images, seller, isFavorited, offersCount } = data;

  return (
    <>
      <div className="max-w-7xl mx-auto p-4 lg:flex lg:gap-8">
        {/* Carousel */}
        <div
          className="relative lg:w-2/3 w-full"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <img
            src={images[currentImage]?.url}
            alt={`Image ${currentImage + 1}`}
            className="w-full h-96 object-cover rounded"
            loading="lazy"
          />
          <button
            onClick={handlePrev}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-75 p-2 rounded-full"
          >
            ‹
          </button>
          <button
            onClick={handleNext}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-75 p-2 rounded-full"
          >
            ›
          </button>
          <div className="mt-2 flex overflow-x-auto space-x-2">
            {images.map((img, idx) => (
              <img
                key={img.uid}
                src={img.url}
                alt={`Thumb ${idx + 1}`}
                className={`w-20 h-20 object-cover rounded cursor-pointer ${
                  idx === currentImage ? 'ring-2 ring-blue-500' : ''
                }`}
                loading="lazy"
                onClick={() => setCurrentImage(idx)}
              />
            ))}
          </div>
        </div>

        {/* Info & Actions */}
        <div className="lg:w-1/3 w-full space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">{listing.title}</h1>
            <div className="text-2xl font-bold">
              {listing.currency} {listing.price.toFixed(2)}
            </div>
            <div className="mt-2 space-x-2">
              {listing.negotiable && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  Negotiable
                </span>
              )}
              <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">
                {listing.condition}
              </span>
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Posted {formatDate(listing.createdAt)}
            </div>
          </div>
          <div className="text-gray-700 whitespace-pre-wrap">
            {listing.description}
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              (listing as any).tags ||
              []
            ).map((tag: string) => (
              <span
                key={tag}
                className="px-2 py-1 bg-gray-200 text-gray-800 rounded"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Seller Card */}
          <div className="p-4 border rounded space-y-2">
            <img
              src={seller.profilePicUrl}
              alt={seller.displayName}
              className="w-16 h-16 rounded-full object-cover"
            />
            <div>
              <Link
                to={`/profile/${seller.uid}`}
                className="text-lg font-medium text-blue-600"
              >
                {seller.displayName}
              </Link>
            </div>
            <div className="text-sm text-gray-500">
              Member since {formatDate(seller.memberSince)}
            </div>
            <div className="text-sm text-gray-500">{seller.location}</div>
            <div className="text-sm text-gray-500">
              {seller.listingsCount} listings
            </div>
            <Link
              to={`/profile/${seller.uid}`}
              className="text-blue-600 underline text-sm"
            >
              View Profile
            </Link>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {!isOwner && (
              <>
                <button
                  onClick={() => toggleFavorite.mutate()}
                  className="w-full px-4 py-2 bg-white border rounded hover:bg-gray-50"
                >
                  {isFavorited ? 'Unfavorite' : 'Favorite'} (
                  {listing.favoritesCount})
                </button>
                {listing.negotiable && (
                  <button
                    onClick={() => {
                      setOfferAmount(listing.price);
                      setShowMakeOfferModal(true);
                    }}
                    disabled={!isAuthenticated}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                  >
                    Make Offer
                  </button>
                )}
                {!listing.negotiable && (
                  <button
                    onClick={() => setShowBuyNowModal(true)}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded"
                  >
                    Buy Now
                  </button>
                )}
              </>
            )}
            {isOwner && (
              <>
                <button
                  onClick={() =>
                    navigate(`/listings/${listingId}/edit/step1`)
                  }
                  className="w-full px-4 py-2 bg-yellow-500 text-white rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded"
                >
                  Delete
                </button>
                <button
                  onClick={() => markSold.mutate()}
                  disabled={listing.status === 'sold'}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
                >
                  Mark as Sold
                </button>
                <button
                  onClick={() => setShowRenewModal(true)}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded"
                >
                  Renew
                </button>
                <Link
                  to="/profile/me/offers"
                  className="w-full block text-center px-4 py-2 bg-gray-800 text-white rounded"
                >
                  View Offers ({offersCount})
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Related Listings */}
      <div className="max-w-7xl mx-auto p-4">
        <h2 className="text-xl font-semibold mb-4">Related Listings</h2>
        {relatedLoading ? (
          <div>Loading...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {related?.map(item => (
              <Link
                key={item.uid}
                to={`/listings/${item.uid}`}
                className="border rounded overflow-hidden hover:shadow"
              >
                <img
                  src={item.viewsCount && item.viewsCount > 0 ? item.viewsCount as any : '/'}
                  alt={item.title}
                  className="w-full h-40 object-cover"
                  loading="lazy"
                />
                <div className="p-2">
                  <h3 className="text-sm font-medium">{item.title}</h3>
                  <div className="text-sm font-bold">
                    {item.currency} {item.price.toFixed(2)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p>Are you sure you want to delete this listing?</p>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteListing.mutate()}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {showRenewModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-4">Renew Listing</h3>
            <label className="block mb-2">Select Duration (days):</label>
            <select
              value={renewDuration}
              onChange={e => setRenewDuration(Number(e.target.value))}
              className="w-full border px-3 py-2 rounded mb-4"
            >
              {[30, 60, 90].map(d => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowRenewModal(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => renewListing.mutate(renewDuration)}
                className="px-4 py-2 bg-purple-600 text-white rounded"
              >
                Renew
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Make Offer Modal */}
      {showMakeOfferModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Make an Offer</h3>
            <label className="block mb-2">Offer Amount:</label>
            <input
              type="number"
              value={offerAmount}
              onChange={e => setOfferAmount(Number(e.target.value))}
              className="w-full border px-3 py-2 rounded mb-4"
            />
            <label className="block mb-2">Message (optional):</label>
            <textarea
              value={offerMessage}
              onChange={e => setOfferMessage(e.target.value)}
              className="w-full border px-3 py-2 rounded mb-4"
              rows={3}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowMakeOfferModal(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  makeOffer.mutate({ amount: offerAmount, message: offerMessage, type: 'offer' })
                }
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Send Offer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buy Now Modal */}
      {showBuyNowModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Purchase</h3>
            <p className="mb-4">
              Purchase for {listing.currency} {listing.price.toFixed(2)}?
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowBuyNowModal(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => makeOffer.mutate({ amount: listing.price, message: '', type: 'buy_now' })}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_ListingDetail;