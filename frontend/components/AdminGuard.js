import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../hooks/useAuth';

export default function AdminGuard({ children }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !authLoading) {
      if (!isAdmin()) {
        router.replace('/auth/login');
        return;
      }
      setIsAuthorized(true);
    }
  }, [mounted, authLoading, isAdmin, router]);

  if (!mounted || !isAuthorized || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <span className="text-xl">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Admin - Bookstore</title>
      </Head>
      {children}
    </>
  );
}
