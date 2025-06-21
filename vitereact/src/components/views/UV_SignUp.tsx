import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/main';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';

interface EmailForm {
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}
interface PhoneForm {
  countryCode: string;
  phone: string;
}
interface FormErrors {
  [key: string]: string;
}
interface EmailSignupPayload {
  email: string;
  password: string;
  display_name: null;
  captcha_token: string;
}
interface PhoneSignupPayload {
  countryCode: string;
  phone: string;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

const UV_SignUp: React.FC = () => {
  const maintenanceMode = useAppStore(state => state.site_settings.maintenance_mode.enabled);
  const addToast = useAppStore(state => state.addToast);
  const navigate = useNavigate();

  const [method, setMethod] = useState<'email'|'phone'|'social'>('email');
  const [emailForm, setEmailForm] = useState<EmailForm>({
    email: '', password: '', confirmPassword: '', termsAccepted: false
  });
  const [phoneForm, setPhoneForm] = useState<PhoneForm>({
    countryCode: '+1', phone: ''
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [captchaToken, setCaptchaToken] = useState<string|null>(null);

  const recaptchaRef = useRef<ReCAPTCHA|null>(null);

  // reset errors & captcha when switching tabs
  useEffect(() => {
    setFormErrors({});
    setCaptchaToken(null);
    recaptchaRef.current?.reset();
  }, [method]);

  // validate email form
  const validateEmailForm = () => {
    const errs: FormErrors = {};
    if (!emailForm.email) errs.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(emailForm.email)) errs.email = 'Invalid email address';
    if (!emailForm.password) errs.password = 'Password is required';
    else if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(emailForm.password))
      errs.password = 'Must be ≥8 chars, include a letter & number';
    if (!emailForm.confirmPassword) errs.confirmPassword = 'Please confirm your password';
    else if (emailForm.password !== emailForm.confirmPassword)
      errs.confirmPassword = 'Passwords do not match';
    if (!emailForm.termsAccepted) errs.termsAccepted = 'You must accept Terms & Conditions';
    if (!captchaToken) errs.captcha = 'Please complete the captcha';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // validate phone form
  const validatePhoneForm = () => {
    const errs: FormErrors = {};
    if (!phoneForm.phone) errs.phone = 'Phone number is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Email signup mutation
  const emailSignup = useMutation<void, any, EmailSignupPayload>({
    mutationFn: async payload => {
      await axios.post(`${BASE_URL}/api/auth/signup/email`, payload);
    },
    onSuccess: () => {
      navigate('/verify-email/sent', { replace: true });
    },
    onError: err => {
      const msg = err.response?.data?.message || err.message;
      addToast({ id: new Date().toISOString(), type: 'error', message: msg });
    },
    onSettled: () => setIsSubmitting(false)
  });

  // Phone signup mutation
  const phoneSignup = useMutation<void, any, PhoneSignupPayload>({
    mutationFn: async payload => {
      await axios.post(`${BASE_URL}/api/auth/signup/sms`, payload);
    },
    onSuccess: () => {
      navigate('/verify-otp', {
        state: { context: 'signup', countryCode: phoneForm.countryCode, phone: phoneForm.phone },
        replace: true
      });
    },
    onError: err => {
      const msg = err.response?.data?.message || err.message;
      addToast({ id: new Date().toISOString(), type: 'error', message: msg });
    },
    onSettled: () => setIsSubmitting(false)
  });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmailForm()) return;
    setIsSubmitting(true);
    emailSignup.mutate({
      email: emailForm.email,
      password: emailForm.password,
      display_name: null,
      captcha_token: captchaToken!
    });
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhoneForm()) return;
    setIsSubmitting(true);
    phoneSignup.mutate({ countryCode: phoneForm.countryCode, phone: phoneForm.phone });
  };

  const handleSocialSignup = (provider: 'google'|'facebook') => {
    const width = 500, height = 600;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    window.open(
      `${BASE_URL}/api/auth/signup/${provider}`,
      `${provider} Signup`,
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  const renderPasswordStrength = () => {
    const pwd = emailForm.password;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return (
      <div className='flex mt-1'>
        {[0,1,2,3,4].map(i => (
          <div key={i} className={`h-1 flex-1 mx-0.5 rounded ${score>i?'bg-green-500':'bg-gray-300'}`} />
        ))}
      </div>
    );
  };

  if (maintenanceMode) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50 p-4'>
        <div className='bg-white p-8 shadow rounded text-center'>
          <h2 className='text-2xl font-semibold mb-4'>Sign Up Unavailable</h2>
          <p className='text-gray-600'>We are currently under maintenance. Please try again later.</p>
        </div>
      </div>
    );
  }

  const methods = ['email','phone','social'] as const;

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full bg-white p-8 shadow-lg rounded-lg'>
        <h2 className='mb-6 text-center text-3xl font-extrabold text-gray-900'>Sign Up</h2>

        {/* Tabs */}
        <div className='mb-6 flex justify-around border-b'>
          {methods.map(m => (
            <button key={m} type='button' onClick={() => setMethod(m)} className={`pb-2 px-4 font-medium ${method===m?'border-b-2 border-blue-600 text-blue-600':'text-gray-600'}`}>{m.charAt(0).toUpperCase()+m.slice(1)}</button>
          ))}
        </div>

        {/* Email Method */}
        {method==='email'&&(<form onSubmit={handleEmailSubmit} noValidate className='space-y-4'>{/* Email fields */}</form>)}

        {/* Phone Method */}
        {method==='phone'&&(<form onSubmit={handlePhoneSubmit} className='space-y-4'>{/* Phone fields */}</form>)}

        {/* Social Method */}
        {method==='social'&&(
          <div className='space-y-4'>
            <button type='button' onClick={() => handleSocialSignup('google')} className='w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50'>Continue with Google</button>
            <button type='button' onClick={() => handleSocialSignup('facebook')} className='w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm bg-blue-600 text-white hover:bg-blue-700'>Continue with Facebook</button>
          </div>
        )}

        {/* Footer Links */}
        <div className='mt-6 text-center space-y-2 text-sm'>
          <p>Already have an account? <Link to='/login' className='text-blue-600 underline'>Login</Link></p>
          <p><Link to='/terms' className='text-gray-500 hover:text-gray-700'>Terms & Conditions</Link> | <Link to='/privacy' className='text-gray-500 hover:text-gray-700'>Privacy Policy</Link> | <Link to='/help' className='text-gray-500 hover:text-gray-700'>Help</Link></p>
        </div>
      </div>
    </div>
  );
};

export default UV_SignUp;