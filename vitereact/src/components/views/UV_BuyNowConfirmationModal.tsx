import React, { useState } from 'react';
import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import { useNavigate } from 'react-router-dom';

interface ListingProp {
  uid: string;
  title: string;
  price: number;
}

interface UV_BuyNowConfirmationModalProps {
  listing: ListingProp;
  onCancel: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const UV_BuyNowConfirmationModal: React.FC<UV_BuyNowConfirmationModalProps> = ({
  listing,
  onCancel,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authToken = useAppStore(state => state.auth.token);
  const addToast = useAppStore(state => state.add_toast);

  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!authToken) {
        throw new Error('User not authenticated');
      }
      await axios.post(
        `${API_BASE_URL}/api/offers`,
        {
          listing_uid: listing.uid,
          amount: listing.price,
          type: 'buy_now',
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
    },
    onSuccess: () => {
      // Invalidate or update the listing in cache to mark as sold
      queryClient.invalidateQueries(['listing', listing.uid]);
      // Show success toast
      const toastId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
      addToast({
        id: toastId,
        type: 'success',
        message: 'Purchase successful! Your item is reserved.',
      });
      // Navigate to Transactions list
      navigate('/profile/me/transactions');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to complete purchase');
    },
  });

  const handleConfirm = () => {
    setError(null);
    mutation.mutate();
  };

  const isSubmitting = mutation.isLoading;

  if (!listing) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        {/* Modal */}
        <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
          <h2 className="text-xl font-semibold mb-4">Confirm Purchase</h2>
          <p className="mb-6">
            Confirm purchase of{' '}
            <span className="font-medium">&quot;{listing.title}&quot;</span> for{' '}
            <span className="font-medium">${listing.price.toFixed(2)}</span>?
          </p>
          {error && <p className="text-red-600 mb-4">{error}</p>}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : 'Confirm Purchase'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_BuyNowConfirmationModal;