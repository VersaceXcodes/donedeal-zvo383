import React from 'react';
import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

interface UV_DeleteConfirmationModalProps {
  /** UID of the listing to delete */
  listingUid: string;
  /** Callback to close the modal */
  onCancel: () => void;
}

const UV_DeleteConfirmationModal: React.FC<UV_DeleteConfirmationModalProps> = ({
  listingUid,
  onCancel
}) => {
  const token = useAppStore(state => state.auth.token);
  const addToast = useAppStore(state => state.add_toast);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation<void, Error>(
    async () => {
      if (!token) {
        throw new Error('You must be logged in to delete a listing.');
      }
      const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      await axios.delete(
        `${base}/api/listings/${listingUid}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
    },
    {
      onSuccess: () => {
        // Invalidate any listing queries so parent views refresh
        queryClient.invalidateQueries({ queryKey: ['listings'] });
        queryClient.invalidateQueries({ queryKey: ['listing', listingUid] });
        addToast({
          id: Date.now().toString(),
          type: 'success',
          message: 'Listing deleted successfully.'
        });
        onCancel();
      },
      onError: (error: Error) => {
        addToast({
          id: Date.now().toString(),
          type: 'error',
          message: error.message || 'Failed to delete listing.'
        });
      }
    }
  );

  const { mutate: onConfirmDelete, isLoading: isDeleting } = deleteMutation;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40"></div>

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-11/12 p-6 mx-4">
          <div className="flex flex-col items-center">
            {/* Warning Icon */}
            <svg
              className="h-12 w-12 text-red-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"
              />
            </svg>

            {/* Title */}
            <h2 className="mt-4 text-xl font-semibold text-gray-800">
              Confirm Delete
            </h2>

            {/* Description */}
            <p className="mt-2 text-center text-gray-600">
              Are you sure you want to delete this listing? This action is
              irreversible.
            </p>

            {/* Buttons */}
            <div className="mt-6 flex space-x-4">
              <button
                onClick={() => onConfirmDelete()}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Confirm Delete'}
              </button>
              <button
                onClick={onCancel}
                disabled={isDeleting}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_DeleteConfirmationModal;