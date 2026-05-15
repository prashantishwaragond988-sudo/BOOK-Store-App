import { AnimatePresence } from 'framer-motion';
import '../tailwind/globals.css';
import 'leaflet/dist/leaflet.css';
import Layout from '../components/Layout';
import toast from 'react-hot-toast';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { SearchProvider } from '../context/SearchContext';
import { AuthProvider } from '../hooks/useAuth';
import { ThemeProvider } from '../context/ThemeContext';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      toast('Welcome to Bookstore ✨', { duration: 2000, position: 'top-center' });
    }
  }, []);

  const router = useRouter();

  return (
    <ThemeProvider>
      <AuthProvider>
        <SearchProvider>
          <Layout>
            <AnimatePresence mode="wait">
              <Component
                key={router.route}
                {...pageProps}
                style={{ position: 'absolute', width: '100%' }}
              />
            </AnimatePresence>
          </Layout>
        </SearchProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
