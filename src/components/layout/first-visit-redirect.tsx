'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const SETUP_SEEN_KEY = 'seahorse_setup_seen';

/**
 * Detects first-time users without an AI API key and redirects them
 * to the setup wizard. Sets a localStorage flag so subsequent visits
 * don't redirect again — the existing banners handle the "no key" state.
 *
 * Safe for SSR: no `window` access during server render (guarded by
 * `typeof window` check and Next.js router availability).
 */
export function FirstVisitRedirect({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Already on setup page — no redirect loop
    if (pathname === '/setup') {
      setChecking(false);
      return;
    }

    // Already seen setup wizard (skipped or completed) — don't redirect again
    if (typeof window !== 'undefined' && localStorage.getItem(SETUP_SEEN_KEY)) {
      setChecking(false);
      return;
    }

    // Check if any AI API key is configured on the server
    let cancelled = false;

    fetch('/api/config/keys')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;

        if (!data.activeProvider) {
          // Mark as seen to prevent redirect loop on next navigation
          try {
            localStorage.setItem(SETUP_SEEN_KEY, 'true');
          } catch {
            // localStorage unavailable (incognito, SSR) — redirect anyway
          }
          router.replace('/setup');
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        // Fetch failed — don't block the user from seeing the app
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-xs text-slate-400">
            Setting up your workspace...
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
