'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Upload,
  Briefcase,
  PlayCircle,
  Settings,
  ChevronLeft,
  Sparkles,
  User,
} from 'lucide-react';
import { SeahorseLogo } from '@/components/brand/seahorse-logo';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const navItemKeys = [
  { href: '/dashboard', labelKey: 'sidebar.dashboard', icon: LayoutDashboard },
  { href: '/upload', labelKey: 'sidebar.upload', icon: Upload },
  { href: '/profile', labelKey: 'sidebar.profile', icon: User },
  { href: '/jobs', labelKey: 'sidebar.jobs', icon: Briefcase },
  { href: '/pipeline', labelKey: 'sidebar.pipeline', icon: PlayCircle },
  { href: '/setup', labelKey: 'sidebar.setup', icon: Sparkles },
  { href: '/settings', labelKey: 'sidebar.settings', icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-surface/90 backdrop-blur-xl dark:bg-dark-surface/90 dark:border-slate-800/60 transition-all duration-300 hide-mobile',
          collapsed ? 'w-[60px]' : 'w-[240px]',
        )}
      >
        {/* Ambient gradient bar */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        {/* Logo / Brand */}
        <div className="relative flex h-16 items-center border-b border-slate-200/50 px-4 dark:border-slate-800/50">
          {collapsed ? (
            <div className="flex items-center justify-center w-full">
              <SeahorseLogo variant="icon" size={20} />
            </div>
          ) : (
            <SeahorseLogo variant="wordmark" />
          )}
        </div>

        {/* Nav Items */}
        <nav className="relative flex-1 space-y-0.5 p-3">
          {navItemKeys.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'text-primary-dark dark:text-primary-light'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary-50/80 to-primary-50/30 dark:from-primary-50/10 dark:to-transparent" />
                )}
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-primary to-primary-light shadow-lg shadow-primary/30" />
                )}
                <div className="relative z-10 shrink-0">
                  <Icon size={18} />
                </div>
                {!collapsed && <span className="relative z-10">{t(item.labelKey)}</span>}
                {isActive && !collapsed && (
                  <div className="relative z-10 ml-auto flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 dark:bg-primary/20">
                    <Sparkles size={10} className="text-primary" />
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="relative border-t border-slate-200/50 p-3 dark:border-slate-800/50">
          {' '}
          <button
            onClick={onToggle}
            aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-100/80 dark:hover:bg-dark-surface-tertiary/80 transition-all duration-150 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <motion.div
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            >
              <ChevronLeft size={14} />
            </motion.div>
            {!collapsed && <span>{t('sidebar.collapse')}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer sidebar */}
      <motion.aside
        initial={false}
        animate={mobileOpen ? 'open' : 'closed'}
        variants={{
          open: { x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
          closed: { x: '-100%', transition: { type: 'spring', stiffness: 300, damping: 30 } },
        }}
        className="fixed left-0 top-0 z-40 flex h-screen w-[260px] flex-col border-r bg-surface backdrop-blur-xl dark:bg-dark-surface dark:border-slate-800/60 show-mobile"
      >
        {/* Logo */}
        <div className="relative flex h-16 items-center px-4 border-b border-slate-200/50 dark:border-slate-800/50">
          <SeahorseLogo variant="wordmark" />
        </div>

        {/* Mobile Nav */}
        <nav className="relative flex-1 space-y-0.5 p-3">
          {navItemKeys.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'text-primary-dark dark:text-primary-light'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary-50/80 to-primary-50/30 dark:from-primary-50/10 dark:to-transparent" />
                )}
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-primary to-primary-light" />
                )}
                <Icon size={18} className="shrink-0" />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </motion.aside>

      {/* Mobile bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200/50 bg-surface/95 backdrop-blur-xl dark:bg-dark-surface/95 dark:border-slate-800/50 safe-bottom show-mobile">
        {navItemKeys.slice(0, 4).map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center gap-0.5 py-2 px-3 min-w-0 transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
              )}
            >
              {isActive && (
                <div className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
              )}
              <div>
                <Icon size={20} />
              </div>
              <span className="text-[10px] font-medium leading-tight truncate max-w-full">
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
        {/* 5th item as "More" or Settings */}
        <Link
          href="/settings"
          aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
          className={cn(
            'relative flex flex-col items-center gap-0.5 py-2 px-3 min-w-0 transition-colors',
            pathname.startsWith('/settings')
              ? 'text-primary'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
          )}
        >
          <div>
            <Settings size={20} />
          </div>
          <span className="text-[10px] font-medium leading-tight truncate max-w-full">
            {t('sidebar.settings')}
          </span>
        </Link>
      </nav>
    </>
  );
}
