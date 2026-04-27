import Head from 'next/head';
import { Toaster } from 'react-hot-toast';
import Navbar from './Navbar';

export default function Layout({ children }) {
  return (
    <>
      <Head>
        <title>Bookstore - Modern Glass UI</title>
        <meta name="description" content="Premium Bookstore with Glassmorphism Design" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Navbar />
      <main className="pt-20 lg:pt-24 pb-12 min-h-screen text-slate-900 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:text-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
        {children}
      </main>
      <Toaster />
    </>
  );
}

