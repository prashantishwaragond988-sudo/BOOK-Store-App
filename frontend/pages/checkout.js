import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ordersAPI } from '../lib/api';
import { initiateCashfreePayment } from '../lib/cashfree';
import toast from 'react-hot-toast';
import Head from 'next/head';
import Image from 'next/image';
import { useAuth } from '../hooks/useAuth';

export default function Checkout() {
  const [cart, setCart] = useState([]);
  const [address, setAddress] = useState({ name: '', mobile: '', address: '' });
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const router = useRouter();
  const { token } = useAuth();

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  const getUserLocation = () => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        resolve(null);
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          },
          () => resolve(null),
          { enableHighAccuracy: true }
        );
      }
    });
  };

  const placeOrder = async () => {
    const location = await getUserLocation();

    // Sync local cart to server cart
    await Promise.all(
      cart.map(item =>
        ordersAPI.addToCart({
          product_id: item.id,
          type: item.type || 'book',
          quantity: item.quantity
        })
      )
    );

    const prices = {};
    cart.forEach(item => {
      prices[item.id] = item.price;
    });

    const orderData = {
      prices,
      address,
      order_status: 'Out for Delivery',
      location: location,
      payment_status: paymentMethod === 'cod' ? 'pending' : 'paid'
    };

    const response = await ordersAPI.createOrder(orderData);
    if (!response.data.success) {
      throw new Error(response.data.message || 'Order failed');
    }

    toast.success('Order placed successfully! 🎉');
    localStorage.removeItem('cart');
    setCart([]);
    router.push('/downloads');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (!token) {
      toast.error('Please login first to place order');
      router.push('/auth/login');
      return;
    }

    setLoading(true);
    try {
      if (paymentMethod === 'cod') {
        await placeOrder();
      } else if (paymentMethod === 'cashfree') {
        const cashfreeResponse = await ordersAPI.createCashfreeOrder({
          order_amount: total,
          customer_details: {
            customer_id: 'cust_001',
            customer_email: 'test@gmail.com',
            customer_phone: address.mobile || '9999999999',
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
        await placeOrder();
      }
    } catch (error) {
      const msg = error?.message || 'Order placement failed. Please try again.';
      toast.error(msg);
    }
    setLoading(false);
  };

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold mb-4">No Items in Cart</h1>
        <button
          onClick={() => router.push('/cart')}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold"
        >
          ← Back to Cart
        </button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Checkout - Bookstore</title>
      </Head>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-4xl font-bold mb-12 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
          Checkout
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-8">
          {/* Order Items */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Order Items</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {cart.map(item => (
                <div key={item.id} className="flex items-center space-x-4 p-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800">
                  <Image
                    src={item.image_url}
                    alt={item.title}
                    width={80}
                    height={80}
                    className="rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{item.title}</h3>
                    <p className="text-green-600 font-bold">₹{item.price} x {item.quantity}</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400">₹{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-green-50 dark:bg-emerald-500/10 rounded-xl border border-green-100 dark:border-emerald-500/20">
              <div className="flex justify-between text-xl font-bold">
                <span>Total: </span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Checkout Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-2xl font-bold mb-6">Delivery Details</h2>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Full Name"
                className="w-full p-4 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={address.name}
                onChange={(e) => setAddress({...address, name: e.target.value})}
                required
              />
              <input
                type="tel"
                placeholder="Mobile Number"
                className="w-full p-4 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={address.mobile}
                onChange={(e) => setAddress({...address, mobile: e.target.value})}
                required
              />
              <textarea
                placeholder="Full Address"
                rows={4}
                className="w-full p-4 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                value={address.address}
                onChange={(e) => setAddress({...address, address: e.target.value})}
                required
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Payment Method</h3>
              <label className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800">
                <input
                  type="radio"
                  value="cod"
                  checked={paymentMethod === 'cod'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-5 h-5 text-blue-600"
                />
                <span>Cash on Delivery</span>
              </label>
              <label className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 mt-2">
                <input
                  type="radio"
                  value="cashfree"
                  checked={paymentMethod === 'cashfree'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-5 h-5 text-blue-600"
                />
                <span>Pay Online (Cashfree)</span>
              </label>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={() => router.push('/cart')}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-4 px-6 rounded-xl font-bold text-lg transition-all"
              >
                ← Back to Cart
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-4 px-6 rounded-xl font-bold text-xl shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  'Place Order →'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

