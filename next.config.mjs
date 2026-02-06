/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'verbose-broccoli-6994rpjpwrj5fr7rw-3000.app.github.dev',
        'localhost:3000'
      ],
    },
  },
  // WEBPACK: Used for production builds and older environments
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      html2canvas: 'html2canvas-pro',
    };
    return config;
  },
  // TURBOPACK: Used for 'next dev' and Next.js 16 production builds
  // This is what will fix your button in the Codespace
  turbopack: {
    resolveAlias: {
      'html2canvas': 'html2canvas-pro',
    },
  },
};

export default nextConfig;