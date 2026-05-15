/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    workerThreads: true,
    webpackBuildWorker: false,
  },
};

module.exports = nextConfig;

