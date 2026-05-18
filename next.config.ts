import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Security headers are now managed in src/middleware.ts with per-request nonces
  // (CSP remained here would conflict with the middleware-set CSP)
};

export default nextConfig;
