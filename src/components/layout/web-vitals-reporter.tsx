'use client';

import { useEffect } from 'react';
import { reportWebVitals } from '@/lib/web-vitals';

/**
 * Client component that registers Web Vitals performance observers on mount.
 * Separated into its own file so the root layout (Server Component) can
 * use `next/dynamic` with `ssr: false` to lazy-load it.
 */
export default function WebVitalsReporter() {
  useEffect(() => {
    reportWebVitals();
  }, []);

  return null;
}
