import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import { useAppStore, User, Toast } from '@/store/main';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface LoginPayload {
  identifier: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: User;
}

const UV_AdminLogin: React.FC = () => {
  const navigate = useNavigate();

  // global state
  const maintenanceMode = useAppStore(state => state.site_settings.maintenance_mode.enabled);
  const loginAction = useAppStore(state => state.login);
  const addToast = useAppStore(state => state.add_toast);

  // local state
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // mutation for login
  const mutation = useMutation<LoginResponse, AxiosError<any>, LoginPayload>(
    async (payload) => {
      const res = await axios.post<LoginResponse>(
        `${API_BASE_URL}/api/auth/login`,
        payload
      );
      return res.data;
    }
  );

  // simple email format check
  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = () => {
    // clear previous errors
    setErrors({});

    // client-side validation
    const validationErrors: Record<string, string> = {};
    if (!email) {
      validationErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      validationErrors.email = 'Invalid email address';
    }
    if (!password) {
      validationErrors.password = 'Password is required';
    }
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (maintenanceMode) {
      // do not submit when in maintenance
      return;
    }

    setIsSubmitting(true);

    mutation.mutate(
      { identifier: email, password },
      {
        onSuccess: (data) => {
          if (data.user.role !== 'admin') {
            const msg = 'Not authorized: admin access only';
            setErrors({ general: msg });
            addToast({ id: `${Date.now()}`, type: 'error', message: msg });
            setIsSubmitting(false);
          } else {
            // persist auth and init socket
            loginAction(data.token, data.user);
            navigate('/admin', { replace: true });
          }
        },
        onError: (error) => {
          const serverErrors = error.response?.data?.errors as Record<string, string> | undefined;
          const message = error.response?.data?.message || 'Login failed. Please try again.';
          if (serverErrors) {
            setErrors(serverErrors);
          } else {
            setErrors({ general: message });
          }
          addToast({ id: `${Date.now()}`, type: 'error', message });
          setIsSubmitting(false);
        }
      }
    );
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
          <h2 className="text-center text-2xl font-semibold text-gray-800 mb-6">
            Admin Login
          </h2>

          {maintenanceMode && (
            <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
              The site is currently under maintenance. Login is disabled.
            </div>
          )}

          {errors.general && (
            <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700">
              {errors.general}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting || maintenanceMode}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md
                           focus:outline-none focus:ring focus:ring-blue-200 disabled:opacity-50"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email}</p>
              )}
            </div>

            <div className="mt-4">
              <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting || maintenanceMode}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md
                           focus:outline-none focus:ring focus:ring-blue-200 disabled:opacity-50"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || maintenanceMode}
              className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent
                         text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700
                         disabled:opacity-50"
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default UV_AdminLogin;