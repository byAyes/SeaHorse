'use client';

import { createContext, useContext, useRef, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Variants } from 'framer-motion';

/**
 * Check if the user prefers reduced motion via OS setting.
 * Used to disable decorative animations while keeping functional transitions.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type NavDirection = 'forward' | 'backward' | 'none';

interface PageTransitionContextValue {
  direction: NavDirection;
  /** Unique key derived from pathname + direction, triggers AnimatePresence re-animation */
  transitionKey: string;
}

export const PageTransitionContext = createContext<PageTransitionContextValue>({
  direction: 'none',
  transitionKey: '',
});

export function usePageTransition() {
  return useContext(PageTransitionContext);
}

/**
 * Tracks navigation direction (forward/back) by comparing pathnames
 * on each render. Provides a context value for AnimatePresence to consume.
 */
export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  const [direction, setDirection] = useState<NavDirection>('none');

  // Detect navigation direction on pathname change
  useEffect(() => {
    const prevPath = prevPathRef.current;
    if (prevPath !== pathname) {
      const currentSegments = pathname.split('/').filter(Boolean);
      const prevSegments = prevPath.split('/').filter(Boolean);

      const navDir: NavDirection =
        currentSegments.length < prevSegments.length ? 'backward' : 'forward';

      setDirection(navDir);
      prevPathRef.current = pathname;
    }
  }, [pathname]);

  const transitionKey = `${pathname}-${direction}`;

  return (
    <PageTransitionContext.Provider value={{ direction, transitionKey }}>
      {children}
    </PageTransitionContext.Provider>
  );
}

/**
 * Shared page transition variants — direction-aware.
 * Forward: content enters from right, exits to left.
 * Backward: content enters from left, exits to right.
 *
 * Respects prefers-reduced-motion: when active, transitions are minimal.
 */
export function getPageVariants(direction: NavDirection): Variants {
  const reduced = prefersReducedMotion();
  const isForward = direction === 'forward' || direction === 'none';
  const xOffset = isForward ? 40 : -40;
  const xExitOffset = isForward ? -30 : 30;

  if (reduced) {
    return {
      initial: { opacity: 0 },
      animate: {
        opacity: 1,
        transition: { duration: 0.1 },
      },
      exit: {
        opacity: 0,
        transition: { duration: 0.08 },
      },
    };
  }

  return {
    initial: {
      opacity: 0,
      y: 6,
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.2,
        ease: [0.23, 1, 0.32, 1],
      },
    },
    exit: {
      opacity: 0,
      y: -4,
      transition: {
        duration: 0.12,
        ease: 'easeOut',
      },
    },
  };
}
