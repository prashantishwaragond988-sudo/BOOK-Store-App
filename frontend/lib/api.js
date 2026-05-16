import axios from 'axios';
import { getFirebaseAuth } from './firebaseClient';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
});

api.interceptors.request.use(async (config) => {
  try {
    const auth = getFirebaseAuth();
    const idToken = await auth.currentUser?.getIdToken();
    if (idToken) config.headers.Authorization = `Bearer ${idToken}`;
  } catch {
    // ignore: request proceeds unauthenticated
  }
  return config;
});

export const productsAPI = {
  getCategories: () => api.get('/products/categories'),
  getBooks: (params = {}) => api.get('/products/books', { params }),
  getEbooks: () => api.get('/products/ebooks'),
  getBook: (id) => api.get(`/products/books/${id}`),
};


export const ordersAPI = {
  addToCart: (data) => api.post('/orders/cart/add', data),
  getCart: () => api.get('/orders/cart'),
  createOrder: (data) => api.post('/orders/orders', data),
  createCashfreeOrder: (data) => api.post('/orders/create-order', data),
  getOrders: () => api.get('/orders/orders'),
  getOrder: (id) => api.get(`/orders/orders/${id}`),
  getOrderTracking: (id) => api.get(`/orders/orders/${id}/tracking`),
  getMyEbooks: () => api.get('/orders/my-ebooks'),
  getAdminOrders: () => api.get('/admin/orders'),
  updateOrderStatus: (data) => api.post('/admin/update-order-status', data),
};

export const userAPI = {
  hasPurchased: (ebookId) => api.get(`/api/user/has-purchased/${ebookId}`),
};
api.defaults.headers.post['Content-Type'] = 'application/json';

export default api;
