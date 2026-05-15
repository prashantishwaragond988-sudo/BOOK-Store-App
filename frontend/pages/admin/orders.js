import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { ChevronLeft, Package, ReceiptIndianRupee, Truck, UserRound } from 'lucide-react';

import { ordersAPI } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const ORDER_STATUSES = [
  'Pending',
  'Confirmed',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
];

const paymentPill = (paymentStatus) => {
  const status = String(paymentStatus || '').toLowerCase();
  const isPaid = status === 'paid' || status === 'success';
  return isPaid
    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
};

const statusPill = (orderStatus) => {
  const s = String(orderStatus || 'Pending');
  const map = {
    Pending: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
    Confirmed: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    Packed: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
    Shipped: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
    'Out for Delivery': 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
    Delivered: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  };
  return map[s] || map.Pending;
};

function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatINR(amount) {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(safe);
  } catch {
    return `INR ${Math.round(safe).toLocaleString('en-IN')}`;
  }
}

function formatOrderDate(value) {
  const d = toDate(value);
  if (!d) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d);
}

function addressToText(address) {
  if (!address || typeof address !== 'object') return '';
  const parts = [
    address.address,
    address.street,
    address.area,
    address.city,
    address.state,
    address.pincode || address.zip,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  return parts.join(', ');
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-4">
        <div className="h-4 w-24 rounded bg-slate-200" />
      </td>
      <td className="px-4 py-4">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="mt-2 h-3 w-28 rounded bg-slate-200" />
      </td>
      <td className="px-4 py-4">
        <div className="h-4 w-64 rounded bg-slate-200" />
      </td>
      <td className="px-4 py-4">
        <div className="h-4 w-14 rounded bg-slate-200" />
      </td>
      <td className="px-4 py-4">
        <div className="h-4 w-28 rounded bg-slate-200" />
      </td>
      <td className="px-4 py-4">
        <div className="h-6 w-20 rounded-full bg-slate-200" />
      </td>
      <td className="px-4 py-4">
        <div className="h-9 w-44 rounded bg-slate-200" />
      </td>
      <td className="px-4 py-4">
        <div className="h-4 w-24 rounded bg-slate-200" />
      </td>
    </tr>
  );
}

export default function AdminOrders() {
  const router = useRouter();
  const { loading: authLoading, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [updatingId, setUpdatingId] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin()) router.replace('/');
  }, [authLoading, isAdmin, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin()) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await ordersAPI.getAdminOrders();
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        const ts = (o) => (toDate(o?.created_at || o?.createdAt)?.getTime?.() || 0);
        list.sort((a, b) => ts(b) - ts(a));
        setOrders(list);
      } catch (e) {
        if (!cancelled) toast.error('Failed to load orders');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAdmin]);

  const totalRevenue = useMemo(() => {
    return orders.reduce((sum, o) => {
      const price = toNumber(o?.total_price) || toNumber(o?.totalPrice) || toNumber(o?.total) || 0;
      return sum + price;
    }, 0);
  }, [orders]);

  const handleStatusChange = async (orderId, nextStatus) => {
    if (!orderId) return;
    if (!nextStatus) return;
    if (updatingId) return;

    setUpdatingId(orderId);
    try {
      const res = await ordersAPI.updateOrderStatus({ order_id: orderId, status: nextStatus });
      if (!res.data?.success) {
        toast.error(res.data?.message || 'Update failed');
        return;
      }
      toast.success(res.data?.message || 'Order updated');
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, order_status: nextStatus, status_history: res.data?.data?.status_history || o.status_history }
            : o
        )
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update order status');
    } finally {
      setUpdatingId('');
    }
  };

  if (authLoading || (!authLoading && !isAdmin())) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-orange-200 border-t-orange-600 animate-spin" />
          <div className="text-lg font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Admin Orders - Bookstore</title>
      </Head>

      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div className="flex items-start gap-4">
              <button
                onClick={() => router.back()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Orders</h1>
                <p className="mt-2 text-sm md:text-base text-slate-500">
                  Manage orders, addresses, and delivery status
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200 shadow-sm px-5 py-3">
              <ReceiptIndianRupee className="h-5 w-5 text-emerald-700" />
              <div className="text-sm text-slate-500">Revenue</div>
              <div className="text-lg font-bold text-slate-900">{formatINR(totalRevenue)}</div>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full table-fixed">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold text-slate-600">
                    <th className="px-4 py-4 w-[140px]">Order ID</th>
                    <th className="px-4 py-4 w-[220px]">Customer</th>
                    <th className="px-4 py-4 w-[320px]">Address</th>
                    <th className="px-4 py-4 w-[110px]">Items</th>
                    <th className="px-4 py-4 w-[150px]">Total</th>
                    <th className="px-4 py-4 w-[140px]">Payment</th>
                    <th className="px-4 py-4 w-[220px]">Order Status</th>
                    <th className="px-4 py-4 w-[140px]">Date</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 text-sm text-slate-900">
                  {loading ? (
                    <>
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-14 text-center text-slate-500">
                        No orders yet
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const id = order?.id || '';
                      const shortId = id ? id.slice(-6) : '-';
                      const customerName = order?.address?.name || '-';
                      const customerEmail = order?.user_id || '-';
                      const addrText = addressToText(order?.address) || 'No address';
                      const itemsCount = Array.isArray(order?.items) ? order.items.length : 0;
                      const total =
                        toNumber(order?.total_price) ||
                        toNumber(order?.totalPrice) ||
                        toNumber(order?.total) ||
                        0;
                      const payStatus = order?.payment_status || 'pending';
                      const currentStatus = order?.order_status || 'Pending';
                      const createdAt = order?.created_at || order?.createdAt || null;
                      const updating = updatingId === id;

                      return (
                        <tr key={id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-4">
                            <div className="font-mono font-semibold text-blue-700 truncate" title={id}>
                              #{shortId}
                            </div>
                            <div className="mt-1 text-xs text-slate-500 truncate" title={id}>
                              {id || '-'}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                <UserRound className="h-4 w-4 text-slate-600" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 truncate" title={customerName}>
                                  {customerName}
                                </div>
                                <div className="text-xs text-slate-500 truncate" title={customerEmail}>
                                  {customerEmail}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="text-slate-700 whitespace-normal break-words" title={addrText}>
                              {addrText}
                            </div>
                            {order?.address?.mobile ? (
                              <div className="mt-1 text-xs text-slate-500 truncate" title={order.address.mobile}>
                                {order.address.mobile}
                              </div>
                            ) : null}
                          </td>

                          <td className="px-4 py-4">
                            <div className="inline-flex items-center gap-2">
                              <Package className="h-4 w-4 text-slate-500" />
                              <span className="font-semibold">{itemsCount}</span>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-bold text-emerald-700 truncate" title={String(total)}>
                              {formatINR(total)}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${paymentPill(payStatus)}`}>
                              {String(payStatus || 'pending')}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusPill(currentStatus)}`}>
                                <Truck className="h-3.5 w-3.5 mr-1.5" />
                                {currentStatus}
                              </span>

                              <select
                                className="ml-auto w-[150px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-60"
                                value={currentStatus}
                                onChange={(e) => handleStatusChange(id, e.target.value)}
                                disabled={updating}
                                title="Update order status"
                              >
                                {ORDER_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>

                          <td className="px-4 py-4 text-slate-600 whitespace-nowrap">
                            {formatOrderDate(createdAt)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
