/**
 * Next.js Middleware — Security Headers with Nonce-based CSP
 *
 * Generates a unique nonce per request, replaces 'unsafe-inline' in script-src,
 * and conditionally allows 'unsafe-eval' only in development mode (needed for HMR).
 *
 * The nonce is passed to layout.tsx via the x-nonce request header so that
 * <Script> components can use it.
 */

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID();
  const isDev = process.env.NODE_ENV === 'development';

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob:`,
    `connect-src 'self'`,
    `frame-src 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');

  // Clone request headers so we can inject x-nonce for layout.tsx to read
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Set CSP as an HTTP response header (primary enforcement mechanism)
  response.headers.set('Content-Security-Policy', csp);

  // Additional security headers (moved from next.config.ts to avoid conflict)
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

// Only run on page routes — skip API, static assets, and Next.js internals
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/*           (API routes — CSP not relevant)
     * - /_next/static/*  (static files — served by CDN)
     * - /_next/image/*   (image optimization)
     * - /favicon.ico     (favicon)
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico).*)',
  ],
};
