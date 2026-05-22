import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Security headers are now managed in src/middleware.ts with per-request nonces
  // (CSP remained here would conflict with the middleware-set CSP)

  experimental: {
    // Optimize tree-shaking for heavy icon/animation/chart packages
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts'],
  },

  // Don't bundle server-only Node.js packages into the client bundle
  serverExternalPackages: ['pdf-parse', 'nodemailer'],
};

export default nextConfig;
