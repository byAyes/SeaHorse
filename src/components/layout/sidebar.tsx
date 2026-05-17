"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Upload,
  Briefcase,
  PlayCircle,
  Settings,
  ChevronLeft,
  Ship,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const navItemKeys = [
  { href: "/dashboard", labelKey: "sidebar.dashboard", icon: LayoutDashboard },
  { href: "/upload", labelKey: "sidebar.upload", icon: Upload },
  { href: "/jobs", labelKey: "sidebar.jobs", icon: Briefcase },
  { href: "/pipeline", labelKey: "sidebar.pipeline", icon: PlayCircle },
  { href: "/settings", labelKey: "sidebar.settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-surface dark:bg-dark-surface dark:border-slate-800 transition-all duration-300",
        collapsed ? "w-[60px]" : "w-[240px]"
      )}
    >
      {/* Logo / Brand */}
      <div className="flex h-16 items-center gap-3 border-b px-4 dark:border-slate-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
          <Ship size={18} />
        </div>
        {!collapsed && (
          <span className="text-base font-semibold tracking-tight">Seahorse</span>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 space-y-1 p-3">
        {navItemKeys.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-primary-50 text-primary-dark dark:bg-primary-50/10 dark:text-primary-light"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-dark-surface-tertiary"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-primary-50 dark:bg-primary-50/10"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <motion.div
                className="relative z-10 shrink-0"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Icon size={18} />
              </motion.div>
              {!collapsed && (
                <motion.span
                  className="relative z-10"
                  layout
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  {t(item.labelKey)}
                </motion.span>
              )}
              {isActive && !collapsed && (
                <motion.span
                  layoutId="sidebar-indicator"
                  className="absolute right-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t p-3 dark:border-slate-800">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-surface-tertiary transition-colors"
        >
          <ChevronLeft
            size={14}
            className={cn(
              "transition-transform duration-200",
              collapsed && "rotate-180"
            )}
          />
          {!collapsed && <span>{t("sidebar.collapse")}</span>}
        </button>
      </div>
    </aside>
  );
}
