import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const UV_EmailVerificationNotice: React.FC = () => {
  // Pull the raw email from global state
  const email = useAppStore(state => state.auth.user?.email ?? '');
  const addToast = useAppStore(state => state.add_toast);

  // Masked email for display
  const [maskedEmail, setMaskedEmail] = useState<string>('');

  // Cooldown timer (seconds)
  const [countdown, setCountdown] = useState<number>(60);
  const canResend = countdown <= 0;

  // Local error message for failed resend
  const [error, setError] = useState<string>('');

  // Compute maskedEmail whenever the raw email changes
  useEffect(() => {
    const mask = (e: string): string => {
      if (!e) return '';
      const [local, domain] = e.split('@');
      if (!domain) return e;
      const firstChar = local.charAt(0);
      return `${firstChar}***@${domain}`;
    };
    setMaskedEmail(mask(email));
    // Start initial cooldown on mount
    setCountdown(60);
  }, [email]);

  // Countdown effect: decrement every second until zero
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Mutation to resend the verification email
  const mutation = useMutation<void, AxiosError, void>({
    mutationFn: async () => {
      await axios.post(
        `${API_BASE_URL}/api/auth/resend-verification`,
        { email }
      );
    },
    onSuccess: () => {
      setError('');
      addToast({
        id: Date.now().toString(),
        type: 'success',
        message: 'Verification email resent successfully.'
      });
      setCountdown(60);
    },
    onError: (err) => {
      const msg = err.response?.data?.message ?? err.message;
      setError(msg);
      addToast({
        id: Date.now().toString(),
        type: 'error',
        message: msg
      });
    }
  });

  // Handler for the resend link/button
  const handleResend = () => {
    if (!canResend || mutation.isLoading) return;
    mutation.mutate();
  };

  return (
    <>
      <div className="max-w-md mx-auto mt-16 p-6 bg-white rounded shadow">
        <h1 className="text-2xl font-semibold text-gray-800 mb-4">
          Email Verification Sent
        </h1>
        <p className="text-gray-700 mb-4">
          We have sent a verification email to{' '}
          <span className="font-medium">{maskedEmail}</span>. Please check your
          inbox and click the link to verify your email address.
        </p>
        <div className="mb-4">
          <span className="text-gray-700">Didn't receive the email?</span>
          <button
            onClick={handleResend}
            disabled={!canResend || mutation.isLoading}
            className={`ml-2 text-blue-600 hover:underline focus:outline-none ${
              (!canResend || mutation.isLoading)
                ? 'text-gray-400 cursor-not-allowed hover:no-underline'
                : ''
            }`}
          >
            {mutation.isLoading
              ? 'Resending...'
              : canResend
                ? 'Resend Email'
                : `Resend Email (${countdown}s)`}
          </button>
        </div>
        {error && (
          <p className="text-red-500 mb-4">
            {error}
          </p>
        )}
        <Link
          to="/login"
          className="text-blue-600 hover:underline"
        >
          Back to Login
        </Link>
      </div>
    </>
  );
};

export default UV_EmailVerificationNotice;