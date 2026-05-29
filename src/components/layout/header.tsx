'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { LanguageToggle } from '@/components/locale/language-toggle';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';

const pageTitleKeys: Record<string, string> = {
  '/dashboard': 'header.dashboard',
  '/upload': 'header.upload',
  '/jobs': 'header.jobs',
  '/pipeline': 'header.pipeline',
  '/settings': 'header.settings',
  '/setup': 'setup.title',
};

// Map paths to gradient accents
const pageGradients: Record<string, string> = {
  '/dashboard': 'from-primary/20 via-primary/5 to-transparent',
  '/upload': 'from-emerald-500/20 via-emerald-500/5 to-transparent',
  '/jobs': 'from-amber-500/20 via-amber-500/5 to-transparent',
  '/pipeline': 'from-violet-500/20 via-violet-500/5 to-transparent',
  '/settings': 'from-sky-500/20 via-sky-500/5 to-transparent',
  '/setup': 'from-emerald-500/20 via-emerald-500/5 to-transparent',
};

const pageSubtitles: Record<string, string> = {
  '/dashboard': 'header.dashboardSub',
  '/upload': 'header.uploadSub',
  '/jobs': 'header.jobsSub',
  '/pipeline': 'header.pipelineSub',
  '/settings': 'header.settingsSub',
  '/setup': 'setup.subtitle',
};

interface HeaderProps {
  onMobileToggle?: () => void;
}

export function Header({ onMobileToggle }: HeaderProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const { t } = useTranslation();

  const rawPath = Object.keys(pageTitleKeys).find((p) => pathname.startsWith(p)) || '/dashboard';
  const title = t(pageTitleKeys[rawPath]);
  const subtitle = t(pageSubtitles[rawPath] || '');
  const gradient = pageGradients[rawPath] || pageGradients['/dashboard'];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-surface/70 backdrop-blur-xl dark:bg-dark-surface/70 dark:border-slate-800/50 transition-all duration-300 ${
        scrolled ? 'shadow-sm' : 'shadow-none'
      }`}
    >
      {/* Gradient accent bar */}
      <div className={`absolute inset-x-0 bottom-0 h-px bg-gradient-to-r ${gradient}`} />

      <div className="flex flex-1 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onMobileToggle}
            className="show-mobile -ml-2 shrink-0"
            aria-label="Toggle menu"
          >
            <Menu size={20} />
          </Button>
          <div className="relative min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={rawPath}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              >
                <h1
                  className="text-base sm:text-lg font-bold tracking-tight truncate"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {title}
                </h1>
                {subtitle && subtitle !== title && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium truncate">
                    {subtitle}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <LanguageToggle />
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/50 mx-1" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
