import React, { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

interface ForgotPasswordPayload {
  identifier: string;
  captchaToken?: string | null;
}

const UV_ForgotPassword: React.FC = () => {
  // Global maintenance mode flag
  const maintenanceMode = useAppStore(state => state.site_settings?.maintenance_mode?.enabled ?? false);
  const navigate = useNavigate();

  // Local state
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [identifier, setIdentifier] = useState<string>('');
  const [countryCode, setCountryCode] = useState<string>('+1');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Stub for reCAPTCHA token loading
  const loadCaptcha = useCallback(() => {
    // TODO: integrate real reCAPTCHA and set captchaToken
    setCaptchaToken(null);
  }, []);

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha]);

  // Mutation for submitting the forgot-password request
  const mutation = useMutation<void, AxiosError, ForgotPasswordPayload>(
    async (payload) => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      await axios.post(`${baseUrl}/api/auth/forgot-password`, payload);
    },
    {
      onSuccess: (_data, variables) => {
        navigate('/forgot-password/sent', {
          state: { method, identifier: variables.identifier }
        });
      },
      onError: (error: AxiosError) => {
        const message = error.response?.data?.message ?? error.message;
        setFormErrors({ submit: message });
        loadCaptcha();
      }
    }
  );

  const isSubmitting = mutation.isLoading;

  // Form submission handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (maintenanceMode) return;

    const errors: Record<string, string> = {};
    let finalIdentifier = identifier.trim();

    if (!finalIdentifier) {
      errors.identifier = method === 'email'
        ? 'Email is required'
        : 'Phone number is required';
    } else if (method === 'email') {
      const emailPattern = /^\\S+@\\S+\\.\\S+$/;
      if (!emailPattern.test(finalIdentifier)) {
        errors.identifier = 'Invalid email address';
      }
    } else {
      const phonePattern = /^[0-9]{6,15}$/;
      if (!phonePattern.test(finalIdentifier)) {
        errors.identifier = 'Invalid phone number';
      } else {
        finalIdentifier = `${countryCode}${finalIdentifier}`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    mutation.mutate({ identifier: finalIdentifier, captchaToken });
  };

  // Minimal static country-code list
  const countryCodes = [
    { value: '+1', label: 'United States (+1)' },
    { value: '+44', label: 'United Kingdom (+44)' },
    { value: '+91', label: 'India (+91)' },
    { value: '+61', label: 'Australia (+61)' },
    { value: '+81', label: 'Japan (+81)' },
  ];

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 shadow rounded">
        <h1 className="text-2xl font-semibold mb-6 text-center">
          Forgot Your Password?
        </h1>

        {maintenanceMode && (
          <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 text-sm rounded">
            Password reset is temporarily unavailable due to maintenance.
          </div>
        )}

        <div role="tablist" className="flex mb-4">
          <button
            type="button"
            onClick={() => { setMethod('email'); setIdentifier(''); setFormErrors({}); setCaptchaToken(null); }}
            disabled={isSubmitting || maintenanceMode}
            aria-pressed={method === 'email'}
            className={`flex-1 px-4 py-2 border focus:outline-none ${
              method === 'email'
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-700 border-gray-300'
            } rounded-l`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => { setMethod('phone'); setIdentifier(''); setFormErrors({}); setCaptchaToken(null); }}
            disabled={isSubmitting || maintenanceMode}
            aria-pressed={method === 'phone'}
            className={`flex-1 px-4 py-2 border focus:outline-none ${
              method === 'phone'
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-700 border-gray-300'
            } rounded-r`}
          >
            Phone
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {method === 'email' ? (
            <div className="mb-4">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email Address
              </label>
              <input
                id="email"
                name="identifier"
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                disabled={isSubmitting || maintenanceMode}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-invalid={!!formErrors.identifier}
                aria-describedby={formErrors.identifier ? 'email-error' : undefined}
              />
              {formErrors.identifier && (
                <p id="email-error" className="mt-1 text-sm text-red-600">
                  {formErrors.identifier}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label
                  htmlFor="countryCode"
                  className="block text-sm font-medium text-gray-700"
                >
                  Country Code
                </label>
                <select
                  id="countryCode"
                  value={countryCode}
                  onChange={e => setCountryCode(e.target.value)}
                  disabled={isSubmitting || maintenanceMode}
                  className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {countryCodes.map(cc => (
                    <option key={cc.value} value={cc.value}>
                      {cc.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700"
                >
                  Phone Number
                </label>
                <input
                  id="phone"
                  name="identifier"
                  type="tel"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  disabled={isSubmitting || maintenanceMode}
                  className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-invalid={!!formErrors.identifier}
                  aria-describedby={formErrors.identifier ? 'phone-error' : undefined}
                />
                {formErrors.identifier && (
                  <p id="phone-error" className="mt-1 text-sm text-red-600">
                    {formErrors.identifier}
                  </p>
                )}
              </div>
            </>
          )}

          {formErrors.submit && (
            <p className="mb-4 text-sm text-red-600">{formErrors.submit}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || maintenanceMode}
            className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {method === 'email' ? 'Send Reset Link' : 'Send OTP'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          <Link to="/login" className="text-blue-600 hover:underline">
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default UV_ForgotPassword;