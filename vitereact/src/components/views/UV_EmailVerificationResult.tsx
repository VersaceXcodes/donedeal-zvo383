import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

interface VerifyEmailResponse {
  message: string;
}

interface ErrorResponse {
  message: string;
}

const UV_EmailVerificationResult: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const authToken = useAppStore(state => state.auth.token);

  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState<string>('');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  const { mutate } = useMutation<VerifyEmailResponse, AxiosError<ErrorResponse>, string>(
    async (tokenToVerify) => {
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
      const { data } = await axios.post<VerifyEmailResponse>(
        `${API_BASE_URL}/api/auth/verify-email`,
        { token: tokenToVerify },
        { headers }
      );
      return data;
    },
    {
      onSuccess(data) {
        setStatus('success');
        setMessage(data.message || 'Your email has been verified.');
      },
      onError(error) {
        const errMsg = error.response?.data?.message || error.message || 'Verification failed.';
        setStatus('error');
        setMessage(errMsg);
      }
    }
  );

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing verification token.');
    } else {
      mutate(token);
    }
  }, [token, mutate]);

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md">
          {status === 'pending' && (
            <div className="text-center">
              <svg
                className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-4"
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
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              <p className="text-gray-700">Verifying your email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <svg
                className="h-12 w-12 text-green-500 mx-auto mb-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <h2 className="text-2xl font-semibold mb-2">Email Verified!</h2>
              <p className="text-gray-600 mb-6">{message}</p>
              <Link
                to="/login"
                className="inline-block px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Go to Login
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <svg
                className="h-12 w-12 text-red-500 mx-auto mb-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <h2 className="text-2xl font-semibold mb-2">Verification Failed</h2>
              <p className="text-gray-600 mb-6">{message}</p>
              <div className="flex justify-center space-x-4">
                <Link
                  to="/verify-email/sent"
                  className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition"
                >
                  Resend Email
                </Link>
                <Link
                  to="/login"
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
                >
                  Back to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_EmailVerificationResult;