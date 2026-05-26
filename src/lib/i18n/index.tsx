'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import en from './en.json';

type Locale = 'en' | 'es' | 'pt' | 'fr' | 'de';
type TranslationMap = typeof en;

// Static map of dynamic locale loaders — only used for non-en locales
const localeLoaders: Record<string, () => Promise<{ default: TranslationMap }>> = {
  es: () => import('./es.json'),
  pt: () => import('./pt.json'),
  fr: () => import('./fr.json'),
  de: () => import('./de.json'),
};

function getNested(obj: unknown, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : path;
}

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [translations, setTranslations] = useState<TranslationMap>(en);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale | null;
    if (saved === 'es' || saved === 'pt' || saved === 'fr' || saved === 'de') {
      setLocaleState(saved);
      // Load the saved locale's translations dynamically
      localeLoaders[saved]()
        .then((mod) => setTranslations(mod.default))
        .catch(() => setTranslations(en));
    }
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);

    if (newLocale === 'en') {
      setTranslations(en);
    } else {
      localeLoaders[newLocale]()
        .then((mod) => setTranslations(mod.default))
        .catch(() => setTranslations(en));
    }
  }, []);

  const t = useCallback(
    (key: string): string => {
      return getNested(translations, key);
    },
    [translations],
  );

  // Before mount: render with 'en' defaults (static import, always available)
  if (!mounted) {
    const fallbackT = (key: string): string => getNested(en, key);
    return (
      <LanguageContext.Provider value={{ locale: 'en', setLocale: () => {}, t: fallbackT }}>
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>{children}</LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useTranslation must be used within LanguageProvider');
  return ctx;
}
