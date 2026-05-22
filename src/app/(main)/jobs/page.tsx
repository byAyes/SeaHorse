'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  ArrowUpDown,
  ExternalLink,
  MapPin,
  DollarSign,
  Calendar,
  Building2,
  SlidersHorizontal,
  Briefcase,
  Upload,
  PlayCircle,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, ScoreBadge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatDate, formatSalary } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { useMatchJobs } from '@/lib/api-client';
import type { MatchedJob } from '@/types/job-match';

type SortKey = 'score' | 'title' | 'company' | 'salary' | 'date';
type SortDir = 'asc' | 'desc';

export default function JobsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useMatchJobs();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedJob, setSelectedJob] = useState<MatchedJob | null>(null);
  const [scoreFilter, setScoreFilter] = useState<number>(0);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    if (!data?.matches) return [];
    let items = [...data.matches];

    // Search
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (m) =>
          m.job.title.toLowerCase().includes(q) ||
          m.job.company.toLowerCase().includes(q) ||
          (m.job.location || '').toLowerCase().includes(q) ||
          (m.job.description || '').toLowerCase().includes(q),
      );
    }

    // Score filter
    if (scoreFilter > 0) {
      items = items.filter((m) => m.score.overall >= scoreFilter);
    }

    // Sort
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'score':
          cmp = a.score.overall - b.score.overall;
          break;
        case 'title':
          cmp = a.job.title.localeCompare(b.job.title);
          break;
        case 'company':
          cmp = a.job.company.localeCompare(b.job.company);
          break;
        case 'salary':
          cmp = (a.job.salary || 0) - (b.job.salary || 0);
          break;
        case 'date':
          cmp = new Date(a.job.scrapedAt).getTime() - new Date(b.job.scrapedAt).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return items;
  }, [data, search, sortKey, sortDir, scoreFilter]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl font-semibold">{t('jobs.title')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {data?.total || 0} {t('jobs.evaluated')} — {filtered.length} {t('jobs.matches')}
        </p>
      </motion.div>

      {/* Filters — lightweight, no card wrapper */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-dark-surface-secondary p-4">
        <div className="relative w-full sm:flex-1 min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('jobs.search')}
            className="pl-9 w-full"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          <SlidersHorizontal size={14} className="text-slate-400 shrink-0" />
          {[0, 40, 60, 80].map((v) => (
            <motion.button
              key={v}
              onClick={() => setScoreFilter(v)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              animate={{
                scale: scoreFilter === v ? 1.05 : 1,
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              className={`rounded-full px-2.5 sm:px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                scoreFilter === v
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-dark-surface-tertiary dark:text-slate-400'
              }`}
            >
              {v === 0 ? t('jobs.score.all') : `${v}%+`}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <TableSkeleton rows={6} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-dark-surface-tertiary mb-4">
                {search ? (
                  <Search size={24} className="text-slate-400" />
                ) : (
                  <Briefcase size={24} className="text-slate-400" />
                )}
              </div>
              <p className="text-sm font-medium text-slate-500">
                {search ? t('jobs.noResults') : t('jobs.noData')}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
                {search ? t('jobs.noResultsDesc') : t('jobs.noDataDesc')}
              </p>
              {!search && !data?.total && (
                <div className="flex gap-2 mt-4">
                  <Link href="/upload">
                    <Button size="sm" variant="outline">
                      <Upload size={14} />
                      {t('dashboard.actions.uploadCv')}
                    </Button>
                  </Link>
                  <Link href="/pipeline">
                    <Button size="sm">
                      <PlayCircle size={14} />
                      {t('dashboard.actions.runPipeline')}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-slate-800">
                    {[
                      {
                        label: t('jobs.table.title'),
                        sortable: true as const,
                        sortKey: 'title' as SortKey,
                        hideMobile: false,
                      },
                      {
                        label: t('jobs.table.company'),
                        sortable: true as const,
                        sortKey: 'company' as SortKey,
                        hideMobile: false,
                      },
                      {
                        label: t('jobs.table.location'),
                        sortable: false as const,
                        sortKey: undefined,
                        hideMobile: true,
                      },
                      {
                        label: t('jobs.table.score'),
                        sortable: true as const,
                        sortKey: 'score' as SortKey,
                        hideMobile: false,
                      },
                      {
                        label: t('jobs.table.salary'),
                        sortable: true as const,
                        sortKey: 'salary' as SortKey,
                        hideMobile: true,
                      },
                      {
                        label: t('jobs.table.date'),
                        sortable: true as const,
                        sortKey: 'date' as SortKey,
                        hideMobile: true,
                      },
                    ].map((col) => (
                      <th
                        key={col.label}
                        onClick={col.sortable ? () => toggleSort(col.sortKey!) : undefined}
                        className={`px-4 py-3 text-left text-xs font-medium text-slate-500 ${col.sortable ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-300' : ''} ${col.hideMobile ? 'hidden sm:table-cell' : ''}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {col.sortable && <ArrowUpDown size={12} />}
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((match, i) => (
                    <motion.tr
                      key={match.job.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.025, type: 'spring', stiffness: 200, damping: 20 }}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-dark-surface-tertiary/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedJob(match)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[140px] sm:max-w-[200px]">
                          {match.job.title}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1">
                          <Building2 size={12} />
                          {match.job.company}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                        {match.job.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={12} />
                            {match.job.location}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={match.score.overall} />
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                        {match.job.salary ? formatSalary(match.job.salary) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(match.job.scrapedAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(match.job.url, '_blank');
                          }}
                        >
                          <ExternalLink size={14} />
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Detail Modal */}
      <Modal
        open={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        title={selectedJob?.job.title}
        description={selectedJob?.job.company}
        size="lg"
      >
        {selectedJob && (
          <div className="space-y-5">
            {/* Score Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: t('jobs.modal.skills'), value: selectedJob.score.skillMatch },
                { label: t('jobs.modal.interests'), value: selectedJob.score.interestMatch },
                { label: t('jobs.modal.location'), value: selectedJob.score.locationMatch },
                { label: t('jobs.modal.salary'), value: selectedJob.score.salaryMatch },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05, type: 'spring', stiffness: 200 }}
                  className="rounded-lg bg-slate-50 p-3 dark:bg-dark-surface-tertiary"
                >
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {Math.round(item.value)}%
                  </p>
                  <motion.div
                    className="mt-1 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${item.value}%` }}
                      transition={{ delay: 0.2 + i * 0.05, duration: 0.6, ease: 'easeOut' }}
                    />
                  </motion.div>
                </motion.div>
              ))}
            </div>

            {/* Matched Skills */}
            {selectedJob.score.matchedSkills.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">
                  {t('jobs.modal.matchedSkills')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedJob.score.matchedSkills.map((skill) => (
                    <Badge key={skill} variant="success">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Location & Salary */}
            <div className="flex gap-4 text-sm">
              {selectedJob.job.location && (
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                  <MapPin size={14} />
                  {selectedJob.job.location}
                </span>
              )}
              {selectedJob.job.salary && (
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                  <DollarSign size={14} />
                  {formatSalary(selectedJob.job.salary)}
                </span>
              )}
            </div>

            {/* Description */}
            {selectedJob.job.description && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">
                  {t('jobs.modal.jobDescription')}
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedJob.job.description}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button onClick={() => window.open(selectedJob.job.url, '_blank')} className="flex-1">
                <ExternalLink size={14} />
                {t('jobs.modal.viewJob')}
              </Button>
              <Button variant="outline" onClick={() => setSelectedJob(null)}>
                {t('jobs.modal.close')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
