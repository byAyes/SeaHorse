"use client";

import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./theme-provider";
import { useTranslation } from "@/lib/i18n";

export function ThemeToggle() {
  const { resolved, toggle, mounted } = useTheme();
  const { t } = useTranslation();

  // Show a placeholder before mount to prevent hydration mismatch.
  // The FOUC script in layout.tsx prevents visible flash.
  if (!mounted) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-lg">
        <div className="h-[18px] w-[18px]" />
      </div>
    );
  }

  return (
    <button
      onClick={toggle}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-dark-surface-tertiary transition-colors"
      aria-label={resolved === "dark" ? t("settings.theme.light") : t("settings.theme.dark")}
    >
      <motion.div
        key={resolved}
        initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
        transition={{ duration: 0.2 }}
      >
        {resolved === "dark" ? <Moon size={18} /> : <Sun size={18} />}
      </motion.div>
    </button>
  );
}
