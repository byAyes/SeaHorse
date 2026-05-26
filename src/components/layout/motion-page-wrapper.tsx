'use client';

import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePageTransition, getPageVariants } from '@/lib/page-transitions';

/**
 * Isolated motion wrapper that handles AnimatePresence + motion.div.
 * This component exists solely so the main layout can use `next/dynamic`
 * to lazy-load framer-motion (~93KB) — keeping it out of the critical bundle.
 *
 * The layout only imports a lightweight shell; framer-motion is fetched
 * on-demand when this wrapper is mounted.
 */
export function MotionPageWrapper({ children }: { children: ReactNode }) {
  const { direction, transitionKey } = usePageTransition();
  const variants = getPageVariants(direction);

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={transitionKey}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="p-4 sm:p-6"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
