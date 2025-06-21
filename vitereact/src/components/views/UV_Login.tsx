import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useMutation } from '@tanstack/react-query';
import ReCAPTCHA from 'react-google-recaptcha';
import type { ReCAPTCHA as ReCAPTCHAType } from 'react-google-recaptcha';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore, User } from '@/store/main';

interface LoginPayload {
  identifier: string;
  password: string;
  rememberMe: boolean;
  captchaToken?: string;
}
interface LoginResponse {
  token: string;
  user: User;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
const CAPTCHA_THRESHOLD = 3;

const UV_Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Global maintenance flag
  const isMaintenance = useAppStore(state => state.site_settings?.maintenance_mode?.enabled ?? false);
  // Global login action
  const loginAction = useAppStore(state => state.login);

  // Local state
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<Record<string,string>>({});
  const [showCaptcha, setShowCaptcha] = useState<boolean>(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Track consecutive failures
  const failureCountRef = useRef<number>(0);
  // Ref to recaptcha widget
  const recaptchaRef = useRef<ReCAPTCHAType | null>(null);

  // Redirect after login
  const from = (location.state as any)?.from?.pathname || '/home';

  // React Query mutation for login
  const loginMutation = useMutation<LoginResponse, unknown, LoginPayload>({
    mutationFn: async (payload) => {
      const { data } = await axios.post<LoginResponse>(
        `${API_BASE_URL}/api/auth/login`,
        payload
      );
      return data;
    },
    onSuccess: (data) => {
      // store token & user, init socket
      loginAction(data.token, data.user);
      // reset failure counter & errors
      failureCountRef.current = 0;
      setFormErrors({});
      // navigate
      navigate(from, { replace: true });
    },
    onError: (error) => {
      // count failures -> possibly show CAPTCHA
      failureCountRef.current += 1;
      if (failureCountRef.current >= CAPTCHA_THRESHOLD) {
        setShowCaptcha(true);
      }
      // display error message
      let message = 'Login failed';
      if (axios.isAxiosError(error)) {
        message = error.response?.data?.message || error.message;
      }
      setFormErrors({ general: message });
      if (showCaptcha && recaptchaRef.current) {
        recaptchaRef.current.reset();
      }
      setCaptchaToken(null);
    }
  });

  // Form submission handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string,string> = {};
    if (!identifier.trim()) {
      errors.identifier = 'Email or phone is required';
    }
    if (!password) {
      errors.password = 'Password is required';
    }
    if (showCaptcha && !captchaToken) {
      errors.captcha = 'Please complete the CAPTCHA';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length) return;

    loginMutation.mutate({
      identifier,
      password,
      rememberMe,
      captchaToken: showCaptcha ? captchaToken! : undefined
    });
  };

  // Reset reCAPTCHA when it appears
  useEffect(() => {
    if (showCaptcha && recaptchaRef.current) {
      recaptchaRef.current.reset();
    }
  }, [showCaptcha]);

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Sign in to your account
            </h2>
          </div>

          {/* Maintenance notice */}
          {isMaintenance && (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4">
              <p>Site is under maintenance. Please try again later.</p>
            </div>
          )}

          {/* Login form */}
          {!isMaintenance && (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <input type="hidden" name="remember" value={rememberMe ? 'true' : 'false'} />

              {/* General error */}
              {formErrors.general && (
                <div className="text-red-600 text-sm">{formErrors.general}</div>
              )}

              <div className="rounded-md shadow-sm -space-y-px">
                {/* Identifier field */}
                <div>
                  <label htmlFor="identifier" className="sr-only">
                    Email or phone
                  </label>
                  <input
                    id="identifier"
                    name="identifier"
                    type="text"
                    autoComplete="username"
                    placeholder="Email or phone"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    disabled={loginMutation.isLoading}
                    className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                      formErrors.identifier ? 'border-red-500' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                  />
                  {formErrors.identifier && (
                    <p className="mt-1 text-red-600 text-sm">{formErrors.identifier}</p>
                  )}
                </div>

                {/* Password field */}
                <div className="mt-4">
                  <label htmlFor="password" className="sr-only">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={loginMutation.isLoading}
                    className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                      formErrors.password ? 'border-red-500' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                  />
                  {formErrors.password && (
                    <p className="mt-1 text-red-600 text-sm">{formErrors.password}</p>
                  )}
                </div>
              </div>

              {/* Remember me & forgot */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember_me"
                    name="remember_me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    disabled={loginMutation.isLoading}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember_me" className="ml-2 block text-sm text-gray-900">
                    Remember me
                  </label>
                </div>
                <div className="text-sm">
                  <Link
                    to="/forgot-password"
                    className="font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Forgot your password?
                  </Link>
                </div>
              </div>

              {/* CAPTCHA */}
              {showCaptcha && RECAPTCHA_SITE_KEY && (
                <div className="mt-4 flex flex-col items-center">
                  <ReCAPTCHA
                    sitekey={RECAPTCHA_SITE_KEY}
                    onChange={token => setCaptchaToken(token)}
                    ref={recaptchaRef}
                  />
                  {formErrors.captcha && (
                    <p className="mt-1 text-red-600 text-sm">{formErrors.captcha}</p>
                  )}
                </div>
              )}

              {/* Submit */}
              <div>
                <button
                  type="submit"
                  disabled={loginMutation.isLoading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {loginMutation.isLoading ? 'Signing in…' : 'Sign in'}
                </button>
              </div>

              {/* Sign up link */}
              <div className="text-center text-sm text-gray-600">
                Don't have an account?{' '}
                <Link to="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
                  Sign Up
                </Link>
              </div>

              {/* Terms & Privacy */}
              <div className="text-center text-xs text-gray-500">
                <a href="/terms" className="hover:underline">
                  Terms &amp; Conditions
                </a>{' '}
                and{' '}
                <a href="/privacy" className="hover:underline">
                  Privacy Policy
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_Login;