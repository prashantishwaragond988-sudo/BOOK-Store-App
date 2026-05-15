import { useRef, useState } from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { Mail, MessageCircle, ChevronDown, ChevronUp, Send } from 'lucide-react';

export default function Help() {
  const [openFaq, setOpenFaq] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const lastSentAtRef = useRef(0);

  const faqs = [
    {
      id: 1,
      question: 'How do I track my order?',
      answer: 'You can track your order by visiting the Orders page in your profile. Once shipped, a tracking link will be available.',
    },
    {
      id: 2,
      question: 'Can I return a physical book?',
      answer: 'Yes, physical books can be returned within 14 days of delivery if they are in original condition. Ebooks are non-refundable once downloaded.',
    },
    {
      id: 3,
      question: 'How do I access my purchased ebooks?',
      answer: 'Go to "My Books" in the navigation menu. All your purchased ebooks are available for unlimited downloads.',
    },
    {
      id: 4,
      question: 'What payment methods are accepted?',
      answer: 'We accept all major credit/debit cards, UPI, net banking, and popular wallets. All transactions are securely encrypted.',
    },
  ];

  const handleToggle = (id) => {
    setOpenFaq((prev) => (prev === id ? null : id));
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const name = form.name.trim();
    const email = form.email.trim();
    const message = form.message.trim();

    if (!name || !email || !message) {
      setFeedback({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }
    if (!isValidEmail(email)) {
      setFeedback({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }
    if (message.length < 5 || message.length > 4000) {
      setFeedback({ type: 'error', text: 'Please enter a message between 5 and 4000 characters' });
      return;
    }
    if (Date.now() - lastSentAtRef.current < 15_000) {
      setFeedback({ type: 'error', text: 'Please wait a moment before sending another message' });
      return;
    }

    setSubmitting(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await fetch('/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          message,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.message || 'Failed to send message');
      }

      lastSentAtRef.current = Date.now();
      setFeedback({ type: 'success', text: 'Message sent successfully' });
      setForm({ name: '', email: '', message: '' });
    } catch (err) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to send message' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Help & Support - Bookstore</title>
      </Head>
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Help & Support
          </h1>
          <p className="text-xl text-gray-600 dark:text-slate-300">We are here to help you</p>
        </motion.div>

        {/* Contact Email */}
        <motion.div
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 mb-8 flex items-center gap-4 border border-slate-200/60 dark:border-slate-800"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-slate-100">Contact Us</h3>
            <p className="text-gray-600 dark:text-slate-300">psibookstore93@gmail.com</p>
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 mb-8 border border-slate-200/60 dark:border-slate-800"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-6 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-purple-500" />
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.id}
                className="border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(faq.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="font-semibold text-gray-800 dark:text-slate-100">{faq.question}</span>
                  {openFaq === faq.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-500 dark:text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500 dark:text-slate-400" />
                  )}
                </button>
                {openFaq === faq.id && (
                  <motion.div
                    className="px-5 pb-4 text-gray-600 dark:text-slate-300 text-sm leading-relaxed"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.2 }}
                  >
                    {faq.answer}
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Message Form */}
        <motion.div
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 border border-slate-200/60 dark:border-slate-800"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-6">Send us a Message</h2>
          {feedback.text ? (
            <div
              className={`mb-5 px-4 py-3 rounded-2xl border text-sm font-semibold ${
                feedback.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-200'
                  : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-200'
              }`}
            >
              {feedback.text}
            </div>
          ) : null}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Your name"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 outline-none focus:ring-2 focus:ring-purple-300 text-sm"
                disabled={submitting}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 outline-none focus:ring-2 focus:ring-purple-300 text-sm"
                disabled={submitting}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">Message</label>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                placeholder="Write your message..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 outline-none focus:ring-2 focus:ring-purple-300 text-sm resize-none"
                disabled={submitting}
                required
              />
            </div>
            <motion.button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-lg shadow-xl hover:shadow-2xl transition-all"
              disabled={submitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Send className="w-5 h-5" />
              {submitting ? 'Sending...' : 'Send Message'}
            </motion.button>

            <div className="text-center text-sm">
              <a
                href="mailto:psibookstore93@gmail.com"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold underline underline-offset-4"
              >
                Or email us directly
              </a>
            </div>
          </form>
        </motion.div>
      </div>
    </>
  );
}

