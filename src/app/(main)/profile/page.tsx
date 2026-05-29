'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  MapPin,
  Briefcase,
  Wrench,
  Globe,
  Target,
  BarChart3,
  Sparkles,
  Clock,
  DollarSign,
  Star,
  FileText,
  RefreshCw,
  SquarePen,
  X,
  Check,
  Save,
  GraduationCap,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile, useUpdateProfile, DEFAULT_USER_ID } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import type { ExtractedProfile } from '@/types/ai-profile';

// ── Easing (exponential ease-out, no bounce) ──
const easeOut = [0.23, 1, 0.32, 1] as const;
const easeGentle = [0.25, 0.46, 0.45, 0.94] as const;

// ── Helpers ──

/** Static class map for level badges — avoids dynamic Tailwind class construction */
const LEVEL_STYLE: Record<string, string> = {
  junior: 'bg-emerald-500 text-white shadow-sm',
  mid: 'bg-amber-500 text-white shadow-sm',
  senior: 'bg-blue-500 text-white shadow-sm',
  lead: 'bg-violet-500 text-white shadow-sm',
};

function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return '—';
  const fmt = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`);
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `\u2265 ${fmt(min)}`;
  return `\u2264 ${fmt(max!)}`;
}

function formatDateRelative(d: Date, locale: string): string {
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'minute');
  if (mins < 60) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-mins, 'minute');
  const hours = Math.floor(mins / 60);
  if (hours < 24) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-days, 'day');
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function getInitials(name?: string | null, fallback = '?'): string {
  if (!name) return fallback;
  return name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getLocaleLevelKey(level: string): string {
  const map: Record<string, string> = {
    junior: 'settings.profile.junior',
    mid: 'settings.profile.mid',
    senior: 'settings.profile.senior',
    lead: 'settings.profile.lead',
  };
  return map[level] || level;
}

// ── Animation variants ──

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.08 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOut } },
};

const slideIn = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: easeOut } },
};

const scaleBadge = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: easeOut } },
};

const barGrow = {
  hidden: { width: 0 },
  show: (width: number) => ({
    width: `${width}%`,
    transition: { duration: 0.5, ease: easeOut },
  }),
};

// ── Sub-components ──

function ProfileAvatar({ initials }: { initials: string }) {
  return (
    <div className="relative flex-shrink-0">
      <div className="flex h-15 w-15 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-500/20 dark:shadow-indigo-500/10">
        <span className="text-base sm:text-lg font-bold tracking-tight text-white">{initials}</span>
      </div>
      <div className="absolute -inset-0.5 rounded-full border border-white/15 dark:border-white/10 pointer-events-none" />
    </div>
  );
}

function CompactStatRow({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800/60">
        {children}
      </div>
    </Card>
  );
}

function CompactStatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <motion.div variants={fadeUp} className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {label}
        </p>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
          {value || '—'}
        </p>
      </div>
    </motion.div>
  );
}

/** Skill badge with size hierarchy: first 3 are larger, rest progressive */
function SkillBadge({ skill, index }: { skill: string; index: number }) {
  const sizeClass = index < 3 ? 'text-xs font-semibold px-3 py-1' : 'text-[11px]';
  const variant: 'success' | 'default' | 'outline' =
    index === 0 ? 'success' : index < 6 ? 'default' : 'outline';

  return (
    <motion.span
      variants={scaleBadge}
      custom={index}
    >
      <Badge variant={variant} className={sizeClass}>
        {skill}
      </Badge>
    </motion.span>
  );
}

/** Language row with animated proficiency bar */
function LangRow({
  language,
  level,
  index,
}: {
  language: string;
  level?: string;
  index: number;
}) {
  const pct =
    level === 'Native' || level === 'Nativo'
      ? 100
      : level === 'Fluent' || level === 'Fluido' || level === 'C2'
        ? 90
        : level === 'Advanced' || level === 'Avanzado' || level === 'C1'
          ? 75
          : level === 'Intermediate' || level === 'Intermedio' || level === 'B2'
            ? 60
            : level === 'Basic' || level === 'Básico' || level === 'B1'
              ? 40
              : level
                ? 50
                : 0;

  return (
    <motion.div
      variants={slideIn}
      custom={index}
      className="flex items-center justify-between gap-3"
    >
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-0 truncate">
        {language}
      </span>
      <div className="flex items-center gap-2.5 shrink-0">
        {level && pct > 0 && (
          <div className="w-20 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <motion.div
              variants={barGrow}
              custom={pct}
              className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
            />
          </div>
        )}
        {level && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 min-w-[4rem] text-right">
            {level}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/** Horizontal weight bar — gradient, animated width */
function WeightBar({
  label,
  value,
  barColor,
  index,
}: {
  label: string;
  value: number;
  barColor: string;
  index: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      custom={index}
      className="flex items-center gap-3"
    >
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-20 shrink-0 text-right">
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <motion.div
          variants={barGrow}
          custom={value}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
      <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300 w-8 shrink-0">
        {value}%
      </span>
    </motion.div>
  );
}

// ── Empty State ──

function EmptyProfileState({ t }: { t: (key: string) => string }) {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: easeGentle } }}>
        <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
          <User size={18} className="text-primary shrink-0" />
          <span className="truncate">{t('profile.title')}</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('profile.subtitle')}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOut, delay: 0.1 } }}
      >
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="relative mb-6">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700">
                <User size={40} className="text-slate-400 dark:text-slate-500" />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary shadow-sm shadow-primary/20">
                <Sparkles size={12} className="text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
              {t('profile.noProfile')}
            </h3>
            <p className="text-sm text-slate-500 mt-1.5 max-w-sm leading-relaxed">
              {t('profile.noProfileDesc')}
            </p>
            <div className="flex gap-3 mt-8">
              <Link href="/upload">
                <Button>
                  <FileText size={14} />
                  {t('dashboard.actions.uploadCv')}
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline">
                  <Sparkles size={14} />
                  {t('pipeline.goToSettings')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ── Loading State ──

function LoadingProfileState() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-none first:rounded-l-xl last:rounded-r-xl" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    </div>
  );
}

// ── Section empty states — contextual, not just "no data" ──

function EmptySkills({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
        <Wrench size={18} className="text-slate-400 dark:text-slate-500" />
      </div>
      <p className="text-sm text-slate-500 mb-1">{t('profile.noSkills')}</p>
      <p className="text-xs text-slate-400 max-w-[14rem]">{t('profile.noSkillsDesc')}</p>
    </div>
  );
}

function EmptyLanguages({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
        <Globe size={18} className="text-slate-400 dark:text-slate-500" />
      </div>
      <p className="text-sm text-slate-500">{t('profile.noLanguages')}</p>
      <p className="text-xs text-slate-400 mt-0.5">{t('profile.noLanguagesDesc')}</p>
    </div>
  );
}

function EmptySummary({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
        <FileText size={18} className="text-slate-400 dark:text-slate-500" />
      </div>
      <p className="text-sm text-slate-500">{t('profile.noSummary')}</p>
      <p className="text-xs text-slate-400 mt-0.5 max-w-[12rem]">{t('profile.noSummaryDesc')}</p>
    </div>
  );
}

function EmptyEducation({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
        <GraduationCap size={18} className="text-slate-400 dark:text-slate-500" />
      </div>
      <p className="text-sm text-slate-500">{t('profile.noEducation')}</p>
      <p className="text-xs text-slate-400 mt-0.5 max-w-[12rem]">{t('profile.noEducationDesc')}</p>
    </div>
  );
}

function EmptyJobTitles({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
        <Target size={18} className="text-slate-400 dark:text-slate-500" />
      </div>
      <p className="text-sm text-slate-500">{t('profile.noJobTitles')}</p>
      <p className="text-xs text-slate-400 mt-0.5">{t('profile.noJobTitlesDesc')}</p>
    </div>
  );
}

function EmptyIndustries({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
        <Briefcase size={18} className="text-slate-400 dark:text-slate-500" />
      </div>
      <p className="text-sm text-slate-500">{t('profile.noIndustries')}</p>
      <p className="text-xs text-slate-400 mt-0.5">{t('profile.noIndustriesDesc')}</p>
    </div>
  );
}

// ── Main Component ──

export default function ProfilePage() {
  const { t, locale } = useTranslation();
  const { data: profile, isLoading, refetch, isRefetching } = useProfile();
  const updateProfile = useUpdateProfile();
  const { showToast } = useToast();
  const [localProfile, setLocalProfile] = useState<ExtractedProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [editSkills, setEditSkills] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editMinSalary, setEditMinSalary] = useState('');
  const [editMaxSalary, setEditMaxSalary] = useState('');
  const [editRemoteOnly, setEditRemoteOnly] = useState(false);
  const [editExperienceLevel, setEditExperienceLevel] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('USER_PROFILE');
      if (saved) {
        setLocalProfile(JSON.parse(saved));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Merge data sources: API (UserProfile) + localStorage (ExtractedProfile)
  const merged = useMemo(() => {
    const skills = profile?.skills?.length ? profile.skills : localProfile?.skills || [];
    const location = profile?.location || localProfile?.locations?.[0] || null;
    const experienceLevel = profile?.experienceLevel || localProfile?.experienceLevel || null;
    // Read from API first, fall back to localStorage for backward compat
    const languages =
      profile?.languages?.length
        ? profile.languages
        : localProfile?.languages || [];
    const jobTitles =
      profile?.jobTitles?.length
        ? profile.jobTitles
        : localProfile?.jobTitles || [];
    const industries =
      profile?.industries?.length
        ? profile.industries
        : localProfile?.industries || [];
    const summary =
      profile?.summary || localProfile?.summary || null;
    const education =
      profile?.education?.length
        ? profile.education
        : [];
    const interests = profile?.interests || [];
    const salaryRange = localProfile?.salaryRange || null;
    const updatedAt = profile?.updatedAt ? new Date(profile.updatedAt) : null;

    return {
      skills,
      location,
      experienceLevel,
      languages,
      jobTitles,
      industries,
      summary,
      education,
      interests,
      salaryRange,
      updatedAt,
      remoteOnly: profile?.remoteOnly ?? false,
      minSalary: profile?.minSalary ?? salaryRange?.min ?? null,
      maxSalary: profile?.maxSalary ?? salaryRange?.max ?? null,
      skillWeight: profile?.skillWeight ?? 40,
      interestWeight: profile?.interestWeight ?? 30,
      locationWeight: profile?.locationWeight ?? 20,
      salaryWeight: profile?.salaryWeight ?? 10,
    };
  }, [profile, localProfile]);

  const hasData = merged.skills.length > 0 || merged.jobTitles.length > 0 || merged.location || merged.education.length > 0;
  const initials = getInitials(merged.jobTitles[0] || merged.location || merged.summary);
  const levelLabel = merged.experienceLevel ? t(getLocaleLevelKey(merged.experienceLevel)) : null;

  // Enter edit mode — populate form from current data
  const enterEditMode = () => {
    setEditSkills(merged.skills.join(', '));
    setEditLocation(merged.location || '');
    setEditMinSalary(merged.minSalary?.toString() || '');
    setEditMaxSalary(merged.maxSalary?.toString() || '');
    setEditRemoteOnly(merged.remoteOnly);
    setEditExperienceLevel(merged.experienceLevel || '');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const saveEdit = async () => {
    setIsSaving(true);
    try {
      await updateProfile.mutateAsync({
        userId: DEFAULT_USER_ID,
        skills: editSkills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        location: editLocation,
        remoteOnly: editRemoteOnly,
        minSalary: editMinSalary ? Number(editMinSalary) : undefined,
        maxSalary: editMaxSalary ? Number(editMaxSalary) : undefined,
        experienceLevel: editExperienceLevel || undefined,
      });
      showToast('success', t('settings.saved'));
      setIsEditing(false);
      refetch();
    } catch {
      showToast('error', t('settings.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading state ──
  if (isLoading) {
    return <LoadingProfileState />;
  }

  // ── Empty state ──
  if (!hasData) {
    return <EmptyProfileState t={t} />;
  }

  // ── Main profile display ──
  return (
    <motion.div className="space-y-5 sm:space-y-6" variants={container} initial="hidden" animate="show">
      {/* ── Header — no card wrapper, clean section ── */}
      <motion.div variants={fadeUp}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <ProfileAvatar initials={initials} />
            <div className="pt-0.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                  {t('profile.title')}
                </h2>
                {merged.experienceLevel && LEVEL_STYLE[merged.experienceLevel] && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${LEVEL_STYLE[merged.experienceLevel]}`}>
                    {levelLabel}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {t('profile.subtitle')}
              </p>
              {merged.updatedAt && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1.5">
                  <Clock size={10} />
                  {t('profile.lastUpdated')}: {formatDateRelative(merged.updatedAt ?? new Date(), locale)}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={cancelEdit} disabled={isSaving}>
                  <X size={13} />
                  {t('common.cancel')}
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={isSaving}>
                  {isSaving ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} />
                  )}
                  {isSaving ? t('common.saving') : t('common.save')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
                  <RefreshCw size={13} className={isRefetching ? 'animate-spin' : ''} />
                  {t('dashboard.refresh')}
                </Button>
                <Button size="sm" variant="secondary" onClick={enterEditMode}>
                  <SquarePen size={13} />
                  {t('common.edit')}
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Compact Stats Row ── */}
      <CompactStatRow>
        {isEditing && editLocation !== undefined ? (
          <motion.div variants={fadeUp} className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
              <MapPin size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('profile.location')}</p>
              <Input
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder={t('setup.profile.locationPlaceholder')}
                className="h-8 text-sm mt-1"
              />
            </div>
          </motion.div>
        ) : (
          <CompactStatItem
            icon={<MapPin size={15} />}
            label={t('profile.location')}
            value={merged.location}
          />
        )}

        {isEditing ? (
          <motion.div variants={fadeUp} className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
              <Briefcase size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('profile.experienceLevel')}</p>
              <select
                value={editExperienceLevel}
                onChange={(e) => setEditExperienceLevel(e.target.value)}
                className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-surface px-2 text-sm dark:border-slate-600 dark:bg-dark-surface-secondary dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">—</option>
                <option value="junior">{t('settings.profile.junior')}</option>
                <option value="mid">{t('settings.profile.mid')}</option>
                <option value="senior">{t('settings.profile.senior')}</option>
                <option value="lead">{t('settings.profile.lead')}</option>
              </select>
            </div>
          </motion.div>
        ) : (
          <CompactStatItem
            icon={<Briefcase size={15} />}
            label={t('profile.experienceLevel')}
            value={levelLabel}
          />
        )}

        {isEditing ? (
          <motion.div variants={fadeUp} className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
              <DollarSign size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('profile.salaryRange')}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Input
                  type="number"
                  value={editMinSalary}
                  onChange={(e) => setEditMinSalary(e.target.value)}
                  placeholder="min"
                  className="h-8 text-sm w-full"
                />
                <span className="text-slate-400 text-xs">–</span>
                <Input
                  type="number"
                  value={editMaxSalary}
                  onChange={(e) => setEditMaxSalary(e.target.value)}
                  placeholder="max"
                  className="h-8 text-sm w-full"
                />
              </div>
            </div>
          </motion.div>
        ) : (
          <CompactStatItem
            icon={<DollarSign size={15} />}
            label={t('profile.salaryRange')}
            value={formatSalary(merged.minSalary, merged.maxSalary)}
          />
        )}

        {isEditing ? (
          <motion.div variants={fadeUp} className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
              <Globe size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('profile.remote')}</p>
              <label className="relative inline-flex cursor-pointer items-center mt-2">
                <input
                  type="checkbox"
                  checked={editRemoteOnly}
                  onChange={(e) => setEditRemoteOnly(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="h-5 w-9 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full dark:bg-slate-600" />
              </label>
            </div>
          </motion.div>
        ) : (
          <CompactStatItem
            icon={<Globe size={15} />}
            label={t('profile.remote')}
            value={merged.remoteOnly ? t('profile.remoteYes') : t('profile.remoteNo')}
          />
        )}
      </CompactStatRow>

      {/* ── Skills + Summary — side by side ── */}
      <div className="grid gap-4 sm:gap-6 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
        {/* Skills — tag cloud as hero */}

        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench size={15} className="text-primary" />
                {t('profile.skills')}
                <span className="ml-auto text-[11px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
                  {isEditing ? '' : merged.skills.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={editSkills}
                    onChange={(e) => setEditSkills(e.target.value)}
                    placeholder={t('settings.profile.skillsPlaceholder')}
                  />
                  {editSkills.split(',').map(s => s.trim()).filter(Boolean).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {editSkills.split(',').map(s => s.trim()).filter(Boolean).map((skill, i) => (
                        <span key={i} className="inline-flex items-center rounded-md bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-dark dark:bg-primary-50/10 dark:text-primary-light">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : merged.skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {merged.skills.map((skill, i) => (
                    <SkillBadge key={`${skill}-${i}`} skill={skill} index={i} />
                  ))}
                </div>
              ) : (
                <EmptySkills t={t} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Summary */}
        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText size={15} className="text-amber-500" />
                {t('profile.summary')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {merged.summary ? (
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-[12]">
                  {merged.summary}
                </p>
              ) : (
                <EmptySummary t={t} />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Target Roles + Industries + Languages — auto-fit grid ── */}
      <div className="grid gap-4 sm:gap-6 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        {/* Target Roles — always visible */}
        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target size={15} className="text-blue-500" />
                {t('profile.jobTitles')}
                <span className="ml-auto text-[11px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
                  {merged.jobTitles.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {merged.jobTitles.length > 0 ? (
                merged.jobTitles.map((title, i) => (
                  <motion.div
                    key={title}
                    variants={slideIn}
                    custom={i}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-150"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-900/20">
                      <Target size={10} className="text-blue-500" />
                    </div>
                    <span className="text-sm text-slate-700 dark:text-slate-300">{title}</span>
                  </motion.div>
                ))
              ) : (
                <EmptyJobTitles t={t} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Industries — always visible */}
        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase size={15} className="text-violet-500" />
                {t('profile.industries')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {merged.industries.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {merged.industries.map((ind, i) => (
                    <motion.span key={ind} variants={scaleBadge} custom={i}>
                      <Badge variant="outline" className="text-[11px]">
                        {ind}
                      </Badge>
                    </motion.span>
                  ))}
                </div>
              ) : (
                <EmptyIndustries t={t} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Languages */}
        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe size={15} className="text-emerald-500" />
                {t('profile.languages')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {merged.languages.length > 0 ? (
                merged.languages.map((lang, i) => (
                  <LangRow
                    key={`${lang.language}-${i}`}
                    language={lang.language}
                    level={lang.level}
                    index={i}
                  />
                ))
              ) : (
                <EmptyLanguages t={t} />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Education ── */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap size={15} className="text-indigo-500" />
              {t('profile.education')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {merged.education.length > 0 ? (
              <div className="space-y-3">
                {merged.education.map((edu, i) => (
                  <motion.div
                    key={`${edu.degree}-${edu.institution}-${i}`}
                    variants={slideIn}
                    custom={i}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/30">
                      <GraduationCap size={14} className="text-indigo-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {edu.degree}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {edu.institution}
                        {edu.graduationYear && (
                          <span className="ml-2 text-slate-400 dark:text-slate-500">
                            · {edu.graduationYear}
                          </span>
                        )}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyEducation t={t} />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Interests ── */}
      {merged.interests.length > 0 && (
        <motion.div variants={fadeUp}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star size={15} className="text-pink-500" />
                {t('profile.interests')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {merged.interests.map((interest, i) => (
                  <motion.span key={interest} variants={scaleBadge} custom={i}>
                    <Badge variant="outline" className="text-[11px] border-pink-200 text-pink-700 dark:border-pink-800 dark:text-pink-300">
                      {interest}
                    </Badge>
                  </motion.span>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Matching Weights — compact, not a full card ── */}
      <motion.div variants={fadeUp}>
        <div className="rounded-xl border bg-surface p-5 sm:p-6 dark:bg-dark-surface-secondary dark:border-slate-700/50">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={15} className="text-purple-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('profile.matchingWeights')}
            </h3>
          </div>
          {/* Separate staggered container so each bar grows in sequence */}
          <motion.div
            className="space-y-3"
            variants={{
              hidden: {},
              show: {
                transition: { staggerChildren: 0.12, delayChildren: 0.15 },
              },
            }}
          >
            <WeightBar label={t('profile.skills')} value={merged.skillWeight} barColor="bg-gradient-to-r from-blue-400 to-blue-500" index={0} />
            <WeightBar label={t('profile.interests')} value={merged.interestWeight} barColor="bg-gradient-to-r from-emerald-400 to-emerald-500" index={1} />
            <WeightBar label={t('profile.location')} value={merged.locationWeight} barColor="bg-gradient-to-r from-amber-400 to-amber-500" index={2} />
            <WeightBar label={t('profile.salaryName')} value={merged.salaryWeight} barColor="bg-gradient-to-r from-violet-400 to-violet-500" index={3} />
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
