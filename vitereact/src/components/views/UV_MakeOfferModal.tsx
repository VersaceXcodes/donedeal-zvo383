import React, { useState } from 'react';
import axios, { AxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

interface Listing {
  uid: string;
  title: string;
  thumbnailUrl: string;
  price: number;
}

interface UV_MakeOfferModalProps {
  listing: Listing;
  counterOfferUid?: string | null;
  onClose: () => void;
  onOfferSent?: () => void;
}

interface OfferRequestPayload {
  listing_uid: string;
  amount: number;
  message?: string;
  type: 'offer';
  counter_offer_uid?: string | null;
}

interface OfferResponse {
  id: string;
  listing_uid: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: string;
  message?: string;
  created_at: string;
  updated_at: string;
}

const UV_MakeOfferModal: React.FC<UV_MakeOfferModalProps> = ({
  listing,
  counterOfferUid = null,
  onClose,
  onOfferSent
}) => {
  const token = useAppStore(state => state.auth.token);
  const addToast = useAppStore(state => state.add_toast);

  const [amount, setAmount] = useState<number>(listing.price);
  const [message, setMessage] = useState<string>('');
  const [errors, setErrors] = useState<{ amount?: string; message?: string }>({});

  const makeOffer = async (payload: OfferRequestPayload): Promise<OfferResponse> => {
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const response = await axios.post<OfferResponse>(
      `${base}/api/offers`,
      payload,
      {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      }
    );
    return response.data;
  };

  const mutation = useMutation<OfferResponse, AxiosError, OfferRequestPayload>(makeOffer, {
    onSuccess: () => {
      const toastId = `offer-success-${Date.now()}`;
      addToast({ id: toastId, type: 'success', message: 'Offer sent successfully.' });
      if (onOfferSent) {
        onOfferSent();
      }
      onClose();
    },
    onError: (error) => {
      const toastId = `offer-error-${Date.now()}`;
      addToast({ id: toastId, type: 'error', message: error.message || 'Failed to send offer.' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { amount?: string; message?: string } = {};
    if (amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (amount > 1_000_000) {
      newErrors.amount = 'Amount must be at most 1,000,000';
    }
    if (message.length > 500) {
      newErrors.message = 'Message must be 500 characters or fewer';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    mutation.mutate({
      listing_uid: listing.uid,
      amount,
      message: message.trim() || undefined,
      type: 'offer',
      counter_offer_uid: counterOfferUid || undefined
    });
  };

  const isSubmitting = mutation.isLoading;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg w-full max-w-md p-6">
          <h2 className="text-xl font-semibold mb-4">Make Offer</h2>
          <div className="flex items-center mb-4">
            <img
              src={listing.thumbnailUrl}
              alt={listing.title}
              className="w-16 h-16 object-cover rounded mr-4"
            />
            <div className="text-lg font-medium">{listing.title}</div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="amount" className="block text-sm font-medium mb-1">
                Offer Amount
              </label>
              <input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value))}
                disabled={isSubmitting}
                className={`mt-1 block w-full px-3 py-2 border rounded ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.amount && (
                <p className="text-red-500 text-sm mt-1">{errors.amount}</p>
              )}
            </div>
            <div className="mb-4">
              <label htmlFor="message" className="block text-sm font-medium mb-1">
                Message (optional)
              </label>
              <textarea
                id="message"
                rows={4}
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isSubmitting}
                className={`mt-1 block w-full px-3 py-2 border rounded ${
                  errors.message ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <div className="flex justify-between text-sm mt-1">
                <p className="text-gray-500">{message.length}/500</p>
                {errors.message && (
                  <p className="text-red-500">{errors.message}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded mr-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 flex items-center"
              >
                {isSubmitting && (
                  <svg
                    className="animate-spin mr-2 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                )}
                Send Offer
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default UV_MakeOfferModal;