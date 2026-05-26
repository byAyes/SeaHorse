'use client';

import { onCLS, onFCP, onLCP, onTTFB, onINP } from 'web-vitals';

type ReportHandler = (metric: { name: string; value: number; rating: string }) => void;

/**
 * Reports Core Web Vitals and other important performance metrics.
 *
 * In development, metrics are logged to the console.
 * In production, they could be sent to an analytics endpoint.
 *
 * Usage: call `reportWebVitals()` once in the root layout.
 *
 * Measured metrics:
 * - CLS  (Cumulative Layout Shift)    — visual stability
 * - FCP  (First Contentful Paint)     — perceived load speed
 * - LCP  (Largest Contentful Paint)   — loading performance
 * - TTFB (Time to First Byte)         — server responsiveness
 * - INP  (Interaction to Next Paint)  — interactivity (replaces FID)
 */
export function reportWebVitals(reportFn?: ReportHandler) {
  const handler = reportFn ?? defaultHandler;

  onCLS(handler);
  onFCP(handler);
  onLCP(handler);
  onTTFB(handler);
  onINP(handler);
}

function defaultHandler(metric: { name: string; value: number; rating: string }) {
  // In dev, log to console for easy debugging
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `%c[Web Vitals] %c${metric.name} %c${metric.value.toFixed(2)} %c(${metric.rating})`,
      'color: #6366f1; font-weight: bold;',
      'color: #22c55e; font-weight: bold;',
      'color: #f59e0b;',
      metric.rating === 'good' ? 'color: #22c55e;' : metric.rating === 'needs-improvement' ? 'color: #f59e0b;' : 'color: #ef4444;',
    );
    return;
  }

  // In production, send to analytics (placeholder)
  // e.g. POST to /api/analytics/vitals
  try {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      url: window.location.pathname,
      timestamp: Date.now(),
    });

    // Use sendBeacon for reliability — it doesn't block the page unload
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/vitals', body);
    }
  } catch {
    // Swallow — vitals reporting should never break the app
  }
}
