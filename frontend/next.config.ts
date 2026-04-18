import type { NextConfig } from 'next';

/** Dev uses webpack (`next dev` without `--turbo`) so monorepo root lockfiles cannot confuse Turbopack. */
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  async rewrites() {
    return [
      { source: '/api/auth/:path*', destination: 'http://127.0.0.1:8001/auth/:path*' },
      { source: '/api/analytics/:path*', destination: 'http://127.0.0.1:8005/analytics/:path*' },
    ];
  },
};

export default nextConfig;
