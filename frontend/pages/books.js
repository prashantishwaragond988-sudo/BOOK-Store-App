import { useState, useEffect } from 'react';
import { productsAPI } from '../lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useSearch } from '../context/SearchContext';

export default function Books() {
  const [books, setBooks] = useState([]);
  const [cart, setCart] = useState([]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const { search } = useSearch();

  useEffect(() => {
    productsAPI.getBooks().then(res => {
      setBooks(res.data);
      setLoading(false);
    }).catch(() => {
      toast.error('Load books failed');
      setLoading(false);
    });

    // Load cart
    const savedCart = localStorage.getItem('cart');
    if (savedCart) setCart(JSON.parse(savedCart));
  }, []);

  const addToCart = (book) => {
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

  const buyNow = (book) => {
    addToCart(book);
    router.push('/checkout');
  };

  const viewDetails = (id) => {
    router.push(`/book/${id}`);
  };

  if (loading) return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Loading books...</p>
      </div>
    </div>
  );

  return (
    <>
      <Head>
        <title>Books - Bookstore</title>
      </Head>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-12 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          All Books
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {books.filter(book => {
            const title = book?.title?.toLowerCase() || '';
            const desc = book?.description?.toLowerCase() || '';
            const category = book?.category?.toLowerCase() || '';
            const query = (search || '').toLowerCase();
            return title.includes(query) || desc.includes(query) || category.includes(query);
          }).map(book => (
            <div key={book.id} className="product-card rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group">
              <div className="relative overflow-hidden">
                <img 
                  src={book.image_url} 
                  alt={book.title} 
                  className="w-full h-72 object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-3 right-3 bg-yellow-400 text-black px-2 py-1 rounded-full text-sm font-bold">
                  New
                </div>
              </div>
              <div className="p-6">
                <h3 className="font-bold text-xl mb-3 line-clamp-2 text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {book.title}
                </h3>
                <p className="text-gray-600 dark:text-slate-300 mb-4 text-sm line-clamp-3 leading-relaxed">
                  {book.description}
                </p>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-2xl font-bold text-green-600">₹{book.price}</span>
                </div>
                <div className="space-y-2">
                  <button 
                    onClick={() => viewDetails(book.id)}
                    className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 py-3 px-4 rounded-lg font-medium transition-all duration-200 border border-blue-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700"
                  >
                    👁️ View Details
                  </button>
                  <button 
                    onClick={() => buyNow(book)}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3 px-4 rounded-lg font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
                  >
                    🛒 Buy Now
                  </button>
                  <button 
                    onClick={() => addToCart(book)}
                    className="w-full btn-primary bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
                  >
                    + Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

