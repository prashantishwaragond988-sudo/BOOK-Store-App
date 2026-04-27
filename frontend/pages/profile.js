import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';

export default function Profile() {
  const [userInfo, setUserInfo] = useState(null);
  const router = useRouter();
  const { user, token, loading: authLoading, logout } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      router.replace('/auth/login');
      return;
    }

    const emailFromUser = user?.email;
    const roleFromUser = user?.role;

    let emailFromStorage = null;
    let roleFromStorage = null;

    if (typeof window !== 'undefined') {
      try {
        const storedUserRaw = localStorage.getItem('user');
        if (storedUserRaw) {
          const storedUser = JSON.parse(storedUserRaw);
          emailFromStorage = storedUser?.email || null;
          roleFromStorage = storedUser?.role || null;
        }
      } catch {
        // ignore
      }
    }

    setUserInfo({
      email: emailFromUser || emailFromStorage || 'user@example.com',
      role: roleFromUser || roleFromStorage || 'customer',
    });
  }, [authLoading, token, user, router]);

  const handleLogout = () => {
    logout({ redirectTo: '/' });
  };

  if (!userInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Profile - Bookstore</title>
      </Head>
      <div className="container mx-auto px-4 py-12 max-w-2xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              My Profile
            </h1>
            <p className="text-xl text-gray-600 dark:text-slate-300">Manage your account information</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 mb-8 border border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center space-x-6 mb-8">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">👤</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">{userInfo.email}</h2>
                <p className="text-lg text-gray-600 dark:text-slate-300 capitalize">Role: {userInfo.role}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="p-6 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-100 dark:border-slate-700/60">
                <h3 className="font-bold text-lg mb-3 flex items-center">
                  📚 My Ebooks
                </h3>
                <Link href="/my-ebooks" className="text-blue-600 hover:text-blue-700 font-medium">
                  View all my purchased ebooks →
                </Link>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-100 dark:border-slate-700/60">
                <h3 className="font-bold text-lg mb-3 flex items-center">
                  🛒 My Orders
                </h3>
                <Link href="/orders" className="text-blue-600 hover:text-blue-700 font-medium">
                  View order history →
                </Link>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-4 px-8 rounded-2xl font-bold text-xl shadow-xl hover:shadow-2xl transition-all"
            >
              🚪 Logout
            </button>
          </div>

          <div className="text-center text-sm text-gray-500 dark:text-slate-400 mt-8">
            <p>Your ebooks are available forever in My Books</p>
          </div>
      </div>
    </>
  );
}

