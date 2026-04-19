import type { NextConfig } from 'next';

/** Dev uses webpack (`next dev` without `--turbo`) so monorepo root lockfiles cannot confuse Turbopack. */
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  async rewrites() {
    return [
      { source: '/api/authsvc/:path*', destination: 'http://127.0.0.1:8001/:path*' },
      { source: '/api/earningssvc/:path*', destination: 'http://127.0.0.1:8002/:path*' },
      { source: '/api/anomalysvc/:path*', destination: 'http://127.0.0.1:8003/:path*' },
      { source: '/api/grievancesvc/:path*', destination: 'http://127.0.0.1:8004/:path*' },
      { source: '/api/analyticssvc/:path*', destination: 'http://127.0.0.1:8005/:path*' },
      { source: '/api/auth/:path*', destination: 'http://127.0.0.1:8001/auth/:path*' },
      { source: '/api/analytics/:path*', destination: 'http://127.0.0.1:8005/analytics/:path*' },
      { source: '/api/verifier/:path*', destination: 'http://127.0.0.1:8002/verifier/:path*' },
      { source: '/api/shifts/:path*', destination: 'http://127.0.0.1:8002/shifts/:path*' },
    ];
  },
};

export default nextConfig;
