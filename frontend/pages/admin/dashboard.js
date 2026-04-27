import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { collection, getDocs } from 'firebase/firestore';
import { BookOpen, DollarSign, FolderPlus, Layers, PackagePlus, ShoppingCart, Tag, Users } from 'lucide-react';

import StatCard from '../../components/admin/StatCard';
import { Skeleton } from '../../components/admin/Skeleton';
import { getFirebaseDb } from '../../lib/firebaseClient';
import { useAuth } from '../../hooks/useAuth';

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
    return `₹${Math.round(safe).toLocaleString('en-IN')}`;
  }
}

function DashboardCard({ title, icon: Icon, children, loading }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-slate-700" />
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        </div>
      </div>
      {loading ? <Skeleton className="h-[320px] w-full" /> : <div className="h-[320px]">{children}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const { loading: authLoading, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [totalBooks, setTotalBooks] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);

  const [monthlySales, setMonthlySales] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

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
      setError('');

      try {
        const db = getFirebaseDb();
        const [booksSnap, ordersSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, 'books')),
          getDocs(collection(db, 'orders')),
          getDocs(collection(db, 'users')),
        ]);

        if (cancelled) return;

        setTotalBooks(booksSnap.size);
        setTotalOrders(ordersSnap.size);
        setTotalUsers(usersSnap.size);

        const orders = [];
        let revenue = 0;
        const byMonth = new Map();

        ordersSnap.forEach((docSnap) => {
          const data = docSnap.data() || {};

          const created =
            toDate(data.createdAt) ||
            toDate(data.created_at) ||
            toDate(data.created) ||
            toDate(data.date) ||
            null;

          const price =
            toNumber(data.totalPrice) ||
            toNumber(data.total_price) ||
            toNumber(data.total) ||
            toNumber(data.amount) ||
            0;

          revenue += price;

          const itemsCount = Array.isArray(data.items)
            ? data.items.length
            : toNumber(data.itemCount) || toNumber(data.itemsCount) || 0;

          orders.push({
            id: docSnap.id,
            createdAt: created,
            totalPrice: price,
            itemsCount,
          });

          if (!created) return;
          const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
          const prev = byMonth.get(key) || { key, revenue: 0, orders: 0 };
          prev.revenue += price;
          prev.orders += 1;
          byMonth.set(key, prev);
        });

        setTotalRevenue(revenue);

        orders.sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
        setRecentOrders(orders.slice(0, 5));

        const monthFormatter = new Intl.DateTimeFormat('en-IN', { month: 'short' });
        const series = Array.from(byMonth.values())
          .sort((a, b) => (a.key < b.key ? -1 : 1))
          .slice(-6)
          .map((m) => {
            const [y, mm] = m.key.split('-').map((v) => Number(v));
            const d = new Date(y, (mm || 1) - 1, 1);
            return {
              month: `${monthFormatter.format(d)} ${String(y).slice(-2)}`,
              revenue: Math.round(m.revenue),
              orders: m.orders,
            };
          });
        setMonthlySales(series);
      } catch {
        if (!cancelled) setError('Failed to load dashboard data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAdmin]);

  const showGateLoading = authLoading || (!authLoading && !isAdmin());

  const subtitle = useMemo(() => {
    if (loading) return 'Fetching live metrics from Firestore…';
    if (error) return error;
    return 'Your bookstore performance overview';
  }, [loading, error]);

  if (showGateLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-orange-200 border-t-orange-600 animate-spin" />
          <div className="text-lg font-medium">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Admin Dashboard - Bookstore</title>
      </Head>

      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Admin Dashboard</h1>
              <p className={`mt-2 text-sm md:text-base ${error ? 'text-red-600' : 'text-slate-500'}`}>
                {subtitle}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Total Books"
              value={totalBooks.toLocaleString('en-IN')}
              icon={BookOpen}
              iconClassName="text-blue-700"
              loading={loading}
            />
            <StatCard
              title="Total Orders"
              value={totalOrders.toLocaleString('en-IN')}
              icon={ShoppingCart}
              iconClassName="text-purple-700"
              loading={loading}
            />
            <StatCard
              title="Total Revenue"
              value={formatINR(totalRevenue)}
              icon={DollarSign}
              iconClassName="text-emerald-700"
              loading={loading}
            />
            <StatCard
              title="Total Users"
              value={totalUsers.toLocaleString('en-IN')}
              icon={Users}
              iconClassName="text-orange-700"
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <DashboardCard title="Monthly Sales" icon={DollarSign} loading={loading}>
              {monthlySales.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySales} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickMargin={10} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(v, name) => [
                        name === 'revenue' ? formatINR(toNumber(v)) : v,
                        name === 'revenue' ? 'Revenue' : 'Orders',
                      ]}
                    />
                    <Bar dataKey="revenue" fill="#f97316" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500">No sales data yet</div>
              )}
            </DashboardCard>

            <DashboardCard title="Recent Orders" icon={ShoppingCart} loading={loading}>
              {recentOrders.length ? (
                <div className="space-y-3">
                  {recentOrders.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">#{o.id}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {o.itemsCount} item{o.itemsCount === 1 ? '' : 's'}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-emerald-700">{formatINR(o.totalPrice)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500">No orders yet</div>
              )}
            </DashboardCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link
              href="/admin/add-book"
              className="group rounded-2xl bg-white border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-semibold text-slate-500">Quick Action</div>
                <div className="mt-2 text-lg font-bold text-slate-900">Add Book</div>
              </div>
              <PackagePlus className="h-6 w-6 text-emerald-600 group-hover:scale-110 transition-transform" />
            </Link>

            <Link
              href="/admin/add-ebook"
              className="group rounded-2xl bg-white border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-semibold text-slate-500">Quick Action</div>
                <div className="mt-2 text-lg font-bold text-slate-900">Add Ebook</div>
              </div>
              <FolderPlus className="h-6 w-6 text-indigo-600 group-hover:scale-110 transition-transform" />
            </Link>

            <Link
              href="/admin/manage-books"
              className="group rounded-2xl bg-white border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-semibold text-slate-500">Quick Action</div>
                <div className="mt-2 text-lg font-bold text-slate-900">Manage Books</div>
              </div>
              <Layers className="h-6 w-6 text-purple-600 group-hover:scale-110 transition-transform" />
            </Link>

            <Link
              href="/admin/add-category"
              className="group rounded-2xl bg-white border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-semibold text-slate-500">Quick Action</div>
                <div className="mt-2 text-lg font-bold text-slate-900">Add Category</div>
              </div>
              <Tag className="h-6 w-6 text-orange-600 group-hover:scale-110 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
