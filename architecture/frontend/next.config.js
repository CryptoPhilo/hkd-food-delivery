const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // [SECURITY] x-powered-by: Next.js 헤더 제거 (MEDIUM-03, HIGH-03)
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Include database file in deployment
  serverExternalPackages: ['@prisma/client'],
  // [SECURITY] 보안 헤더 설정 (HIGH-03 보안 취약점 수정)
  // 프론트엔드에 보안 헤더가 전혀 없던 문제 해결
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.hankyeong.xyz https://*.portone.io;",
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(self), camera=(), microphone=()',
          },
        ],
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
