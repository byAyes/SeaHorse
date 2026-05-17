"use client";

import { motion } from "framer-motion";
import { ExternalLink, MapPin, DollarSign, Briefcase } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge, ScoreBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatSalary } from "@/lib/utils";
import type { MatchedJob } from "@/types/job-match";

interface RecentMatchesProps {
  data?: MatchedJob[];
  isLoading?: boolean;
}

export function RecentMatches({ data, isLoading }: RecentMatchesProps) {
  const matches = data?.slice(0, 5) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase size={16} />
          Matches Recientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
              <Briefcase size={22} className="text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              No hay matches aún
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
              Sube un CV o ejecuta el pipeline para ver resultados aquí
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map((match, index) => (
              <motion.a
                key={match.job.id}
                href={match.job.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="group flex items-start gap-3 rounded-xl p-3 -mx-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
              >
                {/* Company initial avatar */}
                <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-500 dark:text-slate-400">
                  {match.job.company?.charAt(0)?.toUpperCase() || "?"}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {match.job.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {match.job.company}
                    {match.job.location && (
                      <span className="inline-flex items-center gap-0.5 ml-2">
                        <MapPin size={10} />
                        {match.job.location}
                      </span>
                    )}
                    {match.job.salary && (
                      <span className="inline-flex items-center gap-0.5 ml-2">
                        <DollarSign size={10} />
                        {formatSalary(match.job.salary)}
                      </span>
                    )}
                  </p>
                  {/* Skills tags */}
                  {match.job.skills && match.job.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {match.job.skills.slice(0, 3).map((skill, i) => (
                        <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0">
                          {skill}
                        </Badge>
                      ))}
                      {match.job.skills.length > 3 && (
                        <span className="text-[9px] text-slate-400 self-center">
                          +{match.job.skills.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <ScoreBadge score={match.score.overall} showIcon={false} />
                  <span className="text-[10px] text-slate-400">
                    {formatDate(match.job.scrapedAt)}
                  </span>
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
