import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MatchedJob } from '@/types/job-match';
import type { UserProfile } from '@/types/user-profile';

// ── Generic fetch helpers ──

function getAuthHeaders(): Record<string, string> {
  // Check runtime env (Next.js public env vars at build time won't update
  // if changed at runtime — so we also check localStorage as a fallback
  const token =
    (typeof window !== 'undefined' && localStorage.getItem('ADMIN_API_TOKEN')) ||
    process.env.NEXT_PUBLIC_ADMIN_TOKEN ||
    '';

  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

const DEFAULT_TIMEOUT_MS = 15_000;

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      ...options,
    });
    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${res.status}: ${errorBody}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ── Types ──

interface MatchJobsResponse {
  matches: MatchedJob[];
  total: number;
  threshold: number;
  userId: string;
}

interface ProfileHistoryResponse {
  history: Array<{
    id: string;
    changeType: string;
    previousValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
    createdAt: string;
  }>;
  total: number;
}

interface StatsResponse {
  totalJobs: number;
  totalJobsToday: number;
  totalMatches: number;
  totalProfiles: number;
  pipelinesRun: number;
  jobTrend: number;
  jobsByDay: Array<{ date: string; count: number }>;
  topSkills: Array<{ skill: string; count: number }>;
  recentMatches: MatchedJob[];
  lastPipelineRun: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    scraped: number;
    matched: number;
    saved: number;
    error: string | null;
  } | null;
}

interface EmailSendPayload {
  to: string;
  subject: string;
  html: string;
  cc?: string;
}

interface CvUploadPayload {
  file: File;
  userId?: string;
}

interface ProcessCvPayload {
  cvId: string;
  userId?: string;
  provider?: string;
  apiKey?: string;
}

interface UpdateProfilePayload {
  userId: string;
  skills?: string[];
  interests?: string[];
  location?: string;
  remoteOnly?: boolean;
  minSalary?: number;
  maxSalary?: number;
  experienceLevel?: string;
  summary?: string;
  languages?: Array<{ language: string; level?: string }>;
  jobTitles?: string[];
  industries?: string[];
  education?: Array<{ degree: string; institution: string; graduationYear?: string }>;
}

const DEFAULT_USER_ID = 'default-user';

// ── Query Hooks ──

export function useStats() {
  return useQuery<StatsResponse>({
    queryKey: ['stats'],
    queryFn: () => fetchJSON<StatsResponse>(`/api/stats`),
    staleTime: 60_000,
    // No automatic polling — user refreshes manually via the refresh button
  });
}

export function useMatchJobs(params?: { userId?: string; threshold?: number; limit?: number }) {
  const { userId = DEFAULT_USER_ID, threshold = 0, limit = 100 } = params || {};
  return useQuery<MatchJobsResponse>({
    queryKey: ['match-jobs', userId, threshold, limit],
    queryFn: () =>
      fetchJSON<MatchJobsResponse>(
        `/api/match-jobs?userId=${encodeURIComponent(userId)}&threshold=${threshold}&limit=${limit}`,
      ),
  });
}

export function useProfile(userId?: string) {
  const id = userId || DEFAULT_USER_ID;
  return useQuery<UserProfile>({
    queryKey: ['profile', id],
    queryFn: () => fetchJSON<UserProfile>(`/api/profile/extract?userId=${encodeURIComponent(id)}`),
  });
}

export function useProfileHistory(params?: { userId?: string; limit?: number }) {
  const { userId = DEFAULT_USER_ID, limit = 50 } = params || {};
  return useQuery<ProfileHistoryResponse>({
    queryKey: ['profile-history', userId, limit],
    queryFn: () =>
      fetchJSON<ProfileHistoryResponse>(
        `/api/profile/history?userId=${encodeURIComponent(userId)}&limit=${limit}`,
      ),
  });
}

// ── Mutation Hooks ──

export function useSendEmail() {
  return useMutation({
    mutationFn: (payload: EmailSendPayload) =>
      fetchJSON<{ success: boolean }>('/api/email/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

export function useUploadCv() {
  return useMutation({
    mutationFn: async (payload: CvUploadPayload) => {
      const formData = new FormData();
      formData.append('file', payload.file);
      if (payload.userId) formData.append('userId', payload.userId);
      const res = await fetch('/api/cv/upload', {
        method: 'POST',
        body: formData,
        headers: getAuthHeaders(), // Don't set Content-Type — browser sets multipart boundary
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      return res.json() as Promise<{ success: boolean; cvId: string }>;
    },
  });
}

export function useProcessCv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProcessCvPayload) =>
      fetchJSON<{ profile: Record<string, unknown> }>('/api/cv/process', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) =>
      fetchJSON<{ success: boolean }>('/api/cv/update-profile', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['match-jobs'] });
    },
  });
}

// ── Pipeline Hooks ──

export interface PipelineRunStatus {
  id: string;
  status: 'running' | 'completed' | 'error';
  logs: string[];
  result: {
    scraped: number;
    matched: number;
    saved: number;
    cleaned: number;
    errors: string[];
    scraperStats: Array<{ name: string; jobs: number; errors: number; duration: number }>;
    matches: MatchedJob[];
  } | null;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export function useRunPipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile?: Record<string, unknown>) =>
      fetchJSON<{ runId: string; status: string }>('/api/pipeline/run', {
        method: 'POST',
        body: JSON.stringify(profile ? { profile } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['match-jobs'] });
    },
  });
}

export function usePipelineStatus(runId: string | null) {
  return useQuery<PipelineRunStatus>({
    queryKey: ['pipeline-status', runId],
    queryFn: () =>
      fetchJSON<PipelineRunStatus>(`/api/pipeline/run?runId=${encodeURIComponent(runId!)}`),
    enabled: !!runId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'completed' || data?.status === 'error') {
        return false; // Stop polling when done
      }
      return 1500; // Poll every 1.5s while running
    },
  });
}

export { DEFAULT_USER_ID };
