'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { FirstVisitRedirect } from '@/components/layout/first-visit-redirect';
import { PageTransitionProvider } from '@/lib/page-transitions';

/**
 * Lazy-load the motion wrapper to keep framer-motion (~93KB) out of the
 * critical bundle. The wrapper is only fetched on the first navigation
 * that triggers a page transition, not on initial load.
 */
const MotionPageWrapper = dynamic(
  () => import('@/components/layout/motion-page-wrapper').then((mod) => mod.MotionPageWrapper),
  {
    ssr: false,
    loading: () => <div className="p-4 sm:p-6">{/* Skeleton handled by parent */}</div>,
  },
);

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <PageTransitionProvider>
      <InnerLayout
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileToggle={() => setMobileOpen(!mobileOpen)}
        onMobileClose={() => setMobileOpen(false)}
      >
        {children}
      </InnerLayout>
    </PageTransitionProvider>
  );
}

function InnerLayout({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileToggle,
  onMobileClose,
  children,
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileToggle: () => void;
  onMobileClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen mobile-nav-spacer">
      <Sidebar
        collapsed={collapsed}
        onToggle={onToggle}
        mobileOpen={mobileOpen}
        onMobileClose={onMobileClose}
      />
      <div
        className="flex flex-1 flex-col transition-all duration-300 lg:ml-0"
        style={{ marginLeft: collapsed ? 60 : 240 }}
      >
        {/* Ambient glow accent — shared across all pages */}
        <div
          className="absolute top-0 right-0 w-72 sm:w-96 h-72 sm:h-96 rounded-full blur-3xl pointer-events-none z-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(79,70,229,0.06) 0%, transparent 70%)',
          }}
        />
        <Header onMobileToggle={onMobileToggle} />
        <main className="flex-1 relative z-[1]">
          <MotionPageWrapper>
            <FirstVisitRedirect>{children}</FirstVisitRedirect>
          </MotionPageWrapper>
        </main>
      </div>
    </div>
  );
}
