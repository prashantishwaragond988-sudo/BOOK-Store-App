import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { productsAPI, ordersAPI, userAPI } from '../lib/api';
import toast from 'react-hot-toast';

export default function Ebooks() {
  const [ebooks, setEbooks] = useState([]);
  const [purchasedMap, setPurchasedMap] = useState({});
  const router = useRouter();

  useEffect(() => {
    productsAPI.getEbooks().then(res => setEbooks(res.data)).catch(() => toast.error('Load ebooks failed'));
  }, []);

  useEffect(() => {
    if (!Array.isArray(ebooks) || ebooks.length === 0) return;

    let cancelled = false;

    const checkPurchases = async () => {
      let map = {};

      for (let ebook of ebooks) {
        try {
          const res = await userAPI.hasPurchased(ebook.id);
          map[ebook.id] = !!res.data?.purchased;
        } catch {
          map[ebook.id] = false;
        }

        if (cancelled) return;
      }

      setPurchasedMap(map);
    };

    checkPurchases();

    return () => {
      cancelled = true;
    };
  }, [ebooks]);

  const addToCart = (ebook) => {
    ordersAPI.addToCart({ product_id: ebook.id, type: 'ebook', quantity: 1 }).then(() => {
      toast.success(`${ebook.title} added to cart!`);
    }).catch(() => toast.error('Add to cart failed'));
  };

  const buyNow = (ebook) => {
    localStorage.setItem('current_ebook', JSON.stringify(ebook));
    router.push('/checkout-ebook');
  };

  const isValidPdfUrl = (pdfUrl) => typeof pdfUrl === 'string' && pdfUrl.startsWith('http');
  const toDownloadUrl = (pdfUrl) =>
    typeof pdfUrl === 'string' ? pdfUrl.replace('/upload/', '/upload/fl_attachment/') : pdfUrl;

  const viewEbook = (ebookId) => {
    const ebook = ebooks.find((e) => e?.id === ebookId);
    const pdfUrl = ebook?.pdf_url;

    if (!isValidPdfUrl(pdfUrl)) {
      toast.error('View not available');
      return;
    }

    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  };

  const downloadEbook = (ebookId) => {
    const ebook = ebooks.find((e) => e?.id === ebookId);
    const pdfUrl = ebook?.pdf_url;
    const title = ebook?.title;

    if (!isValidPdfUrl(pdfUrl)) {
      toast.error('Download not available');
      return;
    }

    const link = document.createElement('a');
    link.href = toDownloadUrl(pdfUrl);
    link.download = `${String(title || 'ebook').replace(/[^a-z0-9]/gi, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-12 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
        All Ebooks
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {ebooks.map(ebook => (
          <div key={ebook.id} className="product-card">
            <img src={ebook.image_url} alt={ebook.title} className="w-full h-64 object-cover rounded mb-4" />
            <h3 className="font-semibold text-lg mb-2 line-clamp-2">{ebook.title}</h3>
            <p className="text-gray-600 dark:text-slate-300 mb-4 line-clamp-2">{ebook.description}</p>
            <p className="text-2xl font-bold text-green-600 mb-4">₹{ebook.price}</p>
            {purchasedMap[ebook.id] ? (
              <>
                <button
                  onClick={() => downloadEbook(ebook.id)}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  Download
                </button>
                <button
                  onClick={() => viewEbook(ebook.id)}
                  className="w-full mt-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  View
                </button>
              </>
            ) : (
              <>
            <button onClick={() => addToCart(ebook)} className="w-full btn-primary mb-2">
              Add to Cart
            </button>
            <button 
              onClick={() => buyNow(ebook)} 
              className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
            >
              💳 Buy Now
            </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
