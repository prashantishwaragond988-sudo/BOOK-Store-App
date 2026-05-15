import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ImageUpload({ onUpload, label = 'Upload Image' }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);

  const cloudName = "dfsqvlp0i";
  const uploadPreset = "bookstore_upload";

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const loadToast = toast.loading('Uploading image...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await res.json();
      console.log("Cloudinary response:", data);

      if (data.secure_url) {
        setPreview(data.secure_url);
        onUpload(data.secure_url);
        toast.success('Image uploaded successfully!', { id: loadToast });
      } else {
        toast.error('Upload failed: ' + (data.error?.message || 'Unknown error'), { id: loadToast });
      }
    } catch (error) {
      toast.error('Upload failed', { id: loadToast });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-lg font-semibold mb-3 text-gray-800 dark:text-slate-100">
        {label}
      </label>
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        disabled={uploading}
        className="w-full p-5 border border-gray-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-emerald-200 focus:border-emerald-400 text-lg file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-lg file:font-semibold file:bg-gradient-to-r file:from-emerald-500 file:to-green-600 file:text-white hover:file:from-emerald-600 hover:file:to-green-700 cursor-pointer"
      />
      {uploading && (
        <div className="flex items-center space-x-2 text-emerald-600">
          <div className="w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <span>Uploading...</span>
        </div>
      )}
      {preview && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border dark:border-slate-700">
          <img 
            src={preview} 
            alt="Preview" 
            className="w-full h-48 object-cover rounded-xl mb-2"
          />
          <p className="text-sm text-gray-600 dark:text-slate-300 truncate">Uploaded successfully</p>
        </div>
      )}
    </div>
  );
}
