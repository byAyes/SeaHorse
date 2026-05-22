'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageTransitionProvider, usePageTransition, getPageVariants } from '@/lib/page-transitions';

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
  const { direction, transitionKey } = usePageTransition();
  const variants = getPageVariants(direction);

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
        </main>
      </div>
    </div>
  );
}
