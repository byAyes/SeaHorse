'use client';

import * as React from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  mounted: boolean;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return getSystemTheme();
  return theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Consistent initial state for server and client — avoids hydration mismatch.
  // The FOUC script in layout.tsx already sets the correct dark class on <html>.
  // After mount, we read localStorage and sync the React state.
  const [mounted, setMounted] = React.useState(false);
  const [theme, setThemeState] = React.useState<Theme>('system');
  const [resolved, setResolved] = React.useState<'light' | 'dark'>('light');

  // Hydration-safe init: read localStorage and apply stored theme
  React.useEffect(() => {
    const stored = (localStorage.getItem('theme') as Theme) || 'system';
    const resolvedTheme = resolveTheme(stored);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(stored);
    setResolved(resolvedTheme);
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
    setMounted(true);
  }, []);

  // Listen for system theme changes (only after mount)
  React.useEffect(() => {
    if (!mounted) return;
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        const sys = mq.matches ? 'dark' : 'light';
        setResolved(sys);
        document.documentElement.classList.toggle('dark', sys === 'dark');
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme, mounted]);

  const setTheme = React.useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    const resolvedTheme = resolveTheme(newTheme);
    setResolved(resolvedTheme);
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, []);

  const toggle = React.useCallback(() => {
    const next = resolved === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [resolved, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
