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
};

export default nextConfig;