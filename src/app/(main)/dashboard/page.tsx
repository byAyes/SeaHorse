'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  PlayCircle,
  RefreshCw,
  TrendingUp,
  Clock,
  Sparkles,
  FileText,
  BarChart3,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { JobsChart } from '@/components/dashboard/jobs-chart';
import { RecentMatches } from '@/components/dashboard/recent-matches';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, ScoreBadge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useStats } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

const quickActions = [
  {
    labelKey: 'dashboard.actions.uploadCv',
    href: '/upload',
    icon: <Upload size={16} />,
    descKey: 'dashboard.actions.uploadCvDesc',
    color: 'from-blue-500 to-blue-600',
    lightColor: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
  },
  {
    labelKey: 'dashboard.actions.runPipeline',
    href: '/pipeline',
    icon: <PlayCircle size={16} />,
    descKey: 'dashboard.actions.runPipelineDesc',
    color: 'from-emerald-500 to-emerald-600',
    lightColor: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  },
  {
    labelKey: 'dashboard.actions.viewJobs',
    href: '/jobs',
    icon: <BarChart3 size={16} />,
    descKey: 'dashboard.actions.viewJobsDesc',
    color: 'from-amber-500 to-amber-600',
    lightColor: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  },
  {
    labelKey: 'dashboard.actions.configure',
    href: '/settings',
    icon: <FileText size={16} />,
    descKey: 'dashboard.actions.configureDesc',
    color: 'from-violet-500 to-violet-600',
    lightColor: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
  },
];

export default function DashboardPage() {
  const { data: stats, isLoading, refetch, isRefetching } = useStats();
  const { t } = useTranslation();
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const handleRefresh = useCallback(() => {
    refetch();
    setLastRefreshed(new Date());
  }, [refetch]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-primary shrink-0" />
            <span className="truncate">Dashboard</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('dashboard.subtitle')}
          </p>
          {lastRefreshed && (
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <Clock size={10} />
              Última actualización: {lastRefreshed.toLocaleTimeString('es-ES')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefetching}>
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />{' '}
            {isRefetching ? t('dashboard.refreshing') : t('dashboard.refresh')}
          </Button>
          <Link href="/upload">
            <Button size="sm">
              <Upload size={14} />
              {t('dashboard.uploadCv')}
            </Button>
          </Link>
          <Link href="/pipeline" className="hidden sm:inline-flex">
            <Button size="sm" variant="secondary">
              <PlayCircle size={14} />
              {t('dashboard.runPipeline')}
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {quickActions.map((action, i) => (
          <Link key={action.labelKey} href={action.href}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="group flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 sm:p-3 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
            >
              <div
                className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl shrink-0 ${action.lightColor}`}
              >
                {action.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{t(action.labelKey)}</p>
                <p className="text-xs text-slate-400 truncate">{t(action.descKey)}</p>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Stats Grid */}
      <StatsGrid
        data={
          stats
            ? {
                totalJobs: stats.totalJobs,
                totalJobsToday: stats.totalJobsToday,
                totalMatches: stats.totalMatches,
                totalProfiles: stats.totalProfiles,
                pipelinesRun: stats.pipelinesRun,
                jobTrend: stats.jobTrend,
              }
            : undefined
        }
        isLoading={isLoading}
      />

      {/* Chart + Recent */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <JobsChart data={stats?.jobsByDay} isLoading={isLoading} trend={stats?.jobTrend} />
        <RecentMatches data={stats?.recentMatches} isLoading={isLoading} />
      </div>

      {/* Bottom Row: Top Skills + Last Pipeline Run */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Top Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp size={15} />
              {t('dashboard.topSkills')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-20 sm:w-24" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-6 sm:w-8" />
                  </div>
                ))}
              </div>
            ) : !stats?.topSkills || stats.topSkills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
                  <Zap size={18} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-500">{t('dashboard.noSkills')}</p>
                <p className="text-xs text-slate-400 mt-1">{t('dashboard.noSkillsDesc')}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {stats.topSkills.slice(0, 8).map((skill, i) => {
                  const maxCount = Math.max(...stats.topSkills.map((s) => s.count));
                  const barWidth = maxCount > 0 ? Math.max(8, (skill.count / maxCount) * 100) : 0;
                  return (
                    <div key={skill.skill} className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-600 dark:text-slate-400 w-20 sm:w-24 truncate text-right flex-shrink-0">
                        {skill.skill}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{
                            delay: i * 0.05,
                            duration: 0.6,
                            ease: 'easeOut',
                          }}
                          className={`h-full rounded-full ${
                            i === 0
                              ? 'bg-primary'
                              : i < 3
                                ? 'bg-blue-400'
                                : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        />
                      </div>
                      <span className="text-[11px] text-slate-400 w-6 text-right flex-shrink-0">
                        {skill.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last Pipeline Run */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <PlayCircle size={15} />
              {t('dashboard.lastRun')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-40 sm:w-48" />
                <Skeleton className="h-4 w-48 sm:w-64" />
              </div>
            ) : stats?.lastPipelineRun ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {formatDate(stats.lastPipelineRun.startedAt)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(stats.lastPipelineRun.startedAt).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={stats.lastPipelineRun.status === 'completed' ? 'success' : 'danger'}
                    className="gap-1"
                  >
                    {stats.lastPipelineRun.status === 'completed' ? (
                      <>
                        <BarChart3 size={11} /> {t('dashboard.successful')}
                      </>
                    ) : (
                      <>
                        <BarChart3 size={11} /> {t('dashboard.error')}
                      </>
                    )}
                  </Badge>
                  {stats.lastPipelineRun.error && (
                    <span className="text-xs text-red-500 truncate max-w-[120px] sm:max-w-none">
                      {stats.lastPipelineRun.error}
                    </span>
                  )}
                  <ScoreBadge score={stats.lastPipelineRun.matched} />
                  <Badge variant="outline" className="gap-1">
                    <PlayCircle size={11} />
                    {stats.lastPipelineRun.scraped} {t('dashboard.scraped')}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <BarChart3 size={11} />
                    {stats.totalJobs} {t('dashboard.jobs30d')}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                  <PlayCircle size={20} className="text-slate-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-500">{t('dashboard.noRuns')}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.noRunsDesc')}</p>
                </div>
                <Link href="/pipeline" className="sm:ml-auto w-full sm:w-auto">
                  <Button size="sm" className="w-full sm:w-auto">
                    <PlayCircle size={14} />
                    {t('dashboard.execute')}
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
