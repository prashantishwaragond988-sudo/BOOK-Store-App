import { useState, useEffect } from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { Sun, Moon, Bell, Globe, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';

export default function Settings() {
  const [language, setLanguage] = useState('English');
  const [notifications, setNotifications] = useState(true);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('language');
      const savedNotif = localStorage.getItem('notifications');
      if (savedLang) setLanguage(savedLang);
      if (savedNotif !== null) setNotifications(savedNotif === 'true');
    }
  }, []);

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', language);
      localStorage.setItem('notifications', String(notifications));
      localStorage.setItem('theme', theme);
    }
    toast.success('Preferences saved successfully!');
  };

  const languages = ['English', 'Hindi', 'Spanish', 'French', 'German'];

  return (
    <>
      <Head>
        <title>Settings - Bookstore</title>
      </Head>
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Settings
          </h1>
          <p className="text-xl text-gray-600 dark:text-slate-300">Manage your preferences</p>
        </motion.div>

        <motion.div
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 space-y-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {/* Language Selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 dark:text-slate-100">Language</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Choose your preferred language
                </p>
              </div>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 text-sm font-medium outline-none focus:ring-2 focus:ring-purple-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800" />

          {/* Notification Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-green-100 text-green-600">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 dark:text-slate-100">Notifications</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Receive updates and alerts
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNotifications((v) => !v)}
              className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${
                notifications
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                  : 'bg-gray-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                  notifications ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800" />

          {/* Theme Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-yellow-100 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-300">
                {theme === 'light' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-gray-800 dark:text-slate-100">Theme</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Switch between light and dark mode
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                  : 'bg-gray-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800" />

          {/* Save Button */}
          <motion.button
            type="button"
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-lg shadow-xl hover:shadow-2xl transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Save className="w-5 h-5" />
            Save Preferences
          </motion.button>
        </motion.div>
      </div>
    </>
  );
}

