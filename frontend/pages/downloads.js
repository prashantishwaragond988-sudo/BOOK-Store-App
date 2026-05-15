import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';

export default function Downloads() {
  const [purchasedEbooks, setPurchasedEbooks] = useState([]);
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

  const fetchPurchasedEbooks = useCallback(async () => {
    try {
      const response = await api.get('/orders/my-ebooks');
      const data = Array.isArray(response.data) ? response.data : [];
      const uniqueEbooks = dedupeById(data.filter((e) => e && e.id));
      const removed = getRemovedEbookIds();
      setPurchasedEbooks(uniqueEbooks.filter((e) => !removed.includes(e.id)));
    } catch (error) {
      toast.error('Failed to load downloads');
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
    fetchPurchasedEbooks();
  }, [authLoading, token, router, fetchPurchasedEbooks]);

  const isValidPdfUrl = (pdfUrl) => typeof pdfUrl === 'string' && pdfUrl.startsWith('http');
  const toDownloadUrl = (pdfUrl) =>
    typeof pdfUrl === 'string' ? pdfUrl.replace('/upload/', '/upload/fl_attachment/') : pdfUrl;

  const downloadPdf = (pdfUrl) => {
    console.log('PDF URL:', pdfUrl);
    if (!isValidPdfUrl(pdfUrl)) {
      alert('Invalid PDF URL');
      return;
    }
    window.location.assign(toDownloadUrl(pdfUrl));
  };

  const viewPdf = (pdfUrl) => {
    console.log('PDF URL:', pdfUrl);
    if (!isValidPdfUrl(pdfUrl)) {
      alert('Invalid PDF URL');
      return;
    }
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Loading your downloads...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>My Downloads - Bookstore</title>
      </Head>
      <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold mb-12 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            My Downloads
          </h1>
          
          {purchasedEbooks.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📚</div>
              <h2 className="text-2xl font-bold mb-4 text-gray-600 dark:text-slate-200">No downloads yet</h2>
              <p className="text-lg text-gray-500 dark:text-slate-400 mb-8">Purchase ebooks to access them here anytime.</p>
              <button 
                onClick={() => router.push('/ebooks')}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-4 rounded-xl font-bold text-xl shadow-xl hover:shadow-2xl transition-all"
              >
                Browse Ebooks
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {purchasedEbooks.map((ebook) => (
                <div key={ebook.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl hover:shadow-2xl transition-all p-6 border border-gray-100 dark:border-slate-800">
                  <h3 className="text-xl font-bold mb-4 line-clamp-2">{ebook.title}</h3>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => downloadPdf(ebook.pdf_url)}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-xl font-bold transition-all shadow-md hover:shadow-lg"
                    >
                      📥 Download PDF
                    </button>
                    <button
                      onClick={() => viewPdf(ebook.pdf_url)}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-xl font-bold transition-all shadow-md hover:shadow-lg"
                    >
                      👁️ View PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </>
  );
}

