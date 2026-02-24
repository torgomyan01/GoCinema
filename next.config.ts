import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXTAUTH_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  eslint: {
    // Отключаем проверку ESLint во время production build
    ignoreDuringBuilds: true,
  },
  metadataBase: new URL('https://arakelians-drive.am/'),
  typescript: {
    // Отключаем проверку TypeScript во время production build (опционально)
    ignoreBuildErrors: false,
  },
  experimental: {
    esmExternals: true,
    serverActions: {
      bodySizeLimit: '50mb', // Increase body size limit for file uploads
    },
  },
  transpilePackages: ['@mep-agency/next-iubenda'],
  reactStrictMode: true,
  sassOptions: {
    additionalData: ``,
    includePaths: [path.join(__dirname, 'src/access/css')],
  },
  images: {
    remotePatterns: [
      {
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), camera=(self), microphone=()',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [];
  },

  async rewrites() {
    return [];
  },
};

export default nextConfig;
