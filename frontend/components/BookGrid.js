import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

import { useSearch } from '../context/SearchContext';

export default function BookGrid({ title, books = [], loading = false, isEbook = false, className = '' }) {
  const { search } = useSearch();
  const router = useRouter();

  const filteredBooks = books.filter(book => {
    const title = book?.title?.toLowerCase() || "";
    const desc = book?.description?.toLowerCase() || "";
    const category = book?.category?.toLowerCase() || "";
    const query = (search || "").toLowerCase();

    return (
      title.includes(query) ||
      desc.includes(query) ||
      category.includes(query)
    );
  });

  const addToCart = (book) => {
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existing = cart.find(item => item.id === book.id);
    const productType = isEbook || book.type === 'ebook' ? 'ebook' : 'physical';
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ ...book, quantity: 1, type: productType });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    toast.success(`${book.title} added to cart!`);
  };

  const buyNow = (book) => {
    const productType = isEbook || book.type === 'ebook' ? 'ebook' : 'physical';
    if (productType === 'ebook') {
      localStorage.setItem('current_ebook', JSON.stringify(book));
      router.push('/checkout-ebook');
    } else {
      addToCart(book);
      router.push('/checkout');
    }
  };

  const viewDetails = (book) => {
    router.push(`/book/${book.id}`); 
  };

  if (loading) {
    return (
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.h2 
            className="text-3xl font-bold mb-12 text-center gradient-glow"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            {title}
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {[...Array(8)].map((_, i) => (
              <motion.div 
                key={i} 
                className="animate-pulse glass-dark rounded-3xl p-8 shadow-2xl"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="bg-white/30 h-72 rounded-2xl mb-4"></div>
                <div className="bg-white/30 h-6 rounded mb-2"></div>
                <div className="bg-white/30 h-6 rounded w-3/4 mb-4"></div>
                <div className="bg-white/30 h-12 rounded-2xl"></div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <motion.h2 
          className="text-3xl lg:text-4xl font-black mb-12 text-center gradient-glow"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          {title}
        </motion.h2>
        {filteredBooks.length === 0 ? (
          <motion.div 
            className="text-center py-20"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <div className="text-6xl mb-4 animate-bounce">📚</div>
            <h3 className="text-2xl font-bold text-gray-600 dark:text-slate-200 mb-2 gradient-glow">
              No books found
            </h3>
            <p className="text-gray-500 dark:text-slate-400 text-lg">
              Try another category or search differently
            </p>
          </motion.div>
        ) : (
          <motion.div 
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 ${className}`}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1 }}
            viewport={{ once: true }}
          >
            {filteredBooks.map((book, index) => (
              <motion.div 
                key={book.id} 
                className="glass bg-gradient-to-br from-white/70 to-slate-50/70 dark:from-slate-900/70 dark:to-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl hover:shadow-3xl border border-white/30 dark:border-slate-700/50 overflow-hidden group hover:-translate-y-4 transition-all duration-500"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false }}
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <div className="relative overflow-hidden h-80 group">
                  <img 
                    src={book.image_url} 
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  {book.created_at && (
                    <motion.div 
                      className="absolute top-6 left-6 bg-gradient-to-r from-yellow-400/90 to-orange-400/90 text-black px-4 py-2 rounded-full text-sm font-bold shadow-2xl backdrop-blur-sm"
                      initial={{ scale: 0 }}
                      whileHover={{ scale: 1.1 }}
                    >
                      New Arrival
                    </motion.div>
                  )}
                </div>
                <div className="p-8">
                  <motion.h3 
                    className="font-black text-xl mb-4 line-clamp-2 text-slate-900 dark:text-slate-100 group-hover:gradient-glow transition-all duration-300 leading-tight"
                    whileHover={{ y: -5 }}
                  >
                    {book.title}
                  </motion.h3>
                  {book.description && (
                    <p className="text-gray-700 dark:text-slate-300 mb-6 text-sm line-clamp-3 leading-relaxed backdrop-blur-sm">
                      {book.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mb-8">
                    <motion.span 
                      className="text-3xl font-black gradient-glow drop-shadow-2xl"
                      whileHover={{ scale: 1.1 }}
                    >
                      ₹{book.price}
                    </motion.span>
                  </div>
                  <div className="space-y-4">
                    <motion.button 
                      onClick={() => viewDetails(book)}
                      className="w-full bg-slate-900/10 hover:bg-slate-900/15 text-slate-900 dark:bg-white/10 dark:hover:bg-white/15 dark:text-slate-100 py-4 px-6 rounded-2xl font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl flex items-center justify-center space-x-3 hover:scale-[1.02] border border-slate-900/10 dark:border-white/10"
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7 0 7-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 0-7z" />
                      </svg>
                      <span>View Details</span>
                    </motion.button>
                    {isEbook ? (
                      <motion.button 
                        onClick={() => buyNow(book)}
                        className="w-full btn-gradient text-lg"
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        💫 Instant Download
                      </motion.button>
                    ) : (
                      <motion.button 
                        onClick={() => buyNow(book)}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white py-4 px-6 rounded-2xl font-bold text-lg shadow-2xl hover:shadow-3xl transition-all duration-300"
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        🚀 Buy Now
                      </motion.button>
                    )}
                    <motion.button 
                      onClick={() => addToCart(book)}
                      className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white py-4 px-6 rounded-2xl font-bold shadow-xl hover:shadow-2xl transition-all duration-300"
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      🛒 Add to Cart
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}

