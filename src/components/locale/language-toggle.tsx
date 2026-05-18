'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

const locales = [
  { value: 'en' as const, label: 'English', short: 'EN' },
  { value: 'es' as const, label: 'Español', short: 'ES' },
  { value: 'pt' as const, label: 'Português', short: 'PT' },
  { value: 'fr' as const, label: 'Français', short: 'FR' },
  { value: 'de' as const, label: 'Deutsch', short: 'DE' },
];

export function LanguageToggle() {
  const { locale, setLocale, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const current = locales.find((l) => l.value === locale) || locales[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-dark-surface-tertiary transition-colors"
        aria-label={t('common.language')}
      >
        <Globe size={14} />
        <span className="hidden sm:inline">{current.short}</span>
        <ChevronDown
          size={12}
          className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-1 w-36 overflow-hidden rounded-lg border bg-surface shadow-lg dark:bg-dark-surface dark:border-slate-700 z-50"
          >
            {locales.map((l) => {
              const active = l.value === locale;
              return (
                <button
                  key={l.value}
                  onClick={() => {
                    setLocale(l.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'bg-primary-50 text-primary-dark dark:bg-primary-50/10 dark:text-primary-light font-medium'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-dark-surface-tertiary'
                  }`}
                >
                  <span className="flex-1">{l.label}</span>
                  {active && <Check size={14} className="shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
