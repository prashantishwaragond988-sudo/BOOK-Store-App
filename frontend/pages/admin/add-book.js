import AdminGuard from '../../components/AdminGuard';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import toast from 'react-hot-toast';
import api from '../../lib/api';

import { productsAPI } from '../../lib/api';

console.log("CLOUD NAME:", process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);
console.log("PRESET:", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);

function AddBookContent() {
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    description: '',
    category: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [categories, setCategories] = useState([]); 
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      toast.error('Please select an image');
      return;
    }
    setLoading(true);
    try {
      // Upload image to Cloudinary
      const uploadFormData = new FormData();
      uploadFormData.append('file', imageFile);
      uploadFormData.append('upload_preset', 'bookstore_upload');

      const uploadRes = await fetch(
        'https://api.cloudinary.com/v1_1/dfsqvlp0i/image/upload',
        {
          method: 'POST',
          body: uploadFormData,
        }
      );

      const uploadData = await uploadRes.json();
      console.log("Cloudinary response:", uploadData);
      const imageUrl = uploadData.secure_url;
      if (!imageUrl) {
        throw new Error("Cloudinary upload failed");
      }

      // Submit book with image URL
      const submitData = {
        ...formData,
        image: imageUrl
      };

      await api.post('/admin/add-book', submitData);
      toast.success('Book added successfully!');
      router.push('/admin');
    } catch (error) {
      console.error('Add book error:', error);
      toast.error('Failed to add book');
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  useEffect(() => {
    productsAPI.getCategories().then(res => {
      setCategories(res.data || []);
      setLoadingCategories(false);
    }).catch(() => {
      toast.error('Failed to load categories');
      setLoadingCategories(false);
    });
  }, []);

  return (
    <>
      <Head>
        <title>Add Book - Admin</title>
      </Head>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <button 
            onClick={() => router.back()}
            className="inline-flex items-center px-6 py-3 bg-gray-200 hover:bg-gray-300 text-lg font-medium rounded-xl mb-6"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-500 to-green-600 bg-clip-text text-transparent mb-4">
            Add New Book
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-3xl shadow-2xl">
          <div>
            <label className="block text-lg font-semibold mb-3 text-gray-800">Book Title</label>
            <input
              type="text"
              name="title"
              placeholder="Enter book title..."
              className="w-full p-5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-200 focus:border-emerald-400 text-lg"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block text-lg font-semibold mb-3 text-gray-800">Price (₹)</label>
            <input
              type="number"
              name="price"
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full p-5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-200 focus:border-emerald-400 text-lg"
              value={formData.price}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block text-lg font-semibold mb-3 text-gray-800">Description</label>
            <textarea
              name="description"
              rows="6"
              placeholder="Enter book description..."
              className="w-full p-5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-200 focus:border-emerald-400 text-lg resize-vertical"
              value={formData.description}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block text-lg font-semibold mb-3 text-gray-800">Category</label>
            <select
              name="category"
              className="w-full p-5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-200 focus:border-emerald-400 text-lg bg-white"
              value={formData.category}
              onChange={handleChange}
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-lg font-semibold mb-3 text-gray-800">Book Cover Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                console.log("Selected file:", file);
                setImageFile(file);
              }}
              className="w-full p-5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-200 focus:border-emerald-400 text-lg file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-lg file:font-semibold file:bg-gradient-to-r file:from-emerald-500 file:to-green-600 file:text-white hover:file:from-emerald-600 hover:file:to-green-700"
              required
            />
            {imageFile && (
              <p className="text-sm text-emerald-600 mt-1">{imageFile.name}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white py-6 px-8 rounded-2xl font-bold text-2xl shadow-2xl hover:shadow-3xl transition-all disabled:opacity-50 flex items-center justify-center space-x-3"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <span>Adding Book...</span>
              </>
            ) : (
              '➕ Add Book'
            )}
          </button>
        </form>
      </div>
    </>
  );
}

export default function AddBook() {
  return <AdminGuard><AddBookContent /></AdminGuard>;
}
