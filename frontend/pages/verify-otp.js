import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { Mail, KeyRound } from 'lucide-react';

const OTP_TTL_SECONDS = 300;
const OTP_EXPIRES_AT_KEY = 'otpExpiresAt';

export default function VerifyOtp() {
  const router = useRouter();
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_SECONDS);
  const [inlineError, setInlineError] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputsRef = useRef([]);
  const otpAutofillRef = useRef(null);
  const expiresAtRef = useRef(0);
  const shakeControls = useAnimationControls();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('registerData');
    if (!raw) {
      router.replace('/auth/register');
      return;
    }
    try {
      const data = JSON.parse(raw);
      if (!data?.email) {
        router.replace('/auth/register');
        return;
      }
      setEmail(data.email);
    } catch (e) {
      router.replace('/auth/register');
    }
  }, [router]);

  const secondsFromExpiry = useCallback(() => {
    if (!expiresAtRef.current) return 0;
    return Math.max(0, Math.ceil((expiresAtRef.current - Date.now()) / 1000));
  }, []);

  const setNewExpiry = useCallback(() => {
    const expiresAt = Date.now() + OTP_TTL_SECONDS * 1000;
    expiresAtRef.current = expiresAt;
    localStorage.setItem(OTP_EXPIRES_AT_KEY, String(expiresAt));
    setSecondsLeft(secondsFromExpiry());
  }, [secondsFromExpiry]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const raw = localStorage.getItem(OTP_EXPIRES_AT_KEY);
    const parsed = raw ? Number(raw) : 0;
    if (!parsed || Number.isNaN(parsed)) {
      setNewExpiry();
    } else {
      expiresAtRef.current = parsed;
      setSecondsLeft(secondsFromExpiry());
    }

    const id = setInterval(() => {
      setSecondsLeft(secondsFromExpiry());
    }, 1000);

    setTimeout(() => {
      const el = inputsRef.current[0];
      if (el) el.focus();
    }, 0);

    return () => clearInterval(id);
  }, [secondsFromExpiry, setNewExpiry]);

  const normalizeMessage = (message) => {
    if (!message) return 'Something went wrong';
    if (message === 'User already exists') return 'Email already exists';
    return message;
  };

  const focusInput = useCallback((index) => {
    const el = inputsRef.current[index];
    if (el) el.focus();
  }, []);

  const triggerShake = useCallback(() => {
    shakeControls.start({
      x: [0, -10, 10, -8, 8, -4, 4, 0],
      transition: { duration: 0.45, ease: 'easeInOut' },
    });
  }, [shakeControls]);

  const applyOtp = useCallback(
    (otpValue) => {
      const cleaned = String(otpValue || '')
        .replace(/\D/g, '')
        .slice(0, 6);
      if (!cleaned) return;

      const next = Array(6).fill('');
      for (let i = 0; i < cleaned.length; i++) next[i] = cleaned[i];
      setDigits(next);
      setInlineError('');

      const focusIndex = Math.min(cleaned.length, 6) - 1;
      setTimeout(() => focusInput(Math.max(0, focusIndex)), 0);
    },
    [focusInput]
  );

  const handleChange = (index) => (e) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/\D/g, '');

    if (cleaned.length > 1) {
      applyOtp(cleaned);
      return;
    }

    const value = cleaned.slice(0, 1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setInlineError('');

    if (value && index < 5) focusInput(index + 1);
  };

  const handleKeyDown = (index) => (e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      setDigits((prev) => {
        const next = [...prev];
        if (next[index]) {
          next[index] = '';
          return next;
        }
        if (index > 0) {
          next[index - 1] = '';
          setTimeout(() => focusInput(index - 1), 0);
        }
        return next;
      });
      return;
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1);
    }
    if (e.key === 'ArrowRight' && index < 5) {
      focusInput(index + 1);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    applyOtp(pasted);
  };

  const otpString = digits.join('');
  const isExpired = secondsLeft <= 0;
  const isLocked = loading || showSuccess;

  const formatTime = (seconds) => {
    const safe = Math.max(0, Number(seconds) || 0);
    const mm = String(Math.floor(safe / 60)).padStart(2, '0');
    const ss = String(safe % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const handleVerify = async () => {
    if (isLocked) return;
    if (isExpired) {
      setInlineError('OTP Expired');
      toast.error('OTP Expired');
      return;
    }
    if (otpString.length < 6) {
      setInlineError('Please enter the 6-digit code');
      toast.error('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    setInlineError('');
    try {
      const verifyRes = await api.post('/verify-otp', { email, otp: otpString });
      if (!verifyRes.data?.success) {
        const msg = normalizeMessage(verifyRes.data?.message) || 'OTP verification failed';
        setInlineError(msg);
        toast.error(msg);
        if (msg === 'Invalid OTP') triggerShake();
        setLoading(false);
        return;
      }

      const raw = localStorage.getItem('registerData');
      const data = raw ? JSON.parse(raw) : {};
      const registerRes = await api.post('/register', {
        name: data.name,
        email: data.email,
        password: data.password,
      });

      if (registerRes.data?.success) {
        toast.success(registerRes.data?.message || 'Registration successful');
        localStorage.removeItem('registerData');
        setShowSuccess(true);
        setTimeout(() => router.push('/auth/login'), 900);
        return;
      }
      toast.error(normalizeMessage(registerRes.data?.message) || 'Registration failed');
    } catch (err) {
      const status = err.response?.status;
      const backendMsg = err.response?.data?.message;
      const msg =
        backendMsg || (err.message === 'Network Error' ? 'Network error' : 'Something went wrong');

      if (status === 410 || backendMsg === 'OTP expired') {
        setInlineError('OTP Expired');
        toast.error('OTP Expired');
      } else if (status === 400 || backendMsg === 'Invalid OTP') {
        const normalized = normalizeMessage(backendMsg || 'Invalid OTP');
        setInlineError(normalized);
        toast.error(normalized);
        triggerShake();
      } else {
        const normalized = normalizeMessage(msg);
        setInlineError(normalized);
        toast.error(normalized);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (isLocked) return;
    if (!email) return;

    setLoading(true);
    try {
      const res = await api.post('/resend-otp', { email });
      if (res.data?.success) {
        setNewExpiry();
        setDigits(Array(6).fill(''));
        setInlineError('');
        setFocusedIndex(0);
        setTimeout(() => focusInput(0), 0);
        toast.success(res.data?.message || 'OTP sent again');
      } else {
        const msg = normalizeMessage(res.data?.message) || 'Failed to resend OTP';
        setInlineError(msg);
        toast.error(msg);
      }
    } catch (err) {
      const msg = normalizeMessage(err.response?.data?.message) || 'Failed to resend OTP';
      setInlineError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="min-h-screen flex items-center justify-center bg-[#FBF6EE] px-4 py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <motion.div
        className="relative overflow-hidden w-full max-w-md bg-white rounded-2xl shadow-xl p-8 md:p-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <AnimatePresence>
          {showSuccess ? (
            <motion.div
              className="absolute inset-0 z-20 flex items-center justify-center bg-white/85 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="flex flex-col items-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              >
                <motion.svg width="84" height="84" viewBox="0 0 84 84" fill="none">
                  <motion.circle
                    cx="42"
                    cy="42"
                    r="34"
                    stroke="#22c55e"
                    strokeWidth="6"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                  <motion.path
                    d="M28 43.5L37.2 52.5L58 31.5"
                    stroke="#22c55e"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
                  />
                </motion.svg>
                <div className="mt-4 text-lg font-semibold text-gray-800">Verified!</div>
                <div className="mt-1 text-sm text-gray-500">Redirecting to login…</div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex justify-center mb-6 relative">
          <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 relative">
            <Mail size={28} strokeWidth={2} />
            <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 bg-white rounded-full p-0.5 border border-orange-100">
              <KeyRound size={16} className="text-orange-500" />
            </div>
          </div>
        </div>

        <h1 className="text-center text-2xl md:text-3xl font-bold text-gray-800 mb-2">
          Verify Your Email Address
        </h1>
        <p className="text-center text-gray-500 mb-8">
          Enter the 6-digit code sent to{' '}
          <span className="font-medium text-gray-700">{email || 'your email'}</span>
        </p>

        <input
          ref={otpAutofillRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d*"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(e) => {
            applyOtp(e.target.value);
            e.target.value = '';
          }}
        />

        <motion.div
          className="flex justify-center gap-3 mb-8"
          onPaste={handlePaste}
          animate={shakeControls}
        >
          {digits.map((digit, i) => (
            <motion.div
              key={i}
              className="rounded-xl"
              animate={focusedIndex === i ? { scale: 1.06 } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            >
              <input
                ref={(el) => (inputsRef.current[i] = el)}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                pattern="\d*"
                maxLength={1}
                value={digit}
                onChange={handleChange(i)}
                onKeyDown={handleKeyDown(i)}
                onFocus={(e) => {
                  setFocusedIndex(i);
                  e.target.select();
                }}
                onBlur={() => setFocusedIndex(-1)}
                disabled={isLocked || isExpired}
                className="w-12 h-14 md:w-14 md:h-16 text-center text-xl font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all disabled:opacity-70"
              />
            </motion.div>
          ))}
        </motion.div>

        <div className="mb-6 text-center text-sm">
          {isExpired ? (
            <div className="font-semibold text-red-600">OTP Expired</div>
          ) : (
            <div className="text-gray-500">OTP expires in {formatTime(secondsLeft)}</div>
          )}
          <AnimatePresence mode="wait" initial={false}>
            {inlineError ? (
              <motion.div
                key={inlineError}
                className="mt-2 text-red-600 font-medium"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {inlineError}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <motion.button
          onClick={handleVerify}
          disabled={isLocked || isExpired}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="inline-flex items-center justify-center gap-2">
            {loading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Verifying…
              </>
            ) : (
              'Verify Email'
            )}
          </span>
        </motion.button>

        <div className="mt-6 flex flex-col items-center gap-2 text-sm">
          <button
            onClick={handleResend}
            disabled={isLocked}
            className="text-orange-500 hover:text-orange-600 font-medium underline underline-offset-4 disabled:opacity-60"
          >
            Resend Code
          </button>
          <Link href="/auth/register" className="text-gray-500 hover:text-gray-700 font-medium underline underline-offset-4">
            Change Email
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
