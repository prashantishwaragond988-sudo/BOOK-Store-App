import AdminGuard from '../../components/AdminGuard';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import toast from 'react-hot-toast';
import api from '../../lib/api';

function AddCategoryContent() {
  const [formData, setFormData] = useState({
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    setLoading(true);
    try {
      await api.post('/admin/add-category', formData);
      toast.success('Category added successfully!');
      setFormData({ name: '' });
      // router.push('/admin'); // Stay to add more
    } catch (error) {
      console.error('Category add error:', error.response?.data || error);
      toast.error(error.response?.data?.message || error.message || 'Failed to add category');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <>
      <Head>
        <title>Add Category - Admin</title>
      </Head>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <button 
            onClick={() => router.back()}
            className="inline-flex items-center px-6 py-3 bg-gray-200 hover:bg-gray-300 text-lg font-medium rounded-xl mb-6"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent mb-4">
            Add New Category
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-3xl shadow-2xl">
          <div>
            <label className="block text-lg font-semibold mb-3 text-gray-800">Category Name</label>
            <input
              type="text"
              name="name"
              placeholder="e.g. Fiction, Sci-Fi, Self-Help..."
              className="w-full p-5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-200 focus:border-indigo-400 text-lg"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white py-6 px-8 rounded-2xl font-bold text-2xl shadow-2xl hover:shadow-3xl transition-all disabled:opacity-50 flex items-center justify-center space-x-3"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <span>Adding Category...</span>
              </>
            ) : (
              '🏷️ Add Category'
            )}
          </button>
        </form>
      </div>
    </>
  );
}

export default function AddCategory() {
  return <AdminGuard><AddCategoryContent /></AdminGuard>;
}

