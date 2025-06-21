import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';

type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

interface ResetPasswordPayload {
  new_password: string;
}

interface Errors {
  newPassword?: string;
  confirmPassword?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const getPasswordStrength = (password: string): PasswordStrength => {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return 'weak';
  if (score === 2) return 'fair';
  if (score === 3) return 'good';
  return 'strong';
};

const UV_ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const token = useAppStore(state => state.auth.token);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>('weak');
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const mutation = useMutation<void, Error, ResetPasswordPayload>(
    ({ new_password }) =>
      axios
        .post(
          `${API_BASE_URL}/api/auth/reset-password`,
          { new_password },
          token ? { headers: { Authorization: `Bearer ${token}` } } : {}
        )
        .then(res => res.data),
    {
      onSuccess: () => {
        navigate('/login', { replace: true });
      },
      onError: (error: Error) => {
        setErrors({ newPassword: error.message });
      },
      onSettled: () => {
        setIsSubmitting(false);
      }
    }
  );

  const validate = (): boolean => {
    const newErrors: Errors = {};
    if (!newPassword) {
      newErrors.newPassword = 'Please enter a new password';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      newErrors.newPassword = 'Password must include letters and numbers';
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewPassword(value);
    const strength = getPasswordStrength(value);
    setPasswordStrength(strength);
    if (confirmPassword) {
      if (value !== confirmPassword) {
        setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      } else {
        setErrors(prev => {
          const { confirmPassword, ...rest } = prev;
          return rest;
        });
      }
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    if (newPassword !== value) {
      setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
    } else {
      setErrors(prev => {
        const { confirmPassword, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    mutation.mutate({ new_password: newPassword });
  };

  const strengthColor = {
    weak: 'text-red-600',
    fair: 'text-yellow-600',
    good: 'text-blue-600',
    strong: 'text-green-600'
  }[passwordStrength];

  const strengthBarColor = {
    weak: 'bg-red-500',
    fair: 'bg-yellow-500',
    good: 'bg-blue-500',
    strong: 'bg-green-500'
  }[passwordStrength];

  const strengthPercent = {
    weak: '25%',
    fair: '50%',
    good: '75%',
    strong: '100%'
  }[passwordStrength];

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded shadow">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Reset Your Password
            </h2>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={handleNewPasswordChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                             placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Enter new password"
                />
                {errors.newPassword && (
                  <p className="text-red-600 text-sm mt-1">{errors.newPassword}</p>
                )}
                <div className="mt-2">
                  <div className="flex justify-between items-center">
                    <p className="text-sm">
                      Strength:{' '}
                      <span className={`font-medium ${strengthColor}`}>
                        {passwordStrength}
                      </span>
                    </p>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded">
                    <div
                      className={`h-2 rounded ${strengthBarColor}`}
                      style={{ width: strengthPercent }}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                             placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Confirm new password"
                />
                {errors.confirmPassword && (
                  <p className="text-red-600 text-sm mt-1">{errors.confirmPassword}</p>
                )}
              </div>
            </div>
            <div>
              <button
                type="submit"
                disabled={isSubmitting || passwordStrength === 'weak'}
                className={`group relative w-full flex justify-center py-2 px-4 border border-transparent 
                            text-sm font-medium rounded-md text-white 
                            ${isSubmitting || passwordStrength === 'weak' ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'} 
                            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
              >
                {isSubmitting ? 'Submitting...' : 'Reset Password'}
              </button>
            </div>
            <div className="text-sm text-center">
              <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default UV_ResetPassword;