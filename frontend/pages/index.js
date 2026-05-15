import { useState, useEffect } from 'react';
import CategoriesGrid from '../components/CategoriesGrid';
import BookGrid from '../components/BookGrid';
import Hero from '../components/Hero';
import { productsAPI } from '../lib/api';
import toast from 'react-hot-toast';
import Head from 'next/head';

export default function Home() {
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [books, setBooks] = useState([]);
  const [ebooks, setEbooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [loadingEbooks, setLoadingEbooks] = useState(true);

  const handleCategorySelect = (categoryId) => {
    setActiveCategoryId(categoryId);
  };

  useEffect(() => {
    const loadBooks = async () => {
      try {
        setLoadingBooks(true);
        const params = { limit: 8 };
        if (activeCategoryId) params.category = activeCategoryId;
        const res = await productsAPI.getBooks(params);
        setBooks(res.data || []);
      } catch {
        toast.error('Failed to load books');
      } finally {
        setLoadingBooks(false);
      }
    };

    loadBooks();
  }, [activeCategoryId]);

  useEffect(() => {
    productsAPI
      .getEbooks()
      .then((res) => {
        setEbooks(res.data || []);
      })
      .catch(() => {
        toast.error('Failed to load ebooks');
      })
      .finally(() => {
        setLoadingEbooks(false);
      });
  }, []);

  return (
    <>
      <Head>
        <title>Bookstore - Discover Amazing Books</title>
        <meta name="description" content="Browse our collection of featured and latest books across various categories. Find your next favorite read!" />
      </Head>

      <Hero />

      {/* Categories */}
      <CategoriesGrid 
        onCategorySelect={handleCategorySelect}
        activeCategoryId={activeCategoryId}
      />

      {/* Books */}
      <BookGrid title="Books" books={books} loading={loadingBooks} />

      {/* Ebooks */}
      <BookGrid title="Ebooks" books={ebooks} loading={loadingEbooks} isEbook={true} />

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto px-4 text-center text-white">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">Ready to Start Reading?</h2>
          <p className="text-xl mb-12 opacity-90 max-w-2xl mx-auto">
            Join thousands of readers discovering new worlds every day.
          </p>
          <button className="bg-white text-blue-600 px-12 py-6 rounded-3xl text-2xl font-bold shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-105">
            Start Shopping Now →
          </button>
        </div>
      </section>
    </>
  );
}

export async function getStaticProps() {
  return { props: {} };
}

