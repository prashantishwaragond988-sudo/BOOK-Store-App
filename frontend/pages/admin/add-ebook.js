import AdminGuard from '../../components/AdminGuard';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import ImageUpload from '../../components/ImageUpload';
import { productsAPI } from '../../lib/api';

function AddEbookContent() {
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    description: '',
    category: ''
  });
  const [imageUrl, setImageUrl] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handlePdfUpload = async (file) => {
    const uploadFormData = new FormData();
    uploadFormData.append('pdf', file);

    try {
      const res = await api.post('/admin/upload-pdf', uploadFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data.pdf_url;
    } catch (error) {
      throw new Error('PDF upload failed');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageUrl || !pdfFile) {
      toast.error('Please select image and PDF files');
      return;
    }

    setLoading(true);
    try {
      const pdfUrl = await handlePdfUpload(pdfFile);
      console.log('PDF URL:', pdfUrl);

      console.log('Sending ebook:', {
        title: formData.title,
        price: Number(formData.price),
        description: formData.description,
        category: formData.category,
        image: imageUrl,
        pdf_url: pdfUrl,
      });

      const res = await api.post('/admin/add-ebook', {
        title: formData.title,
        price: Number(formData.price),
        description: formData.description,
        category: formData.category,
        image: imageUrl,
        pdf_url: pdfUrl
      });

      console.log('Response:', res.data);
      if (!res.data?.success) {
        throw new Error('Failed to save ebook');
      }

      toast.success('Ebook added successfully!');
      router.push('/admin');
    } catch (error) {
      console.error('Ebook add error:', error);
      const message = error?.response?.data?.error || error?.message || 'Failed to add ebook.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
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
        <title>Add Ebook - Admin</title>
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
            Add New Ebook
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-3xl shadow-2xl">
          <div>
            <label className="block text-lg font-semibold mb-3 text-gray-800">Ebook Title</label>
            <input
              type="text"
              name="title"
              placeholder="Enter ebook title..."
              className="w-full p-5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-200 focus:border-indigo-400 text-lg"
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
              className="w-full p-5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-200 focus:border-indigo-400 text-lg"
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
              placeholder="Enter ebook description..."
              className="w-full p-5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-200 focus:border-indigo-400 text-lg resize-vertical"
              value={formData.description}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block text-lg font-semibold mb-3 text-gray-800">Category</label>
            <select
              name="category"
              className="w-full p-5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-200 focus:border-indigo-400 text-lg bg-white"
              value={formData.category}
              onChange={handleChange}
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <ImageUpload 
            label="Cover Image" 
            onUpload={(url) => setImageUrl(url)} 
          />

          <div>
            <label className="block text-lg font-semibold mb-3 text-gray-800">PDF File</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdfFile(e.target.files[0])}
              className="w-full p-5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-200 focus:border-indigo-400 text-lg file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-lg file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 cursor-pointer"
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
                <span>Adding Ebook...</span>
              </>
            ) : (
              '📱 Add Ebook'
            )}
          </button>
        </form>
      </div>
    </>
  );
}

export default function AddEbook() {
  return <AdminGuard><AddEbookContent /></AdminGuard>;
}

