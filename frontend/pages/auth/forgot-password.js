import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { getFirebaseApp } from '../../lib/firebaseClient';

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      getFirebaseApp();
      const auth = getAuth();
      await sendPasswordResetEmail(auth, trimmed);
      setMessage({ type: 'success', text: 'Password reset email sent' });
    } catch {
      setMessage({ type: 'error', text: 'Invalid email or user not found' });
    } finally {
      setLoading(false);
    }
  };

  const messageClass =
    message.type === 'success'
      ? 'bg-green-500/15 border-green-400/30 text-green-100'
      : 'bg-red-500/15 border-red-400/30 text-red-100';

  return (
    <div className="min-h-screen relative overflow-hidden gradient-primary">
      <div className="absolute inset-0">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float"></div>
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float"
          style={{ animationDelay: '2s' }}
        ></div>
        <div
          className="absolute top-40 left-1/4 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-slow"
          style={{ animationDelay: '4s' }}
        ></div>
      </div>

      <motion.div
        className="relative z-10 flex items-center justify-center min-h-screen px-4 py-16"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <motion.div
          className="glass p-12 w-full max-w-md"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="text-center mb-10">
            <motion.h1
              className="gradient-glow text-4xl md:text-5xl font-black mb-4"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              Forgot Password
            </motion.h1>
            <p className="text-white/80 text-lg">We’ll email you a reset link</p>
          </div>

          {message.text ? (
            <div className={`mb-6 px-4 py-3 rounded-2xl border ${messageClass}`}>
              <div className="text-sm font-medium">{message.text}</div>
            </div>
          ) : null}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-white/90 font-semibold mb-3">Email Address</label>
              <input
                type="email"
                className="w-full px-5 py-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl text-white placeholder-white/60 focus:ring-4 focus:ring-purple-500/30 focus:border-purple-400 transition-all duration-300"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
                required
              />
            </div>

            <motion.button
              type="submit"
              className="btn-gradient w-full disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </motion.button>

            <div className="text-center">
              {message.type === 'success' ? (
                <Link href="/auth/login" className="text-white/90 hover:text-white transition-colors underline underline-offset-4">
                  Back to login
                </Link>
              ) : (
                <Link href="/auth/login" className="text-white/80 hover:text-white transition-colors">
                  Back to login
                </Link>
              )}
            </div>
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
}

