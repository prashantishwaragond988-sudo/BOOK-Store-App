import { useState, useEffect } from 'react';
import { ordersAPI } from '../lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function Orders() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    ordersAPI.getOrders().then(res => setOrders(res.data)).catch(() => toast.error('Load orders failed'));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-12 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
        My Orders
      </h1>
      <div className="space-y-6">
        {orders.map(order => (
          <div key={order.id} className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-md border border-slate-200/60 dark:border-slate-800">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold">Order #{order.id.slice(-6)}</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${order.payment_status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-200'}`}>
                {order.payment_status}
              </span>
            </div>
            <p className="text-lg font-bold mb-4">₹{order.total_price}</p>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {order.items.slice(0, 3).map((item, index) => (
                <div key={item.product_id || item.id || `${order.id}-${index}`} className="text-center">
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-gray-600 dark:text-slate-300">Qty: {item.quantity}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Link
                href={`/order/${order.id}`}
                className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-colors"
              >
                Track package
              </Link>
              <button
                type="button"
                className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-200/60 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-bold hover:bg-slate-900/10 dark:hover:bg-white/10 transition-colors"
                onClick={() =>
                  navigator.clipboard?.writeText(order.id).then(() => toast.success('Order ID copied')).catch(() => {})
                }
              >
                Copy Order ID
              </button>
            </div>
            <div className="flex space-x-4 text-sm">
              <p>{order.address?.street}, {order.address?.city}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
