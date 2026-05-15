import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { MapPin, RefreshCcw, Truck, Package, CheckCircle2, ArrowLeft } from 'lucide-react';

import { ordersAPI } from '../../lib/api';

const DeliveryTrackingMap = dynamic(
  async () => {
    const React = await import('react');
    const { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } = await import('react-leaflet');
    const Leaflet = (await import('leaflet')).default;

    const iconRetinaUrl = (await import('leaflet/dist/images/marker-icon-2x.png')).default;
    const iconUrl = (await import('leaflet/dist/images/marker-icon.png')).default;
    const shadowUrl = (await import('leaflet/dist/images/marker-shadow.png')).default;

    delete Leaflet.Icon.Default.prototype._getIconUrl;
    Leaflet.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

    function Recenter({ center }) {
      const map = useMap();
      React.useEffect(() => {
        map.setView(center);
      }, [map, center]);
      return null;
    }

    return function DeliveryTrackingMapInner({ deliveryPosition, order, destination }) {
      const mapCenter = deliveryPosition
        ? [deliveryPosition.lat, deliveryPosition.lng]
        : order?.location
          ? [order.location.lat, order.location.lng]
          : [0, 0];

      const destinationPos = [destination.lat, destination.lng];

      return (
        <>
          {order?.location && (
            <MapContainer
              center={mapCenter}
              zoom={15}
              style={{ height: '300px', width: '100%', marginTop: '15px', borderRadius: '16px' }}
              scrollWheelZoom={false}
            >
              <Recenter center={mapCenter} />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {deliveryPosition && (
                <Marker position={[deliveryPosition.lat, deliveryPosition.lng]}>
                  <Popup>🚚 Delivery Agent</Popup>
                </Marker>
              )}

              <Marker position={[order.location.lat, order.location.lng]}>
                <Popup>📍 Your Location</Popup>
              </Marker>

              <Polyline
                positions={[
                  deliveryPosition ? [deliveryPosition.lat, deliveryPosition.lng] : [order.location.lat, order.location.lng],
                  destinationPos,
                ]}
                pathOptions={{ color: '#6366f1', weight: 5, opacity: 0.9, dashArray: '8 10' }}
              />
            </MapContainer>
          )}
        </>
      );
    };
  },
  { ssr: false }
);

function formatArrivingBy(date) {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
    return `Arriving by ${formatted}`;
  } catch {
    return 'Estimated delivery';
  }
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function toSafeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(d.getTime())) return null;
  return d;
}

function normalizeStatus(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, '_');
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function StatusStep({ active, done, icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-4">
      <div
        className={`mt-0.5 h-10 w-10 rounded-2xl flex items-center justify-center border ${
          done
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            : active
              ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
              : 'bg-slate-900/5 dark:bg-white/5 border-slate-200/60 dark:border-slate-800 text-slate-500 dark:text-slate-400'
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className={`font-bold ${done || active ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
          {title}
        </p>
        {subtitle ? <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{subtitle}</p> : null}
      </div>
    </div>
  );
}

export default function OrderTrackingPage() {
  const router = useRouter();
  const { id } = router.query;

  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [deliveryPosition, setDeliveryPosition] = useState(null);
  const [distance, setDistance] = useState(0);
  const [eta, setEta] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const intervalRef = useRef(null);
  const deliveryIntervalRef = useRef(null);

  useEffect(() => {
    if (order?.order_status && String(order.order_status).toLowerCase().includes('out') && order?.location) {
      setDeliveryPosition((prev) => {
        return (
          prev || {
            lat: order.location.lat - 0.01,
            lng: order.location.lng - 0.01,
          }
        );
      });
    }
  }, [order]);

  const orderDate = useMemo(() => {
    const fromTracking = tracking?.order_date ? toSafeDate(tracking.order_date) : null;
    const fromOrder = order?.created_at ? toSafeDate(order.created_at) : null;
    return fromTracking || fromOrder;
  }, [order, tracking]);

  const edd = useMemo(() => {
    if (!orderDate || !tracking) return null;
    const processingDays = Number(tracking.processing_days || 0);
    const shippingDays = Number(tracking.shipping_days || 0);
    if (!Number.isFinite(processingDays) || !Number.isFinite(shippingDays)) return null;
    return addDays(orderDate, processingDays + shippingDays);
  }, [orderDate, tracking]);

  const status = tracking?.status || 'Pending';
  const statusKey = normalizeStatus(order?.order_status || status);
  const isOutForDelivery =
    order?.order_status &&
    String(order.order_status).toLowerCase().includes("out");
  const isDelivered = statusKey === 'delivered';
  const isOutForDeliveryExact = isOutForDelivery;

  const destinationLat = typeof order?.location?.lat === 'number' ? order.location.lat : Number(order?.location?.lat);
  const destinationLng = typeof order?.location?.lng === 'number' ? order.location.lng : Number(order?.location?.lng);
  const hasDestination = Number.isFinite(destinationLat) && Number.isFinite(destinationLng);

  const STATUS_STEP_MAP = {
    'Pending': 0,
    'Confirmed': 0,
    'Packed': 0,
    'Processing': 0,
    'Shipped': 1,
    'Out for Delivery': 2,
    'Delivered': 3,
  };

  const statusIndex = STATUS_STEP_MAP[status] ?? 0;

  const fetchOrder = async (orderId) => {
    const res = await ordersAPI.getOrder(orderId);
    setOrder(res.data?.data || null);
  };

  const fetchTracking = async (orderId, { silent } = { silent: false }) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await ordersAPI.getOrderTracking(orderId);
      setTracking(res.data?.data || null);
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!router.isReady) return;
    if (!id) return;

    const orderId = Array.isArray(id) ? id[0] : id;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        await fetchOrder(orderId);
        await fetchTracking(orderId, { silent: true });
      } catch (e) {
        const statusCode = e?.response?.status;
        if (statusCode === 401) {
          router.replace('/auth/login');
          return;
        }
        if (statusCode === 404) {
          setNotFound(true);
        } else {
          toast.error('Failed to load tracking');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [router, router.isReady, id]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!id) return;
    if (notFound) return;

    const orderId = Array.isArray(id) ? id[0] : id;
    clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      fetchTracking(orderId, { silent: true }).catch(() => {});
    }, 5000);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [router, router.isReady, id, notFound]);

  useEffect(() => {
    clearInterval(deliveryIntervalRef.current);
    deliveryIntervalRef.current = null;

    if (!isOutForDeliveryExact) return;
    if (isDelivered) return;
    if (!hasDestination) return;

    setDeliveryPosition((prev) => {
      return prev || { lat: destinationLat - 0.01, lng: destinationLng - 0.01 };
    });

    deliveryIntervalRef.current = setInterval(() => {
      setDeliveryPosition(prev => {
        if (!prev) return prev;

        const latDiff = order.location.lat - prev.lat;
        const lngDiff = order.location.lng - prev.lng;

        if (Math.abs(latDiff) < 0.0001 && Math.abs(lngDiff) < 0.0001) {
          clearInterval(deliveryIntervalRef.current);
          deliveryIntervalRef.current = null;
          return { lat: order.location.lat, lng: order.location.lng };
        }

        return {
          lat: prev.lat + latDiff * 0.03,
          lng: prev.lng + lngDiff * 0.03
        };
      });
    }, 500);

    return () => {
      clearInterval(deliveryIntervalRef.current);
      deliveryIntervalRef.current = null;
    };
  }, [isOutForDeliveryExact, isDelivered, hasDestination, destinationLat, destinationLng, order?.location?.lat, order?.location?.lng]);

  useEffect(() => {
    if (!deliveryPosition) return;
    if (!hasDestination) return;
    const km = getDistance(deliveryPosition.lat, deliveryPosition.lng, destinationLat, destinationLng);
    setDistance(km);
    setEta(km / 0.5);
  }, [deliveryPosition, hasDestination, destinationLat, destinationLng]);

  useEffect(() => {
    if (isOutForDeliveryExact && hasDestination) return;
    clearInterval(deliveryIntervalRef.current);
    deliveryIntervalRef.current = null;
    setDeliveryPosition(null);
    setDistance(0);
    setEta(0);
  }, [isOutForDeliveryExact, hasDestination]);

  const items = Array.isArray(order?.items) ? order.items : [];
  const heroTitle = edd ? formatArrivingBy(edd) : 'Tracking your order';
  const location = order?.location || { lat: 18.5204, lng: 73.8567 };

  console.log("ORDER STATUS:", order?.order_status);
  console.log("ORDER LOCATION:", order?.location);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="flex items-center gap-3 text-slate-700 dark:text-slate-200">
          <div className="h-6 w-6 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-slate-700 dark:border-t-slate-200 animate-spin" />
          <span className="font-semibold">Loading tracking…</span>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-3xl text-center">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-100">Order not found</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          We couldn&apos;t find this order. It may have been removed or you may not have access to it.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/orders')}
            className="px-6 py-3 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Track Order - Bookstore</title>
      </Head>

      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <div className="flex items-center justify-between gap-4 mb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-semibold transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const orderId = Array.isArray(id) ? id[0] : id;
                fetchTracking(orderId, { silent: false }).catch(() => toast.error('Failed to refresh'));
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-semibold hover:bg-white dark:hover:bg-slate-900 transition-colors"
              disabled={refreshing}
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <motion.div
          className="rounded-3xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 p-6 sm:p-8 shadow-xl"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="flex flex-col gap-8">
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Order</p>
                  <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 break-all">
                    #{order?.id || id}
                  </p>
                  <p className="mt-2 text-2xl sm:text-3xl font-black gradient-glow">{heroTitle}</p>
                  {orderDate ? (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Ordered on{' '}
                      {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(orderDate)}
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0">
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                    <Truck className="h-4 w-4" />
                    {tracking?.status || 'Pending'}
                  </span>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="hidden rounded-2xl bg-slate-900/5 dark:bg-white/5 border border-slate-200/60 dark:border-slate-800 p-5">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Current Location</p>
                  <div className="mt-2 flex items-start gap-2">
                    <MapPin className="h-5 w-5 text-pink-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        Unavailable
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Last update{' '}
                        {tracking?.updated_at
                          ? new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(toSafeDate(tracking.updated_at) || new Date())
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900/5 dark:bg-white/5 border border-slate-200/60 dark:border-slate-800 p-5">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Processing</p>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                    {tracking?.processing_days ?? 1}d
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Warehouse handling</p>
                </div>

                <div className="rounded-2xl bg-slate-900/5 dark:bg-white/5 border border-slate-200/60 dark:border-slate-800 p-5">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Shipping</p>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                    {tracking?.shipping_days ?? 4}d
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">In-transit time</p>
                </div>
              </div>

              <div className="mt-8 rounded-3xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 p-6">
                <p className="text-sm font-black text-slate-900 dark:text-slate-100 mb-5">Shipment progress</p>
                <div className="space-y-5">
                  <StatusStep
                    done={statusIndex > 0}
                    active={statusIndex === 0}
                    icon={Package}
                    title="Order processing"
                    subtitle="We are preparing your items"
                  />
                  <StatusStep
                    done={statusIndex > 1}
                    active={statusIndex === 1}
                    icon={Truck}
                    title="Shipped"
                    subtitle="Your package is on the way"
                  />
                  <StatusStep
                    done={statusIndex > 2}
                    active={statusIndex === 2}
                    icon={MapPin}
                    title="Out for delivery"
                    subtitle="Courier is near your address"
                  />
                  {isOutForDelivery && hasDestination && deliveryPosition ? (
                    <div className="pl-14">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">🚚 Delivery in progress</p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        📏 Distance: {distance.toFixed(2)} km
                      </p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        ⏱️ ETA: {Math.ceil(eta)} mins
                      </p>
                      <DeliveryTrackingMap
                        deliveryPosition={deliveryPosition}
                        order={order}
                        destination={{ lat: destinationLat, lng: destinationLng }}
                      />
                    </div>
                  ) : null}
                  <StatusStep
                    done={statusIndex > 3}
                    active={statusIndex === 3}
                    icon={CheckCircle2}
                    title="Delivered"
                    subtitle="Delivered to your address"
                  />
                </div>
              </div>

              {items.length > 0 ? (
                <div className="mt-8">
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100 mb-4">Items</p>
                  <div className="space-y-3">
                    {items.slice(0, 6).map((item, idx) => (
                      <div
                        key={`${item.product_id || item.id || idx}`}
                        className="flex items-center gap-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 p-4"
                      >
                        <div className="relative h-16 w-12 rounded-xl overflow-hidden bg-slate-200/60 dark:bg-slate-800 shrink-0">
                          {item.image_url ? (
                            <Image src={item.image_url} alt={item.title || 'Item'} fill className="object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                            {item.title || item.ebook_title || 'Item'}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Qty: {item.quantity || 1}{' '}
                            {item.price ? (
                              <>
                                · <span className="font-semibold text-emerald-600">₹{item.price}</span>
                              </>
                            ) : null}
                          </p>
                        </div>
                        <Link
                          href="/orders"
                          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-colors"
                        >
                          <Package className="h-4 w-4" />
                          Orders
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

          </div>
        </motion.div>
      </div>
    </>
  );
}

export async function getStaticPaths() {
  let orderIds = [];

  try {
    // eslint-disable-next-line global-require
    const fs = require('fs');
    // eslint-disable-next-line global-require
    const path = require('path');

    const manifestPath = path.join(process.cwd(), '.static-export-manifest.json');
    if (fs.existsSync(manifestPath)) {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(raw);
      if (Array.isArray(manifest?.orderIds)) orderIds = manifest.orderIds;
    }
  } catch {
    // ignore
  }

  const paths = orderIds.map((id) => ({ params: { id: String(id) } }));
  return { paths, fallback: false };
}

export async function getStaticProps() {
  return { props: {} };
}
