import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { onIdTokenChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '../lib/firebaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const clearStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();

    const unsubscribe = onIdTokenChanged(auth, async (authUser) => {
      try {
        setLoading(true);

        if (!authUser) {
          clearStorage();
          setToken(null);
          setUser(null);
          return;
        }

        const idToken = await authUser.getIdToken();
        setToken(idToken);
        if (typeof window !== 'undefined') localStorage.setItem('token', idToken);

        let profile = null;
        try {
          const db = getFirebaseDb();
          const snap = await getDoc(doc(db, 'users', authUser.uid));
          if (snap.exists()) profile = snap.data();
        } catch {
          // ignore: Firestore profile is optional
        }

        const mergedUser = {
          uid: authUser.uid,
          email: authUser.email || profile?.email || null,
          ...(profile || {}),
        };

        setUser(mergedUser);
        if (typeof window !== 'undefined') localStorage.setItem('user', JSON.stringify(mergedUser));
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [clearStorage]);

  const isLoggedIn = useCallback(() => !!token, [token]);
  const isAdmin = useCallback(() => user?.role === 'admin', [user]);
  const getUserRole = useCallback(() => user?.role || null, [user]);
  const getHomePath = useCallback(() => (user?.role === 'admin' ? '/admin/dashboard' : '/'), [user]);

  const login = useCallback(
    async (email, password) => {
      try {
        setLoading(true);
        const auth = getFirebaseAuth();
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const uid = cred.user?.uid;

        let role = null;
        if (uid) {
          try {
            const db = getFirebaseDb();
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) role = snap.data()?.role || null;
          } catch {
            // ignore: role-based routing falls back to default
          }
        }
        toast.success('Login successful!');
        router.push(role === 'admin' ? '/admin/dashboard' : '/');
      } catch (error) {
        toast.error('Invalid email or password');
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  const logout = useCallback(
    async ({ redirectTo = '/auth/login' } = {}) => {
      const auth = getFirebaseAuth();
      await signOut(auth);
      clearStorage();
      setToken(null);
      setUser(null);
      toast.success('Logged out successfully');
      router.push(redirectTo);
    },
    [router, clearStorage]
  );

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isLoggedIn,
      isAdmin,
      getUserRole,
      getHomePath,
      login,
      logout,
    }),
    [user, token, loading, isLoggedIn, isAdmin, getUserRole, getHomePath, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
