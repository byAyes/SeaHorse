'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Target, PlayCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/utils';

function AnimatedNumber({ value, delay = 0 }: { value: number; delay?: number }) {
  const [displayed, setDisplayed] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current || value === 0) {
      setDisplayed(value);
      return;
    }
    hasAnimated.current = true;
    // Scale duration proportionally to value magnitude for smooth counting
    const duration = Math.min(400 + value * 0.1, 2000);
    const startTime = Date.now() + delay * 1000;
    const targetValue = value;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed <= 0) {
        requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * targetValue));
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, [value, delay]);

  return <>{formatNumber(displayed)}</>;
}

const statsConfig = [
  {
    title: 'Total Jobs',
    icon: <Briefcase size={20} />,
    subtitle: 'Últimos 30 días',
    color: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    key: 'totalJobs' as const,
  },
  {
    title: 'Jobs Hoy',
    icon: <TrendingUp size={20} />,
    subtitle: 'Scrapeados hoy',
    color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    key: 'totalJobsToday' as const,
  },
  {
    title: 'Matches',
    icon: <Target size={20} />,
    subtitle: 'Encontrados',
    color: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    key: 'totalMatches' as const,
  },
  {
    title: 'Pipelines',
    icon: <PlayCircle size={20} />,
    subtitle: 'Ejecutados',
    color: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
    key: 'pipelinesRun' as const,
  },
];

interface StatsGridProps {
  data?: {
    totalJobs: number;
    totalJobsToday: number;
    totalMatches: number;
    totalProfiles: number;
    pipelinesRun: number;
    jobTrend?: number;
  };
  isLoading?: boolean;
}

export function StatsGrid({ data, isLoading }: StatsGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statsConfig.map((stat, index) => {
        const value = data ? (((data as Record<string, unknown>)[stat.key] as number) ?? 0) : 0;
        return (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: index * 0.1,
              duration: 0.4,
              ease: 'easeOut',
            }}
          >
            <Card hover>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {stat.title}
                  </span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <motion.span
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: index * 0.1 + 0.2,
                        type: 'spring',
                        stiffness: 200,
                      }}
                      className="text-3xl font-bold tracking-tight tabular-nums"
                    >
                      <AnimatedNumber value={value} delay={index * 0.1 + 0.2} />
                    </motion.span>
                    {/* Trend indicator for totalJobs */}
                    {stat.key === 'totalJobs' &&
                      data?.jobTrend !== undefined &&
                      data.jobTrend !== 0 && (
                        <span
                          className={`text-xs font-medium flex items-center gap-0.5 ${
                            data.jobTrend > 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {data.jobTrend > 0 ? (
                            <TrendingUp size={12} />
                          ) : (
                            <TrendingDown size={12} />
                          )}
                          {Math.abs(data.jobTrend)}%
                        </span>
                      )}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{stat.subtitle}</p>
                </div>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}
                >
                  {stat.icon}
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
