'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SeahorseLogoProps {
  className?: string;
  size?: number;
  variant?: 'default' | 'wordmark' | 'icon';
}

/**
 * Custom Seahorse brand logo — elegant SVG icon with optional wordmark.
 *
 * The seahorse form is built from organic bezier curves that
 * suggest grace, precision, and flow — qualities of the product.
 */
export function SeahorseLogo({ className, size = 24, variant = 'default' }: SeahorseLogoProps) {
  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      {/* Seahorse silhouette */}
      <path
        d="M16 2C12 2 10 5 10 8v2c0 2-1.5 3.5-3 4.5C5.5 16 4 18 4 21c0 4 3 7 7 7h2c2 0 4-1.5 5-3 .5-1 1-2 1-3v-1c0-1 .5-2 1.5-2.5s2-.5 3 .5c1 1 2 1.5 3 1.5s2-.8 2-2c0-1.5-1-3-2.5-4-.8-.5-1.5-1.2-1.5-2v-2c0-3-2-6-5-7V4c0-1-.5-2-1.5-2S17 2 16 2z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* Eye */}
      <circle cx="13" cy="9" r="1.5" fill="white" opacity="0.85" />
      {/* Dorsal fin detail */}
      <path
        d="M18 5c1 1 2 3 2 5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
        fill="none"
      />
      {/* Belly ridge */}
      <path
        d="M14 15c1 1 2 2 2 4"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.3"
        fill="none"
      />
    </svg>
  );

  if (variant === 'icon') {
    return icon;
  }

  // Wordmark: icon + "Seahorse" text
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-glow-primary">
        {icon}
      </div>
      <div className="flex flex-col">
        <span
          className="text-[15px] font-bold tracking-tight text-slate-800 dark:text-white"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Seahorse
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wide uppercase">
          Pipeline
        </span>
      </div>
    </div>
  );
}
