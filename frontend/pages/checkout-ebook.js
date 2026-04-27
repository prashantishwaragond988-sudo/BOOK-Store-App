import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import toast from 'react-hot-toast';
import { ordersAPI } from '../lib/api';
import { initiateCashfreePayment } from '../lib/cashfree';
import { useAuth } from '../hooks/useAuth';
import Image from 'next/image';

export default function CheckoutEbook() {
  const [ebook, setEbook] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const router = useRouter();
  const { user, token } = useAuth();

  useEffect(() => {
    const currentEbook = localStorage.getItem('current_ebook');
    if (currentEbook) {
      const parsedEbook = JSON.parse(currentEbook);
      setEbook(parsedEbook);
      localStorage.removeItem('current_ebook');
    } else {
      router.push('/ebooks');
    }
  }, [router]);

  const handlePay = async () => {
    if (!ebook) return;
    if (!token) {
      toast.error('Please login first');
      router.push('/auth/login');
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error('Please enter your name and phone number');
      return;
    }

    setLoading(true);
    try {
      const cashfreeResponse = await ordersAPI.createCashfreeOrder({
        order_amount: ebook.price,
        customer_details: {
          customer_id: user?.email || 'guest',
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
        },
      });

      if (!cashfreeResponse.data.success) {
        toast.error(cashfreeResponse.data.message || 'Failed to create payment order');
        setLoading(false);
        return;
      }

      const paymentSessionId = cashfreeResponse.data.payment_session_id;
      if (!paymentSessionId) {
        toast.error('Payment session ID not received');
        setLoading(false);
        return;
      }

      await initiateCashfreePayment(paymentSessionId);

      const response = await ordersAPI.createOrder({
        ebook: ebook,
        payment_status: 'paid',
      });

      if (response.data.success) {
        toast.success('Ebook purchased successfully!');
        router.push('/my-ebooks');
      } else {
        toast.error(response.data.message || 'Purchase failed');
      }
    } catch (error) {
      const msg = error?.message || 'Payment failed or was cancelled. Please try again.';
      toast.error(msg);
    }
    setLoading(false);
  };

  if (!ebook) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Loading ebook...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Ebook Checkout - Bookstore</title>
      </Head>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 text-lg font-medium rounded-xl mb-6"
          >
            ← Back
          </button>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-pink-600 bg-clip-text text-transparent mb-4">
            Complete Your Purchase
          </h1>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 mb-8 border border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center space-x-6">
            <div className="relative">
              <Image
                src={ebook.image_url}
                alt={ebook.title}
                width={120}
                height={160}
                className="rounded-2xl shadow-lg object-cover"
              />
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">{ebook.title}</h2>
              <p className="text-xl text-green-600 font-bold mb-4">₹{ebook.price}</p>
              <p className="text-gray-600 dark:text-slate-300">Digital download - instant access after payment</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 mb-8 border border-slate-200/60 dark:border-slate-800">
          <h3 className="text-xl font-bold mb-6">Customer Details</h3>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Full Name"
              className="w-full p-4 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
            <input
              type="tel"
              placeholder="Mobile Number"
              className="w-full p-4 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white p-8 rounded-3xl shadow-2xl mb-8 text-center">
          <h3 className="text-2xl font-bold mb-2">✅ Instant Digital Delivery</h3>
          <p className="text-lg opacity-90">No shipping - download immediately after payment</p>
        </div>

        <button
          onClick={handlePay}
          disabled={loading || !ebook}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-6 px-8 rounded-3xl font-bold text-2xl shadow-2xl hover:shadow-3xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 mx-auto max-w-md"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <span>Processing Payment...</span>
            </>
          ) : (
            '💳 Pay Now & Download'
          )}
        </button>

        <div className="text-center mt-8 p-6 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-100 dark:border-blue-500/20">
          <p className="text-sm text-blue-700 dark:text-blue-200">Secure payment powered by Cashfree. Instant access. No physical delivery needed.</p>
        </div>
      </div>
    </>
  );
}

