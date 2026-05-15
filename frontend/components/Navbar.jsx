import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ShoppingCart,
  User,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Bell,
  LayoutDashboard,
  Settings,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSearch } from '../context/SearchContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const { search, setSearch } = useSearch();

  const [cartCount, setCartCount] = useState(0);
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(2);

  const profileRef = useRef(null);
  const notifRef = useRef(null);
  const isSignedIn = !!token;
  const isAdmin = user?.role === 'admin';

  const sampleNotifications = [
    { id: 1, text: 'New book "React Mastery" is now available!', time: '2 min ago' },
    { id: 2, text: 'Your order #1023 has been shipped.', time: '1 hour ago' },
  ];

  const navItems = isAdmin
    ? [
        { href: '/admin', label: 'Dashboard' },
        { href: '/admin/manage-books', label: 'Manage Books' },
        { href: '/admin/add-book', label: 'Add Book' },
        { href: '/admin/orders', label: 'Orders' },
      ]
    : [
        { href: '/', label: 'Home' },
        { href: '/books', label: 'Books' },
        { href: '/ebooks', label: 'Ebooks' },
        { href: '/cart', label: 'Cart' },
        { href: '/orders', label: 'Orders' },
        { href: '/my-ebooks', label: 'My Books' },
        { href: '/profile', label: 'Profile' },
      ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
    setProfileOpen(false);
    setNotifOpen(false);
  }, [router.pathname]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        const cart = JSON.parse(savedCart);
        const count = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
        setCartCount(count);
      }
    }
  }, [router.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (href) => router.pathname === href;

  return (
    <motion.header
      className={`fixed top-0 left-0 w-full z-50 py-3 px-4 sm:px-6 transition-all duration-300 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-md shadow-md border-b border-gray-200 dark:bg-slate-900/80 dark:border-slate-700'
          : 'bg-white/80 backdrop-blur-md border-b border-gray-200 dark:bg-slate-900/80 dark:border-slate-700'
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <motion.div
          className="flex items-center gap-2 cursor-pointer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push(isAdmin ? '/admin' : '/')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl sm:text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Bookstore
          </span>
        </motion.div>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <motion.button
                key={item.href}
                type="button"
                onClick={() => router.push(item.href)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                {item.label}
              </motion.button>
            );
          })}
        </nav>

        {/* Right Icons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile toggle */}
          <motion.button
            type="button"
            className="lg:hidden p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 transition-all dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100"
            onClick={() => setMobileNavOpen((v) => !v)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Toggle navigation"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </motion.button>

          {/* Search */}
          <div className="relative">
            <AnimatePresence>
              {showSearch && (
                <motion.input
                  key="search-input"
                  type="text"
                  placeholder="Search books, ebooks, authors..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-64 sm:w-80 px-4 py-2.5 pr-10 bg-white border border-gray-200 rounded-full text-gray-800 placeholder-gray-400 shadow-lg outline-none focus:ring-2 focus:ring-purple-300 text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  initial={{ opacity: 0, scaleX: 0.8, x: 20 }}
                  animate={{ opacity: 1, scaleX: 1, x: 0 }}
                  exit={{ opacity: 0, scaleX: 0.8, x: 20 }}
                  transition={{ duration: 0.2 }}
                  autoFocus
                />
              )}
            </AnimatePresence>
            <motion.button
              type="button"
              className={`p-2.5 rounded-full transition-all ${
                showSearch
                  ? 'bg-purple-100 text-purple-600'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100'
              }`}
              onClick={() => setShowSearch((v) => !v)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Theme Toggle */}
          <motion.button
            type="button"
            className="hidden sm:flex items-center gap-2 px-3 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 transition-all dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100"
            onClick={toggleTheme}
            whileHover={{ scale: 1.1, rotate: 15 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span className="hidden md:inline text-sm font-semibold">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          </motion.button>

          {/* Notifications */}
          <div className="relative hidden sm:block" ref={notifRef}>
            <motion.button
              type="button"
              className="flex p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 relative transition-all dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100"
              onClick={() => setNotifOpen((v) => !v)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-sm">
                  {notifications}
                </span>
              )}
            </motion.button>

            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  className="absolute right-0 mt-3 w-72 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50 dark:bg-slate-900 dark:border-slate-700"
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800">
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                      Notifications
                    </p>
                  </div>
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {sampleNotifications.map((n) => (
                      <div
                        key={n.id}
                        className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <p className="text-sm text-gray-700 dark:text-slate-200">{n.text}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-400 mt-1">{n.time}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Cart */}
          <motion.button
            type="button"
            className="hidden sm:flex p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 relative transition-all dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100"
            onClick={() => router.push('/cart')}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Cart"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <motion.span
                className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-sm"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                {cartCount}
              </motion.span>
            )}
          </motion.button>

          {/* User / Profile Dropdown */}
          {isSignedIn ? (
            <div className="relative" ref={profileRef}>
              <motion.button
                type="button"
                className={`p-1 rounded-full transition-all ${
                  profileOpen
                    ? 'ring-2 ring-purple-400 ring-offset-2 dark:ring-offset-slate-900'
                    : ''
                }`}
                onClick={() => setProfileOpen((v) => !v)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Open profile menu"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
                  <User className="w-5 h-5 text-white" />
                </div>
              </motion.button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50 dark:bg-slate-900 dark:border-slate-700"
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800">
                      <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                        {user?.name || 'My Account'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {user?.email || ''}
                      </p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => router.push('/profile')}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-left"
                      >
                        <LayoutDashboard className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                        Dashboard
                      </button>
                      <button
                        onClick={() => router.push('/settings')}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-left"
                      >
                        <Settings className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                        Settings
                      </button>
                      <button
                        onClick={() => router.push('/help')}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-left"
                      >
                        <HelpCircle className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                        Help & Support
                      </button>
                    </div>
                    <div className="border-t border-gray-100 dark:border-slate-800 py-1">
                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <motion.button
              type="button"
              className="px-5 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all"
              onClick={() => router.push('/auth/login')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              Sign In
            </motion.button>
          )}
        </div>
      </div>

      {/* Mobile Nav Panel */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            className="lg:hidden mt-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-3 grid grid-cols-2 gap-2 dark:bg-slate-900 dark:border-slate-700">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => router.push(item.href)}
                    className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
                      active
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={toggleTheme}
                className="col-span-2 py-2.5 px-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
                {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              </button>
              {!isSignedIn && (
                <button
                  type="button"
                  onClick={() => router.push('/auth/login')}
                  className="col-span-2 py-2.5 px-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm"
                >
                  Sign In
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

