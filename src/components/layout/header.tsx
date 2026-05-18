'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from './theme-toggle';
import { LanguageToggle } from '@/components/locale/language-toggle';
import { useTranslation } from '@/lib/i18n';

const pageTitleKeys: Record<string, string> = {
  '/dashboard': 'header.dashboard',
  '/upload': 'header.upload',
  '/jobs': 'header.jobs',
  '/pipeline': 'header.pipeline',
  '/settings': 'header.settings',
};

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const { t } = useTranslation();

  const rawPath = Object.keys(pageTitleKeys).find((p) => pathname.startsWith(p)) || '/dashboard';
  const title = t(pageTitleKeys[rawPath]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-surface/80 backdrop-blur-xl dark:bg-dark-surface/80 dark:border-slate-800 transition-shadow duration-300 ${
        scrolled ? 'shadow-sm' : 'shadow-none'
      }`}
    >
      <div className="px-6">
        <AnimatePresence mode="wait">
          <motion.h1
            key={rawPath}
            initial={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="text-lg font-semibold tracking-tight"
          >
            {title}
          </motion.h1>
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-1 px-6">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
