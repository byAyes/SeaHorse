'use client';

import * as React from 'react';
import { createContext, useContext, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Types ── */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
  /** Visually mark as destructive (red accent) */
  destructive?: boolean;
}

export interface ToastOptions {
  message?: string;
  /** Auto-dismiss duration in ms. Default 5000. Set to 0 for persistent. */
  duration?: number;
  /** Optional undo/action button */
  action?: ToastAction;
  /** Callback when toast is dismissed (by timeout, close, or escape) */
  onDismiss?: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
  action?: ToastAction;
  onDismiss?: () => void;
  createdAt: number;
}

/* ── Icons & Styles ── */

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles: Record<ToastType, string> = {
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400',
  error:
    'border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400',
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400',
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400',
};

/* ── Context ── */

interface ToastContextValue {
  toasts: Toast[];
  showToast: (type: ToastType, title: string, options?: string | ToastOptions) => string;
  dismissToast: (id: string) => void;
  dismissLatest: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

/* ── Reducer ── */

type Action =
  | { type: 'ADD'; toast: Toast }
  | { type: 'DISMISS'; id: string }
  | { type: 'CLEAR' };

function reducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case 'ADD':
      return [...state, action.toast];
    case 'DISMISS':
      return state.filter((t) => t.id !== action.id);
    case 'CLEAR':
      return [];
    default:
      return state;
  }
}

/* ── Provider ── */

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pausedToastsRef = useRef<Set<string>>(new Set());

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const startTimer = useCallback((toast: Toast) => {
    if (toast.duration <= 0) return;

    const timer = setTimeout(() => {
      dispatch({ type: 'DISMISS', id: toast.id });
      timersRef.current.delete(toast.id);
      toast.onDismiss?.();
    }, toast.duration);

    timersRef.current.set(toast.id, timer);
  }, []);

  const showToast = useCallback(
    (type: ToastType, title: string, options?: string | ToastOptions): string => {
      const id = `toast-${Date.now()}-${++toastIdCounter}`;

      // Handle legacy (type, title, message?) signature
      const message = typeof options === 'string' ? options : options?.message;
      const duration = typeof options === 'object' && options?.duration !== undefined ? options.duration : 5000;
      const action = typeof options === 'object' ? options?.action : undefined;
      const onDismiss = typeof options === 'object' ? options?.onDismiss : undefined;

      const toast: Toast = { id, type, title, message, duration, action, onDismiss, createdAt: Date.now() };

      dispatch({ type: 'ADD', toast });
      startTimer(toast);

      return id;
    },
    [startTimer],
  );

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: 'DISMISS', id });
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    pausedToastsRef.current.delete(id);
  }, []);

  const dismissLatest = useCallback(() => {
    if (toastsRef.current.length > 0) {
      const latest = toastsRef.current[toastsRef.current.length - 1];
      dismissToast(latest.id);
    }
  }, [dismissToast]);

  // Keep a ref to latest toasts for keyboard dismiss
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;

  // Global keyboard listener for Escape dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && toastsRef.current.length > 0) {
        const latest = toastsRef.current[toastsRef.current.length - 1];
        dispatch({ type: 'DISMISS', id: latest.id });
        const timer = timersRef.current.get(latest.id);
        if (timer) {
          clearTimeout(timer);
          timersRef.current.delete(latest.id);
        }
        pausedToastsRef.current.delete(latest.id);
        latest.onDismiss?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const pauseToast = useCallback((id: string) => {
    pausedToastsRef.current.add(id);
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const resumeToast = useCallback((id: string, remainingDuration: number) => {
    pausedToastsRef.current.delete(id);
    if (remainingDuration > 0) {
      const timer = setTimeout(() => {
        dispatch({ type: 'DISMISS', id });
        timersRef.current.delete(id);
        const toast = toastsRef.current.find((t) => t.id === id);
        toast?.onDismiss?.();
      }, remainingDuration);
      timersRef.current.set(id, timer);
    }
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, dismissLatest }}>
      {children}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
        onPause={pauseToast}
        onResume={resumeToast}
      />
    </ToastContext.Provider>
  );
}

/* ── Progress Bar ── */

function ProgressBar({ duration, paused }: { duration: number; paused: boolean }) {
  return (
    <motion.div
      className="absolute bottom-0 left-0 h-0.5 bg-current opacity-30"
      initial={{ width: '100%' }}
      animate={paused ? { width: '100%' } : { width: '0%' }}
      transition={paused ? {} : { duration: duration / 1000, ease: 'linear' }}
      style={{ originX: 0 }}
    />
  );
}

/* ── Container ── */

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string, remaining: number) => void;
}

export function ToastContainer({ toasts, onDismiss, onPause, onResume }: ToastContainerProps) {
  // Track elapsed time per toast for resume
  const startTimesRef = useRef<Map<string, number>>(new Map());

  // Local state for paused toast IDs — triggers re-render so ProgressBar freezes on hover
  const [pausedIds, setPausedIds] = useState<Set<string>>(new Set());

  // Track start times when toasts appear
  useEffect(() => {
    toasts.forEach((t) => {
      if (!startTimesRef.current.has(t.id)) {
        startTimesRef.current.set(t.id, Date.now());
      }
    });
  }, [toasts]);

  const handlePause = (toast: Toast) => {
    setPausedIds((prev) => new Set(prev).add(toast.id));
    onPause(toast.id);
  };

  const handleResume = (toast: Toast) => {
    setPausedIds((prev) => {
      const next = new Set(prev);
      next.delete(toast.id);
      return next;
    });
    const startTime = startTimesRef.current.get(toast.id) || Date.now();
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, toast.duration - elapsed);
    onResume(toast.id, remaining);
  };

  const handleDismiss = (toast: Toast) => {
    startTimesRef.current.delete(toast.id);
    toast.onDismiss?.();
    onDismiss(toast.id);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95, transition: { duration: 0.12, ease: 'easeOut' } }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1], layout: { duration: 0.2 } }}
              onMouseEnter={() => handlePause(toast)}
              onMouseLeave={() => handleResume(toast)}
              className={cn(
                'relative overflow-hidden rounded-lg border p-4 shadow-lg pointer-events-auto',
                styles[toast.type],
              )}
            >
              <div className="flex items-start gap-3">
                <Icon size={18} className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-medium">{toast.title}</p>
                  {toast.message && (
                    <p className="text-xs opacity-80">{toast.message}</p>
                  )}
                  {toast.action && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.action!.onClick();
                        handleDismiss(toast);
                      }}
                      className={cn(
                        'mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                        toast.action.destructive
                          ? 'bg-rose-200/60 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/30'
                          : 'bg-white/60 text-current hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/20',
                      )}
                    >
                      {toast.action.label}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => handleDismiss(toast)}
                  className="shrink-0 rounded-full p-0.5 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Progress bar — only show for non-persistent toasts */}
              {toast.duration > 0 && (
                <ProgressBar
                  key={`progress-${toast.id}`}
                  duration={toast.duration}
                  paused={pausedIds.has(toast.id)}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
