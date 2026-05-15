import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Head from 'next/head';
import Image from 'next/image';

export default function Cart() {
  const [cart, setCart] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  const updateQuantity = (id, newQty) => {
    if (newQty <= 0) {
      removeItem(id);
      return;
    }
    const newCart = cart.map(item =>
      item.id === id ? { ...item, quantity: newQty } : item
    );
    localStorage.setItem('cart', JSON.stringify(newCart));
    setCart(newCart);
    toast.success('Cart updated');
  };

  const removeItem = (id) => {
    const newCart = cart.filter(item => item.id !== id);
    localStorage.setItem('cart', JSON.stringify(newCart));
    setCart(newCart);
    toast.success('Item removed from cart');
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const proceedToCheckout = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const types = new Set(cart.map(item => item.type || (item.pdf_url ? 'ebook' : 'physical')));
    const isMixed = types.size > 1;
    const isAllEbooks = types.size === 1 && types.has('ebook');

    if (isMixed) {
      toast.error('Please checkout physical books and ebooks separately.');
      return;
    }

    if (isAllEbooks) {
      if (cart.length === 1) {
        localStorage.setItem('current_ebook', JSON.stringify(cart[0]));
        router.push('/checkout-ebook');
        return;
      }
      toast.error('Please purchase ebooks individually using Instant Download.');
      return;
    }

    router.push('/checkout');
  };

  if (cart.length === 0) {
    return (
      <>
        <Head>
          <title>Cart - Bookstore</title>
        </Head>
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
              🛒
            </div>
            <h1 className="text-3xl font-bold mb-4 text-gray-800 dark:text-slate-100">Your cart is empty</h1>
            <p className="text-xl text-gray-500 dark:text-slate-300 mb-8">Looks like you haven&apos;t added anything to your cart yet.</p>
            <button
              onClick={() => router.push('/books')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold text-lg shadow-lg"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Cart - Bookstore</title>
      </Head>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Cart Items */}
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-gray-800 to-gray-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              Shopping Cart
            </h1>
            <div className="space-y-4">
              {cart.map(item => (
                <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-slate-800">
                  <div className="flex items-center space-x-6">
                    <div className="relative">
                      <Image
                        src={item.image_url}
                        alt={item.title}
                        width={120}
                        height={160}
                        className="rounded-xl object-cover shadow-lg hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-8 h-8 flex items-center justify-center font-bold">
                        {item.quantity}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-xl mb-2 line-clamp-2 text-slate-900 dark:text-slate-100">{item.title}</h3>
                      <p className="text-2xl font-bold text-green-600 mb-4">₹{item.price}</p>
                      <div className="flex items-center space-x-4 bg-gray-50 dark:bg-slate-800/60 p-3 rounded-xl">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-12 h-12 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg font-bold text-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          -
                        </button>
                        <span className="w-12 text-center font-bold text-xl bg-white dark:bg-slate-900 px-4 py-2 rounded-lg border dark:border-slate-700">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-12 h-12 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg font-bold text-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="ml-auto text-red-500 hover:text-red-700 font-bold text-sm px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-all"
                        >
                          Remove
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                        Price: ₹{(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:w-80 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 sticky top-8 border border-slate-200/60 dark:border-slate-800">
              <h2 className="text-2xl font-bold mb-6">Order Summary</h2>
              <div className="space-y-3 mb-8">
                <div className="flex justify-between text-lg">
                  <span>Items:</span>
                  <span>{cart.length}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span>Total Price:</span>
                  <span className="font-bold text-2xl text-green-600">₹{total.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={proceedToCheckout}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-4 px-6 rounded-xl font-bold text-xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
              >
                Proceed to Checkout →
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

