import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import Script from 'next/script';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Seahorse — Dashboard de Pipeline de Jobs',
  description: 'Dashboard interactivo para el pipeline de scraping, matching y envío de jobs',
  icons: {
    icon: { url: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read nonce from middleware-injected header (set in src/middleware.ts)
  const nonce = (await headers()).get('x-nonce') || '';

  return (
    <html lang="es" suppressHydrationWarning>
      <head />
      <body className={`${inter.className} min-h-screen`}>
        {/* Prevent FOUC for dark mode — runs before first paint to avoid flash */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var isDark = theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) document.documentElement.classList.add('dark');
                } catch(e) {
                  /* localStorage may be blocked in some environments; default to light mode */
                }
              })();
            `,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
