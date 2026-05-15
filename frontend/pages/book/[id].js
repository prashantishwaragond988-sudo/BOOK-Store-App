import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { productsAPI } from '../../lib/api';
import toast from 'react-hot-toast';
import Head from 'next/head';

export default function BookDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [books, setBooks] = useState([]);
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    if (!id) return;
    productsAPI.getBooks().then(res => {
      setBooks(res.data);
      const foundBook = res.data.find(b => b.id == id);
      setBook(foundBook);
      setLoading(false);
    }).catch(() => {
      toast.error('Failed to load book');
      setLoading(false);
    });

    // Load cart
    const savedCart = localStorage.getItem('cart');
    if (savedCart) setCart(JSON.parse(savedCart));
  }, [id]);

  const addToCart = () => {
    const existingItem = cart.find(item => item.id === book.id);
    let newCart;
    if (existingItem) {
      newCart = cart.map(item =>
        item.id === book.id ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      newCart = [...cart, { ...book, quantity: 1 }];
    }
    localStorage.setItem('cart', JSON.stringify(newCart));
    setCart(newCart);
    toast.success(`${book.title} added to cart!`);
  };

  const buyNow = () => {
    addToCart();
    router.push('/checkout');
  };

  if (loading) return <div className="container mx-auto px-4 py-8"><p>Loading...</p></div>;
  if (!book) return <div className="container mx-auto px-4 py-8"><p>Book not found</p></div>;

  return (
    <>
      <Head>
        <title>{book.title} - Bookstore</title>
      </Head>
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="mb-8 inline-flex items-center px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 rounded-lg"
        >
          ← Back to Books
        </button>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <img
              src={book.image_url}
              alt={book.title}
              className="w-full h-96 object-cover rounded-lg shadow-xl"
            />
          </div>
          <div className="space-y-6">
            <h1 className="text-4xl font-bold">{book.title}</h1>
            <p className="text-3xl font-bold text-green-600">₹{book.price}</p>
            <p className="text-gray-700 dark:text-slate-300 leading-relaxed">{book.description}</p>
            <div className="space-y-4 pt-8 border-t dark:border-slate-700">
              <button
                onClick={addToCart}
                className="w-full btn-primary py-4 text-lg font-semibold"
              >
                Add to Cart
              </button>
              <button
                onClick={buyNow}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 text-lg font-bold rounded-lg"
              >
                Buy Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export async function getStaticPaths() {
  let bookIds = [];

  try {
    // NOTE: This file is generated at build-time for static export.
    // If it's missing, we export no dynamic book pages (Flask should still SPA-fallback to /index.html).
    // eslint-disable-next-line global-require
    const fs = require('fs');
    // eslint-disable-next-line global-require
    const path = require('path');

    const manifestPath = path.join(process.cwd(), '.static-export-manifest.json');
    if (fs.existsSync(manifestPath)) {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(raw);
      if (Array.isArray(manifest?.bookIds)) bookIds = manifest.bookIds;
    }
  } catch {
    // ignore: fall back to no pre-rendered dynamic pages
  }

  const paths = bookIds.map((id) => ({ params: { id: String(id) } }));
  return { paths, fallback: false };
}

export async function getStaticProps() {
  return { props: {} };
}

