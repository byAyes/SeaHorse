"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const variantClasses = {
  default:
    "bg-primary text-white shadow-sm hover:bg-primary-dark hover:shadow-md hover:-translate-y-0.5",
  secondary:
    "bg-surface-tertiary text-slate-900 shadow-sm hover:bg-slate-200 dark:bg-dark-surface-tertiary dark:text-slate-100 dark:hover:bg-slate-700 hover:-translate-y-0.5",
  outline:
    "border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-dark-surface-tertiary hover:-translate-y-0.5",
  ghost:
    "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-dark-surface-tertiary",
  danger:
    "bg-danger text-white shadow-sm hover:bg-rose-600 hover:-translate-y-0.5",
  link: "text-primary underline-offset-4 hover:underline",
} as const;

const sizeClasses = {
  sm: "h-8 px-3 text-xs",
  default: "h-10 px-4",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10",
} as const;

type Variant = keyof typeof variantClasses;
type Size = keyof typeof sizeClasses;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[--radius-button] text-sm font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
