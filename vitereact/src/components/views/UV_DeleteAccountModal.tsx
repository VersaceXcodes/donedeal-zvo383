import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

interface DeleteAccountPayload {
  password: string;
  confirm: string;
}

interface ValidationErrorResponse {
  errors?: {
    password?: string;
    confirm?: string;
    confirmationText?: string;
  };
  message?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const UV_DeleteAccountModal: React.FC = () => {
  const navigate = useNavigate();
  const logout = useAppStore(state => state.logout);
  const addToast = useAppStore(state => state.add_toast);
  const token = useAppStore(state => state.auth.token);

  const [password, setPassword] = useState<string>('');
  const [confirmationText, setConfirmationText] = useState<string>('');
  const [errors, setErrors] = useState<{ password?: string; confirmationText?: string }>({});

  const mutation = useMutation<void, AxiosError<ValidationErrorResponse>, DeleteAccountPayload>({
    mutationFn: async (payload) => {
      await axios.delete(`${API_BASE_URL}/api/users/me`, {
        data: payload,
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
    },
    onSuccess: () => {
      logout();
      navigate('/', { replace: true });
      addToast({
        id: Date.now().toString(),
        type: 'success',
        message: 'Your account has been deleted.',
      });
    },
    onError: (error) => {
      const resp = error.response?.data;
      if (resp?.errors) {
        setErrors({
          password: resp.errors.password,
          confirmationText: resp.errors.confirmationText ?? resp.errors.confirm,
        });
      } else {
        addToast({
          id: Date.now().toString(),
          type: 'error',
          message: resp?.message || error.message,
        });
      }
    },
  });

  const isSubmitting = mutation.isLoading;
  const canDelete =
    !isSubmitting &&
    password.trim().length > 0 &&
    confirmationText.trim() === 'DELETE';

  const handleConfirm = () => {
    setErrors({});
    mutation.mutate({ password, confirm: confirmationText });
  };

  const handleCancel = () => {
    navigate('/profile/me/settings', { replace: true });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
          <h2 className="text-xl font-bold mb-4">Confirm Delete Account</h2>
          <p className="text-sm text-gray-700 mb-6">
            This action is irreversible. All your data will be permanently removed.
            Please enter your password and type <span className="font-mono">DELETE</span> to confirm.
          </p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:border-blue-300"
              placeholder="Enter your password"
              disabled={isSubmitting}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password}</p>
            )}
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Confirmation Text
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={e => setConfirmationText(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:border-blue-300"
              placeholder="Type DELETE to confirm"
              disabled={isSubmitting}
            />
            {errors.confirmationText && (
              <p className="mt-1 text-sm text-red-600">{errors.confirmationText}</p>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 focus:outline-none"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canDelete}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_DeleteAccountModal;