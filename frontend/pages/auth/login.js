import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useRouter } from 'next/router';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseApp, getFirebaseDb } from '../../lib/firebaseClient';

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      getFirebaseApp();
      const auth = getAuth();
      const cred = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      const uid = cred.user?.uid;
      if (!uid) {
        toast.error('Login failed');
        return;
      }

      let role = null;
      try {
        const db = getFirebaseDb();
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) role = snap.data()?.role || null;
      } catch {
        // ignore: role-based routing falls back to default
      }

      router.push(role === 'admin' ? '/admin/dashboard' : '/');
    } catch {
      toast.error('Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden gradient-primary">
      {/* Animated background blobs */}
      <div className="absolute inset-0">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-40 left-1/4 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-slow" style={{animationDelay: '4s'}}></div>
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
              Welcome Back
            </motion.h1>
            <motion.p 
              className="text-white/80 text-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Sign in to continue your reading journey
            </motion.p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-white/90 font-semibold mb-3">Email Address</label>
                <input
                  type="email"
                  required
                  className="w-full px-5 py-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl text-white placeholder-white/60 focus:ring-4 focus:ring-purple-500/30 focus:border-purple-400 transition-all duration-300"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-white/90 font-semibold mb-3">Password</label>
                <input
                  type="password"
                  required
                  className="w-full px-5 py-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl text-white placeholder-white/60 focus:ring-4 focus:ring-purple-500/30 focus:border-purple-400 transition-all duration-300"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
                <div className="mt-3 text-right">
                  <Link href="/auth/forgot-password" className="text-white/80 hover:text-white transition-colors underline underline-offset-4 text-sm">
                    Forgot Password?
                  </Link>
                </div>
              </div>
            </div>

            <motion.button
              type="submit"
              className="btn-gradient w-full"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              Sign In
            </motion.button>

            <div className="text-center">
              <Link href="/auth/register" className="text-white/80 hover:text-white transition-colors">
                Create new account →
              </Link>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
}
