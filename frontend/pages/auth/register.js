import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const normalizeMessage = (message) => {
    if (!message) return 'Something went wrong';
    if (message === 'User already exists') return 'Email already exists';
    return message;
  };

  const handleFieldChange = (field) => (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/send-otp', { email: formData.email });
      if (res.data?.success) {
        localStorage.setItem('otpExpiresAt', String(Date.now() + 5 * 60 * 1000));
        localStorage.setItem(
          'registerData',
          JSON.stringify({
            name: formData.name,
            email: formData.email,
            password: formData.password,
          })
        );
        toast.success(res.data?.message || 'OTP sent');
        router.push('/verify-otp');
        return;
      }
      toast.error(normalizeMessage(res.data?.message) || 'Failed to send OTP');
    } catch (err) {
      toast.error(normalizeMessage(err.response?.data?.message) || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden gradient-primary">
      <div className="absolute inset-0">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float"></div>
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float"
          style={{ animationDelay: '2s' }}
        ></div>
        <div
          className="absolute top-1/3 right-1/4 w-64 h-64 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-slow"
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
          <div className="text-center mb-12">
            <motion.h1
              className="gradient-glow text-4xl md:text-5xl font-black mb-6"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              Join Us
            </motion.h1>
            <motion.p
              className="text-white/80 text-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Create your account to start exploring thousands of books
            </motion.p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-white/90 font-semibold mb-3">Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-5 py-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl text-white placeholder-white/60 focus:ring-4 focus:ring-pink-500/30 focus:border-pink-400 transition-all duration-300"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleFieldChange('name')}
                />
              </div>
              <div>
                <label className="block text-white/90 font-semibold mb-3">Email Address</label>
                <input
                  type="email"
                  required
                  className="w-full px-5 py-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl text-white placeholder-white/60 focus:ring-4 focus:ring-pink-500/30 focus:border-pink-400 transition-all duration-300"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleFieldChange('email')}
                />
              </div>
              <div>
                <label className="block text-white/90 font-semibold mb-3">Password</label>
                <input
                  type="password"
                  required
                  className="w-full px-5 py-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl text-white placeholder-white/60 focus:ring-4 focus:ring-pink-500/30 focus:border-pink-400 transition-all duration-300"
                  placeholder="Create password"
                  value={formData.password}
                  onChange={handleFieldChange('password')}
                />
              </div>
              <div>
                <label className="block text-white/90 font-semibold mb-3">Confirm Password</label>
                <input
                  type="password"
                  required
                  className="w-full px-5 py-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl text-white placeholder-white/60 focus:ring-4 focus:ring-pink-500/30 focus:border-pink-400 transition-all duration-300"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={handleFieldChange('confirmPassword')}
                />
              </div>
            </div>

            <motion.button
              type="submit"
              className="btn-gradient w-full"
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? 'Please wait...' : 'Create Account'}
            </motion.button>

            <div className="text-center">
              <Link href="/auth/login" className="text-white/80 hover:text-white transition-colors">
                Already have an account? Sign in →
              </Link>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
}
