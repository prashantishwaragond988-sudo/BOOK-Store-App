import AdminGuard from '../../components/AdminGuard';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { productsAPI } from '../../lib/api';
import Image from 'next/image';
import api from '../../lib/api';

function ManageBooksContent() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    productsAPI.getBooks().then(res => {
      setBooks(res.data);
      setLoading(false);
    }).catch(() => {
      toast.error('Failed to load books');
      setLoading(false);
    });
  }, []);

  const deleteBook = async (id) => {
    if (!confirm('Are you sure you want to delete this book?')) return;
    
    try {
      await api.delete(`/admin/books/${id}`);
      setBooks(books.filter(book => book.id !== id));
      toast.success('Book deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete book');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading books...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Manage Books - Admin</title>
      </Head>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <button 
              onClick={() => router.back()}
              className="inline-flex items-center px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 text-lg font-medium rounded-xl mb-4 md:mb-0"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-indigo-600 bg-clip-text text-transparent">
              Manage Books ({books.length})
            </h1>
          </div>
          <Link 
            href="/admin/add-book" 
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-xl hover:shadow-2xl transition-all"
          >
            ➕ Add New Book
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200/60 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800">
                <tr>
                  <th className="p-6 text-left text-lg font-bold text-gray-800 dark:text-slate-100">Image</th>
                  <th className="p-6 text-left text-lg font-bold text-gray-800 dark:text-slate-100">Title</th>
                  <th className="p-6 text-left text-lg font-bold text-gray-800 dark:text-slate-100">Price</th>
                  <th className="p-6 text-left text-lg font-bold text-gray-800 dark:text-slate-100">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                {books.map((book) => (
                  <tr key={book.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="p-6">
                      <Image
                        src={book.image_url}
                        alt={book.title}
                        width={60}
                        height={80}
                        className="rounded-xl object-cover"
                      />
                    </td>
                    <td className="p-6">
                      <div className="font-semibold text-lg">{book.title}</div>
                      <div className="text-sm text-gray-500 dark:text-slate-400 line-clamp-2">{book.description}</div>
                    </td>
                    <td className="p-6">
                      <span className="text-2xl font-bold text-green-600">₹{book.price}</span>
                    </td>
                    <td className="p-6">
                      <div className="flex space-x-3">
                        <button 
                          onClick={() => {/* Edit modal */ toast('Edit coming soon!')}}
                          className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-all"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => deleteBook(book.id)}
                          className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ManageBooks() {
  return <AdminGuard><ManageBooksContent /></AdminGuard>;
}
