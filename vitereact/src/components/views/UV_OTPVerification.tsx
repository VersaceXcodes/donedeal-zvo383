import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  FormEvent,
  ClipboardEvent,
  KeyboardEvent
} from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface LocationState {
  phone?: string;
  context?: 'signup' | 'reset';
}

const UV_OTPVerification: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const addToast = useAppStore(state => state.addToast);
  const token = useAppStore(state => state.auth.token);

  // Extract context & phone from router state
  const { phone = '', context = 'signup' } = (location.state as LocationState) || {};

  // Local state
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [error, setError] = useState<string>('');

  // Refs for inputs & timers
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const timerRef = useRef<number | null>(null);

  // Start (or restart) 60s cooldown
  const startCooldown = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
    }
    setSecondsLeft(60);
    const id = window.setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current !== null) {
            clearInterval(timerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    timerRef.current = id;
  }, []);

  // On mount, kick off initial cooldown; redirect if no phone
  useEffect(() => {
    if (!phone) {
      navigate(context === 'signup' ? '/signup' : '/forgot-password', { replace: true });
      return;
    }
    startCooldown();
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, [phone, context, navigate, startCooldown]);

  // Check if all OTP digits are filled
  const isOtpComplete = otp.every(d => d !== '');

  // Mutation: verify OTP
  interface VerifyPayload { phone: string; otp: string; context: 'signup' | 'reset'; }
  const verifyMutation = useMutation(
    async () => {
      const payload: VerifyPayload = {
        phone,
        otp: otp.join(''),
        context
      };
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.post(
        `${API_BASE_URL}/api/auth/verify-otp`,
        payload,
        { headers }
      );
      return data;
    },
    {
      onSuccess: () => {
        if (context === 'signup') {
          navigate('/profile/setup');
        } else {
          navigate('/reset-password', { state: { phone } });
        }
      },
      onError: (err: any) => {
        setIsSubmitting(false);
        const msg =
          err.response?.data?.message ||
          'Invalid OTP. Please try again.';
        setError(msg);
        addToast({ id: `${Date.now()}`, type: 'error', message: msg });
      }
    }
  );

  // Mutation: resend OTP
  const resendMutation = useMutation(
    async () => {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      if (context === 'signup') {
        return axios.post(
          `${API_BASE_URL}/api/auth/signup/sms`,
          { phone },
          { headers }
        );
      } else {
        return axios.post(
          `${API_BASE_URL}/api/auth/forgot-password`,
          { phone },
          { headers }
        );
      }
    },
    {
      onSuccess: () => {
        const msg = 'OTP resent successfully.';
        addToast({ id: `${Date.now()}`, type: 'success', message: msg });
        startCooldown();
      },
      onError: (err: any) => {
        const msg =
          err.response?.data?.message ||
          'Failed to resend OTP. Please try again later.';
        addToast({ id: `${Date.now()}`, type: 'error', message: msg });
      }
    }
  );

  // Handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    setError('');
    const val = e.target.value.replace(/\D/g, ''); // digits only
    if (!val) {
      setOtp(prev => {
        const next = [...prev];
        next[idx] = '';
        return next;
      });
      return;
    }
    // Only first char
    const char = val.charAt(0);
    setOtp(prev => {
      const next = [...prev];
      next[idx] = char;
      return next;
    });
    // focus next
    if (inputsRef.current[idx + 1]) {
      inputsRef.current[idx + 1]!.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace' && otp[idx] === '') {
      if (inputsRef.current[idx - 1]) {
        inputsRef.current[idx - 1]!.focus();
      }
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('Text').trim();
    if (!/^\d{6,}$/.test(paste)) return;
    const digits = paste.split('').slice(0, 6);
    setOtp(digits);
    // focus last
    const lastIdx = digits.length - 1;
    if (inputsRef.current[lastIdx]) {
      inputsRef.current[lastIdx]!.focus();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isOtpComplete) return;
    setError('');
    setIsSubmitting(true);
    verifyMutation.mutate();
  };

  const handleResend = () => {
    if (secondsLeft > 0) return;
    resendMutation.mutate();
  };

  return (
    <>
      <div className="max-w-md mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-4">OTP Verification</h1>
        <p className="mb-6 text-gray-600">
          Enter the 6-digit code sent to <span className="font-medium">{phone}</span> to{' '}
          {context === 'signup'
            ? 'verify your phone number'
            : 'reset your password'}
          .
        </p>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-between space-x-2">
            {otp.map((digit, idx) => (
              <input
                key={idx}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(e, idx)}
                onKeyDown={e => handleKeyDown(e, idx)}
                onPaste={handlePaste}
                ref={el => (inputsRef.current[idx] = el)}
                aria-label={`OTP digit ${idx+1}`}
                className="w-12 h-12 text-center border border-gray-300 rounded-md text-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={!isOtpComplete || isSubmitting}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {isSubmitting ? 'Verifying...' : 'Submit'}
          </button>
        </form>

        <div className="mt-4 text-center">
          {secondsLeft > 0 ? (
            <p className="text-sm text-gray-500">
              Resend OTP in {secondsLeft}s
            </p>
          ) : (
            <button
              onClick={handleResend}
              disabled={isSubmitting}
              className="text-sm text-blue-600 hover:underline"
            >
              Resend OTP
            </button>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link
            to={context === 'signup' ? '/signup' : '/forgot-password'}
            className="text-sm text-blue-600 hover:underline"
          >
            Wrong phone number?
          </Link>
        </div>
      </div>
    </>
  );
};

export default UV_OTPVerification;