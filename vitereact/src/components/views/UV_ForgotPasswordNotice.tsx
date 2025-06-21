import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useMutation } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import { Link } from 'react-router-dom';

interface ForgotPasswordPayload {
  identifier: string;
}

const UV_ForgotPasswordNotice: React.FC = () => {
  // Global state mappings
  const method = useAppStore(state => state.ui.lastForgotMethod ?? 'email');
  const identifier = useAppStore(state => state.ui.lastForgotIdentifier ?? '');
  const maintenanceMode = useAppStore(
    state => state.site_settings.maintenance_mode?.enabled ?? false,
  );
  const addToast = useAppStore(state => state.addToast);

  // Local state
  const [cooldownTimer, setCooldownTimer] = useState<number>(60);
  const [canResend, setCanResend] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start or restart the countdown
  const startCooldown = useCallback(() => {
    if (maintenanceMode) {
      setCanResend(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    setCanResend(false);
    setCooldownTimer(60);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCooldownTimer(prev => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [maintenanceMode]);

  // Initialize countdown on mount / maintenance_mode change
  useEffect(() => {
    startCooldown();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [maintenanceMode, startCooldown]);

  // Mutation to resend instructions
  const { mutate: resendInstructions, isLoading: isResending } = useMutation<void, Error, ForgotPasswordPayload>(
    async ({ identifier: id }) => {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'}/api/auth/forgot-password`,
        { identifier: id },
      );
    },
    {
      onSuccess: () => {
        setErrorMessage(null);
        startCooldown();
      },
      onError: (err: Error) => {
        const message = err.message;
        setErrorMessage(message);
        addToast({ id: crypto.randomUUID(), type: 'error', message });
      }
    }
  );

  const handleResend = (): void => {
    if (!canResend || isResending || maintenanceMode) return;
    resendInstructions({ identifier });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <h1 className="text-2xl font-semibold mb-4">
        Forgot Password Confirmation
      </h1>

      <p className="text-center">
        {method === 'email' ? (
          <>
            We have sent password reset instructions to your email:
            <br />
            <span className="font-medium">{identifier}</span>
          </>
        ) : (
          <>
            We have sent password reset instructions via SMS to:
            <br />
            <span className="font-medium">{identifier}</span>
          </>
        )}
      </p>

      <p className="mt-4">
        Didn't receive the instructions?{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={!canResend || isResending || maintenanceMode}
          className="underline text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {isResending
            ? 'Resending...'
            : canResend
            ? 'Resend'
            : `Resend in ${cooldownTimer}s`}
        </button>
      </p>

      {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}

      <div className="mt-6">
        <Link to="/login" className="text-blue-600 hover:underline">
          Back to Login
        </Link>
      </div>
    </div>
  );
};

export default UV_ForgotPasswordNotice;