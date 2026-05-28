import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Security headers are now managed in src/proxy.ts with per-request nonces
  // (CSP remained here would conflict with the proxy-set CSP)
  turbopack: {
    root: 'C:/Users/juans/Documents/GitHub/automatitation',
  },

  experimental: {
    // Optimize tree-shaking for heavy icon/animation/chart packages
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts'],
  },

  // Don't bundle server-only Node.js packages into the client bundle
  serverExternalPackages: ['pdf-parse', 'nodemailer'],
};

export default nextConfig;
