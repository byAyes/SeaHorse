'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AiStatus {
  hasAiKey: boolean;
  hasJSearchKey: boolean;
  activeProvider: string | null;
  loading: boolean;
  configured: {
    jsearch: boolean;
    gemini: boolean;
    openrouter: boolean;
    nim: boolean;
  };
}

export interface UseAiStatusReturn extends AiStatus {
  refetch: () => Promise<void>;
}

/**
 * Centralized hook to check which API keys are configured on the server.
 * Fetches /api/config/keys once on mount and caches the result.
 */
export function useAiStatus(): UseAiStatusReturn {
  const [status, setStatus] = useState<AiStatus>({
    hasAiKey: false,
    hasJSearchKey: false,
    activeProvider: null,
    loading: true,
    configured: { jsearch: false, gemini: false, openrouter: false, nim: false },
  });

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/config/keys');
      const data = await res.json();
      setStatus({
        hasAiKey: !!data.activeProvider,
        hasJSearchKey: !!data.configured?.jsearch,
        activeProvider: data.activeProvider || null,
        loading: false,
        configured: data.configured || {
          jsearch: false,
          gemini: false,
          openrouter: false,
          nim: false,
        },
      });
    } catch {
      setStatus((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchStatus().finally(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [fetchStatus]);

  return { ...status, refetch: fetchStatus };
}
