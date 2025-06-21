import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

interface ListingImage {
  uid: string;
  url: string;
  sort_order: number;
}

interface SellerSnippet {
  uid: string;
  display_name: string;
  profile_pic_url?: string;
  member_since: string;
  listings_count: number;
}

interface ListingDetail {
  uid: string;
  title: string;
  description: string;
  categoryUid: string;
  condition: string;
  price: number;
  currency: string;
  negotiable: boolean;
  location: string;
  locationLat: number;
  locationLng: number;
  status: string;
  created_at: string;
  expires_at: string;
  images: ListingImage[];
  seller: SellerSnippet;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const UV_AdminListingDetail: React.FC = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const token = useAppStore(state => state.auth.token);
  const userRole = useAppStore(state => state.auth.user?.role);
  const addToast = useAppStore(state => state.add_toast);
  const queryClient = useQueryClient();

  // Redirect non-admins
  useEffect(() => {
    if (userRole !== 'admin') {
      navigate('/admin/login', { replace: true });
    }
  }, [userRole, navigate]);

  // Fetch listing detail
  const {
    data: listing,
    isLoading,
    isError,
    error
  } = useQuery<ListingDetail, Error>(
    ['adminListing', listingId],
    async () => {
      if (!listingId || !token) throw new Error('Unauthorized or missing listingId');
      const { data } = await axios.get(
        `${BASE_URL}/api/admin/listings/${listingId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data as ListingDetail;
    },
    { enabled: !!listingId && !!token }
  );

  // Approve mutation
  const approveMutation = useMutation<void, Error>(
    async () => {
      if (!listingId || !token) throw new Error('Unauthorized');
      await axios.put(
        `${BASE_URL}/api/admin/listings/${listingId}/status`,
        { action: 'approve' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    {
      onSuccess: () => {
        addToast({ id: Date.now().toString(), type: 'success', message: 'Listing approved' });
        navigate('/admin/listings');
      },
      onError: (err) => {
        addToast({ id: Date.now().toString(), type: 'error', message: err.message });
      }
    }
  );

  // Remove mutation
  const removeMutation = useMutation<void, Error>(
    async () => {
      if (!listingId || !token) throw new Error('Unauthorized');
      await axios.put(
        `${BASE_URL}/api/admin/listings/${listingId}/status`,
        { action: 'remove' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    {
      onSuccess: () => {
        addToast({ id: Date.now().toString(), type: 'success', message: 'Listing removed' });
        navigate('/admin/listings');
      },
      onError: (err) => {
        addToast({ id: Date.now().toString(), type: 'error', message: err.message });
      }
    }
  );

  // Reject mutation
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const confirmRejectMutation = useMutation<void, Error, string>(
    async (reason) => {
      if (!listingId || !token) throw new Error('Unauthorized');
      await axios.put(
        `${BASE_URL}/api/admin/listings/${listingId}/status`,
        { action: 'reject', reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    {
      onSuccess: () => {
        addToast({ id: Date.now().toString(), type: 'success', message: 'Listing rejected' });
        setIsRejectModalOpen(false);
        navigate('/admin/listings');
      },
      onError: (err) => {
        setRejectError(err.message);
        addToast({ id: Date.now().toString(), type: 'error', message: err.message });
      }
    }
  );

  // Carousel state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }
  if (isError) {
    return <div className="p-4 text-red-600">Error: {error?.message}</div>;
  }
  if (!listing) {
    return <div className="p-4">Listing not found</div>;
  }

  const sortedImages = [...listing.images].sort((a, b) => a.sort_order - b.sort_order);
  const prevImage = () =>
    setCurrentImageIndex(i => (i === 0 ? sortedImages.length - 1 : i - 1));
  const nextImage = () =>
    setCurrentImageIndex(i => (i === sortedImages.length - 1 ? 0 : i + 1));

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <Link to="/admin/listings" className="text-blue-600 hover:underline">
          ← Back to Listings
        </Link>
        <div>
          <button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isLoading}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded mr-2"
          >
            Approve
          </button>
          <button
            onClick={() => {
              setRejectReason('');
              setRejectError('');
              setIsRejectModalOpen(true);
            }}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded mr-2"
          >
            Reject
          </button>
          <button
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isLoading}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Image Carousel */}
        <div>
          <div className="relative w-full h-80 bg-gray-100 flex items-center justify-center">
            <button
              onClick={prevImage}
              className="absolute left-2 bg-gray-800 bg-opacity-50 text-white p-2 rounded-full"
            >
              ‹
            </button>
            {sortedImages.length > 0 ? (
              <img
                src={sortedImages[currentImageIndex].url}
                alt={`Image ${currentImageIndex + 1}`}
                className="object-contain h-full"
              />
            ) : (
              <div>No images</div>
            )}
            <button
              onClick={nextImage}
              className="absolute right-2 bg-gray-800 bg-opacity-50 text-white p-2 rounded-full"
            >
              ›
            </button>
          </div>
          <div className="flex justify-center mt-2 space-x-2 overflow-x-auto">
            {sortedImages.map((img, idx) => (
              <img
                key={img.uid}
                src={img.url}
                alt={`Thumbnail ${idx + 1}`}
                className={`w-16 h-16 object-cover rounded cursor-pointer border ${
                  idx === currentImageIndex ? 'border-blue-500' : 'border-transparent'
                }`}
                onClick={() => setCurrentImageIndex(idx)}
              />
            ))}
          </div>
        </div>

        {/* Listing Info & Seller */}
        <div>
          <h1 className="text-2xl font-semibold mb-2">{listing.title}</h1>
          <p className="mb-4 text-gray-700">{listing.description}</p>
          <div className="space-y-2 mb-4">
            <div>
              <span className="font-semibold">Category:</span> {listing.categoryUid}
            </div>
            <div>
              <span className="font-semibold">Condition:</span> {listing.condition}
            </div>
            <div>
              <span className="font-semibold">Price:</span> {listing.currency}
              {listing.price.toFixed(2)}{' '}
              {listing.negotiable && (
                <span className="text-sm italic ml-1">(Negotiable)</span>
              )}
            </div>
            <div>
              <span className="font-semibold">Location:</span> {listing.location}
            </div>
            <div>
              <span className="font-semibold">Created At:</span>{' '}
              {new Date(listing.created_at).toLocaleString()}
            </div>
            <div>
              <span className="font-semibold">Expires At:</span>{' '}
              {new Date(listing.expires_at).toLocaleString()}
            </div>
          </div>

          <div className="border-t border-gray-200 my-4"></div>

          <h2 className="text-xl font-semibold mb-3">Seller Information</h2>
          <div className="flex items-center space-x-4">
            <img
              src={
                listing.seller.profile_pic_url ||
                `https://picsum.photos/seed/${listing.seller.uid}/100/100`
              }
              alt="Seller Avatar"
              className="w-16 h-16 rounded-full object-cover"
            />
            <div>
              <Link
                to={`/admin/users/${listing.seller.uid}`}
                className="text-blue-600 hover:underline font-semibold"
              >
                {listing.seller.display_name}
              </Link>
              <div className="text-sm text-gray-600">
                Member since:{' '}
                {new Date(listing.seller.member_since).toLocaleDateString()}
              </div>
              <div className="text-sm text-gray-600">
                Listings: {listing.seller.listings_count}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Reject Listing</h3>
            <textarea
              value={rejectReason}
              onChange={e => {
                setRejectReason(e.target.value);
                setRejectError('');
              }}
              placeholder="Enter rejection reason"
              className="w-full border border-gray-300 rounded p-2 mb-2"
              rows={3}
            />
            {rejectError && (
              <p className="text-red-500 mb-2">{rejectError}</p>
            )}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!rejectReason.trim()) {
                    setRejectError('Reason is required');
                    return;
                  }
                  confirmRejectMutation.mutate(rejectReason.trim());
                }}
                disabled={confirmRejectMutation.isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_AdminListingDetail;