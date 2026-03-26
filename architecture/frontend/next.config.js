/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Include database file in deployment
  serverExternalPackages: ['@prisma/client'],
};

module.exports = nextConfig;
