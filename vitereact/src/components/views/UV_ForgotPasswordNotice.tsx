import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useMutation } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import { Link } from 'react-router-dom';

interface ForgotPasswordPayload {
  identifier: string;
}

const UV_ForgotPasswordNotice: React.FC = () => {
  // Global state mappings
  const method = useAppStore(state => state.ui.lastForgotMethod) ?? 'email';
  const identifier = useAppStore(state => state.ui.lastForgotIdentifier) ?? '';
  const maintenance_mode = useAppStore(
    state => state.site_settings.maintenance_mode.enabled
  );
  const add_toast = useAppStore(state => state.add_toast);

  // Local state
  const [cooldown_timer, set_cooldown_timer] = useState<number>(60);
  const [can_resend, set_can_resend] = useState<boolean>(false);
  const [error, set_error] = useState<string | null>(null);

  const interval_ref = useRef<NodeJS.Timeout | null>(null);

  // Start or restart the countdown
  const start_cooldown = () => {
    if (maintenance_mode) {
      set_can_resend(false);
      if (interval_ref.current) {
        clearInterval(interval_ref.current);
        interval_ref.current = null;
      }
      return;
    }
    set_can_resend(false);
    set_cooldown_timer(60);
    if (interval_ref.current) clearInterval(interval_ref.current);
    interval_ref.current = setInterval(() => {
      set_cooldown_timer(prev => {
        if (prev <= 1) {
          if (interval_ref.current) {
            clearInterval(interval_ref.current);
            interval_ref.current = null;
          }
          set_can_resend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Initialize countdown on mount / maintenance_mode change
  useEffect(() => {
    start_cooldown();
    return () => {
      if (interval_ref.current) clearInterval(interval_ref.current);
    };
  }, [maintenance_mode]);

  // Mutation to resend instructions
  const resend_mutation = useMutation<void, Error, ForgotPasswordPayload>(
    async ({ identifier }) => {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/forgot-password`,
        { identifier }
      );
    },
    {
      onSuccess: () => {
        set_error(null);
        start_cooldown();
      },
      onError: (err: Error) => {
        set_error(err.message);
        add_toast({ id: crypto.randomUUID(), type: 'error', message: err.message });
      }
    }
  );

  const { mutate: resend_instructions, isLoading: is_resending } = resend_mutation;

  const handle_resend = () => {
    if (!can_resend || is_resending || maintenance_mode) return;
    resend_instructions({ identifier });
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
        <h1 className="text-2xl font-semibold mb-4">
          Forgot Password Confirmation
        </h1>

        {method === 'email' ? (
          <p className="text-center">
            We have sent password reset instructions to your email:
            <br />
            <span className="font-medium">{identifier}</span>
          </p>
        ) : (
          <p className="text-center">
            We have sent password reset instructions via SMS to:
            <br />
            <span className="font-medium">{identifier}</span>
          </p>
        )}

        <p className="mt-4">
          Didn't receive the instructions?{' '}
          <button
            onClick={handle_resend}
            disabled={!can_resend || is_resending || maintenance_mode}
            className="underline text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {is_resending
              ? 'Resending...'
              : can_resend
              ? 'Resend'
              : `Resend in ${cooldown_timer}s`}
          </button>
        </p>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-6">
          <Link to="/login" className="text-blue-600 hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </>
  );
};

export default UV_ForgotPasswordNotice;