import { useState, useEffect } from 'react';
import { productsAPI } from '../lib/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function CategoriesGrid({ onCategorySelect, activeCategoryId }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productsAPI.getCategories().then(res => {
      setCategories(res.data || []);
      setLoading(false);
    }).catch(() => {
      toast.error('Failed to load categories');
      setLoading(false);
    });
  }, []);

  const handleSelect = (category) => {
    const newId = activeCategoryId === category.id ? null : category.id;
    onCategorySelect(newId);
  };

  if (loading) {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4">
          <motion.h2 
            className="text-3xl font-bold mb-8 text-center gradient-glow"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Categories
          </motion.h2>
          <motion.div 
            className="flex justify-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
          >
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-gradient-primary"></div>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <motion.section 
      className="py-12 bg-gradient-to-br from-indigo-50/50 via-purple-50/50 to-pink-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
    >
      <div className="container mx-auto px-4">
        <motion.h2 
          className="text-3xl lg:text-4xl font-black mb-16 text-center gradient-glow"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          🏷️ Browse by Category
        </motion.h2>
        <motion.div 
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ staggerChildren: 0.08 }}
          viewport={{ once: true }}
        >
          {/* All Books */}
          <motion.div 
            className={`glass p-8 rounded-3xl text-center cursor-pointer transition-all duration-500 group hover:shadow-3xl border-2 border-transparent hover:border-white/40 ${
              !activeCategoryId ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-2xl border-primary-200/50 ring-4 ring-primary-400/50' : 'bg-white/70 dark:bg-slate-900/60 shadow-2xl hover:shadow-3xl'
            }`}
            onClick={() => handleSelect({id: null})}
            whileHover={{ scale: 1.1, rotateX: 5 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div 
              className="text-4xl mb-4 mx-auto w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
              animate={{ rotate: [0, 360] }}
              transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
            >
              🎯
            </motion.div>
            <h3 className="font-black text-xl lg:text-2xl mb-2">All Books</h3>
            <p className="text-sm opacity-90">Explore everything</p>
          </motion.div>

          {categories.map((category, index) => (
            <motion.div 
              key={category.id}
              className={`glass p-8 rounded-3xl text-center cursor-pointer transition-all duration-500 group hover:shadow-3xl border-2 border-transparent hover:border-white/40 ${
                activeCategoryId === category.id 
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-2xl ring-4 ring-primary-400/50 border-primary-200/50' 
                  : 'bg-white/70 dark:bg-slate-900/60 shadow-2xl hover:shadow-3xl'
              }`}
              onClick={() => handleSelect(category)}
              whileHover={{ scale: 1.1, rotateX: 5 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <motion.div 
                className="text-4xl mb-4 mx-auto w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                📚
              </motion.div>
              <h3 className="font-black text-lg lg:text-xl mb-1 line-clamp-1 group-hover:gradient-glow transition-all">{category.name}</h3>
              <p className="text-sm opacity-80">Discover more</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}

