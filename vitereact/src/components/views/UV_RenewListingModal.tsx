import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore, Toast } from '@/store/main';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface UV_RenewListingModalProps {
  listingUid: string;
  currentExpirationDate: string; // ISO string
  onClose: () => void;
  onSuccess: (newExpiresAt: string) => void;
  isDailyLimitReached?: boolean;
}

interface RenewListingRequest {
  selected_duration: number;
}

interface RenewListingResponse {
  expires_at: string;
}

const UV_RenewListingModal: React.FC<UV_RenewListingModalProps> = ({
  listingUid,
  currentExpirationDate,
  onClose,
  onSuccess,
  isDailyLimitReached = false
}) => {
  const token = useAppStore(state => state.auth.token);
  const addToast = useAppStore(state => state.add_toast);
  const queryClient = useQueryClient();

  const [selectedDuration, setSelectedDuration] = useState<number>(30);

  const renewMutation = useMutation<RenewListingResponse, Error, RenewListingRequest>(
    (body) =>
      axios
        .post<RenewListingResponse>(
          `${API_BASE_URL}/api/listings/${listingUid}/renew`,
          body,
          {
            headers: {
              Authorization: token ? `Bearer ${token}` : ''
            }
          }
        )
        .then((res) => res.data),
    {
      onSuccess: (data) => {
        // update parent UI
        onSuccess(data.expires_at);
        // invalidate listing query cache
        queryClient.invalidateQueries({ queryKey: ['listing', listingUid] });
        // close modal
        onClose();
        // show toast
        const toast: Toast = {
          id: Date.now().toString(),
          type: 'success',
          message: 'Listing renewed successfully'
        };
        addToast(toast);
      },
      onError: (err) => {
        const toast: Toast = {
          id: Date.now().toString(),
          type: 'error',
          message: err.message || 'Failed to renew listing'
        };
        addToast(toast);
      }
    }
  );

  const onConfirmRenew = () => {
    renewMutation.mutate({ selected_duration: selectedDuration });
  };

  const onDurationChange = (duration: number) => {
    setSelectedDuration(duration);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg w-11/12 max-w-md p-6">
          <h2 className="text-xl font-semibold mb-4">Renew Listing</h2>
          <p className="mb-2">
            Current Expiration:{' '}
            <span className="font-medium">
              {new Date(currentExpirationDate).toLocaleDateString()}
            </span>
          </p>
          <div className="mb-4">
            <label className="block mb-2 font-medium">Extend by:</label>
            <div className="flex space-x-4">
              {[30, 60, 90].map((d) => (
                <label key={d} className="inline-flex items-center">
                  <input
                    type="radio"
                    name="renew_duration"
                    value={d}
                    checked={selectedDuration === d}
                    onChange={() => onDurationChange(d)}
                    className="form-radio h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2">{d} days</span>
                </label>
              ))}
            </div>
          </div>
          {isDailyLimitReached && (
            <p className="text-sm text-red-600 mb-4">
              You have reached your daily listing renewal limit.
            </p>
          )}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              disabled={renewMutation.isLoading}
            >
              Cancel
            </button>
            <button
              onClick={onConfirmRenew}
              className={`px-4 py-2 rounded text-white ${
                isDailyLimitReached || renewMutation.isLoading
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
              disabled={isDailyLimitReached || renewMutation.isLoading}
            >
              {renewMutation.isLoading ? 'Renewing...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_RenewListingModal;