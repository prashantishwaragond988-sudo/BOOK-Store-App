import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import toast from 'react-hot-toast';
import api from '../lib/api';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';

export default function MyEbooks() {
  const [ebooks, setEbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { token, loading: authLoading } = useAuth();

  const getRemovedEbookIds = useCallback(() => {
    try {
      if (typeof window === 'undefined') return [];
      const raw = localStorage.getItem('removedEbooks');
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const dedupeById = useCallback(
    (items) => Array.from(new Map(items.map((e) => [e.id, e])).values()),
    []
  );

  const fetchEbooks = useCallback(async () => {
    try {
      const response = await api.get('/orders/my-ebooks');
      const data = Array.isArray(response.data) ? response.data : [];
      const uniqueEbooks = dedupeById(data.filter((e) => e && e.id));
      const removed = getRemovedEbookIds();
      setEbooks(uniqueEbooks.filter((e) => !removed.includes(e.id)));
    } catch (error) {
      toast.error('Failed to load your ebooks');
    } finally {
      setLoading(false);
    }
  }, [dedupeById, getRemovedEbookIds]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    fetchEbooks();
  }, [authLoading, token, router, fetchEbooks]);

  const isValidPdfUrl = (pdfUrl) => typeof pdfUrl === 'string' && pdfUrl.startsWith('http');
  const toDownloadUrl = (pdfUrl) =>
    typeof pdfUrl === 'string' ? pdfUrl.replace('/upload/', '/upload/fl_attachment/') : pdfUrl;

  const downloadEbook = (pdfUrl, title) => {
    console.log('PDF URL:', pdfUrl);
    if (!isValidPdfUrl(pdfUrl)) {
      alert('Invalid PDF URL');
      return;
    }

    const link = document.createElement('a');
    link.href = toDownloadUrl(pdfUrl);
    link.download = `${title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const viewEbook = (pdfUrl) => {
    console.log('PDF URL:', pdfUrl);
    if (!isValidPdfUrl(pdfUrl)) {
      alert('Invalid PDF URL');
      return;
    }
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  };

  const handleRemove = (ebookId) => {
    if (!ebookId) return;
    const removed = getRemovedEbookIds();
    if (!removed.includes(ebookId)) {
      removed.push(ebookId);
      localStorage.setItem('removedEbooks', JSON.stringify(removed));
    }
    setEbooks((prev) => prev.filter((e) => e.id !== ebookId));
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-primary relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-pink-300/50 rounded-full blur-xl animate-float" style={{animationDelay: '0s'}}></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-300/50 rounded-full blur-xl animate-float" style={{animationDelay: '2s'}}></div>
        </div>
        <motion.div 
          className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div 
            className="glass p-12 rounded-3xl max-w-md"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div 
              className="text-6xl mb-8 animate-bounce"
              animate={{ rotate: [0, 10, -10, 10, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              📚
            </motion.div>
            <motion.h2 
              className="gradient-glow text-3xl font-black mb-6"
              initial={{ y: 30 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Loading Your Library
            </motion.h2>
            <p className="text-white/90 text-xl mb-8">Preparing your digital collection...</p>
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/30 border-t-gradient-primary mx-auto"></div>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>My Ebooks - Bookstore</title>
      </Head>
      <div className="container mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
              My Ebooks
            </h1>
            <p className="text-xl text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
              Access all your purchased ebooks anytime, anywhere. Download or view instantly.
            </p>
          </div>

          {ebooks.length === 0 ? (
            <motion.div 
              className="text-center py-24"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <motion.div className="text-8xl mb-8" animate={{ rotate: [0, 15, -15, 15, 0] }} transition={{ repeat: Infinity, duration: 4 }}>
                📚
              </motion.div>
              <motion.h2 
                className="text-4xl lg:text-5xl font-black mb-6 gradient-glow"
                initial={{ y: 30 }}
                whileInView={{ y: 0 }}
                viewport={{ once: true }}
              >
                Your Library is Empty
              </motion.h2>
              <motion.p 
                className="text-xl text-gray-600 dark:text-slate-300 mb-12 max-w-lg mx-auto leading-relaxed"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Start your digital library by purchasing ebooks from our premium collection.
              </motion.p>
              <motion.button
                onClick={() => router.push('/ebooks')}
                className="btn-gradient px-10 py-6 text-xl font-black shadow-2xl hover:shadow-3xl"
                whileHover={{ scale: 1.1, y: -5 }}
                whileTap={{ scale: 0.98 }}
              >
                Explore Ebooks →
              </motion.button>
            </motion.div>
          ) : (
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ staggerChildren: 0.12 }}
              viewport={{ once: true }}
            >
              {ebooks.map((ebook, index) => (
                <motion.div 
                  key={ebook.id} 
                  className="group glass bg-gradient-to-br from-white/80 to-slate-50/80 dark:from-slate-900/70 dark:to-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl hover:shadow-3xl border border-white/40 dark:border-slate-700/50 hover:border-primary-300/50 overflow-hidden hover:-translate-y-3 transition-all duration-500"
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  viewport={{ once: false }}
                  whileHover={{ scale: 1.05 }}
                >
                  <div className="overflow-hidden rounded-t-3xl">
                    <Image
                      src={ebook.image_url || '/placeholder-book.jpg'}
                      alt={ebook.title}
                      width={300}
                      height={420}
                      className="w-full h-72 lg:h-80 object-cover group-hover:scale-110 transition-transform duration-700 hover:brightness-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none"></div>
                  </div>
                  <div className="p-8">
                    <motion.h3 
                      className="font-black text-xl lg:text-2xl mb-4 line-clamp-2 text-slate-900 dark:text-slate-100 group-hover:gradient-glow transition-all duration-500 leading-tight"
                      whileHover={{ y: -8 }}
                    >
                      {ebook.title}
                    </motion.h3>
                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className="px-4 py-1 bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-200 text-xs font-bold rounded-full">Digital</span>
                      <span className="px-4 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200 text-xs font-bold rounded-full">Instant Access</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-white/30 dark:border-slate-700/50">
                      <motion.button
                        onClick={() => downloadEbook(ebook.pdf_url, ebook.title)}
                        className="flex-1 btn-gradient hover:shadow-2xl text-sm lg:text-base"
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        📥 Download PDF
                      </motion.button>
                      <motion.button
                        onClick={() => viewEbook(ebook.pdf_url)}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white py-3 px-6 rounded-2xl font-bold text-sm lg:text-base shadow-xl hover:shadow-2xl transition-all duration-300"
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        👁️ View Online
                      </motion.button>
                    </div>
                    <motion.button
                      onClick={() => handleRemove(ebook.id)}
                      className="w-full mt-6 bg-gradient-to-r from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 dark:from-slate-800 dark:to-slate-700 dark:hover:from-slate-700 dark:hover:to-slate-600 text-gray-800 dark:text-slate-100 py-3 px-6 rounded-2xl font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-2"
                      initial={{ opacity: 0 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <span>✖</span>
                      <span>Hide from Library</span>
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
      </div>
    </>
  );
}
