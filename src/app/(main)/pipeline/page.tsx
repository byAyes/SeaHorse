"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlayCircle,
  CheckCircle2,
  Circle,
  Terminal,
  RefreshCw,
  Loader2,
  BarChart3,
  Send,
  Search,
  AlertTriangle,
  ExternalLink,
  Settings,
  Shield,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import {
  useRunPipeline,
  usePipelineStatus,
  useStats,
} from "@/lib/api-client";
import type { PipelineRunStatus } from "@/lib/api-client";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

type StepStatus = "pending" | "running" | "done" | "error";

interface PipelineStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: StepStatus;
}

const initialSteps: PipelineStep[] = [
  {
    id: "scrape",
    label: "Scraping",
    description: "Searching jobs from multiple sources",
    icon: <Search size={16} />,
    status: "pending",
  },
  {
    id: "match",
    label: "Matching",
    description: "Evaluating matches against your profile",
    icon: <BarChart3 size={16} />,
    status: "pending",
  },
  {
    id: "email",
    label: "Completion",
    description: "Processing results and cleaning data",
    icon: <Send size={16} />,
    status: "pending",
  },
];

const stepKeywords: Record<string, RegExp[]> = {
  scrape: [
    /[Ss]crap(ing|e[dr]?)/,
    /[Jj]obs?\s*(encontrados|scraped|recibidos)/,
    /[Bb]uscando/,
    /[Ss]craper/,
    /[Jj]obs?\s*convertidos/,
    /[Gg]uardando/,
    /[Gg]uardados/,
    /[Ll]imp(iando|eza)/,
  ],
  match: [
    /[Mm]atch(ing|e[ad]?[ds]?)/,
    /[Ss]core/,
    /[Pp]erfil/,
    /[Ee]valuando/,
    /[Ee]xcelentes/,
    /[Bb]uenos/,
    /[Pp]otenciales/,
  ],
  email: [
    /[Ee]mail/,
    /[Ee]nviando/,
    /[Dd]igest/,
    /[Cc]ompletado/,
    /[Ll]impieza/,
    /[Ll]impios/,
    /✅/,
    /❌/,
  ],
};

function inferStepFromLog(log: string): string | null {
  for (const [stepId, patterns] of Object.entries(stepKeywords)) {
    if (patterns.some((p) => p.test(log))) {
      return stepId;
    }
  }
  return null;
}

export default function PipelinePage() {
  const { t } = useTranslation();
  const { data: stats, isLoading: statsLoading } = useStats();
  const runPipelineMutation = useRunPipeline();
  const [runId, setRunId] = useState<string | null>(null);
  const { data: pipelineStatus, isLoading: statusLoading } =
    usePipelineStatus(runId);

  const [steps, setSteps] = useState<PipelineStep[]>(initialSteps);
  const [displayedLogs, setDisplayedLogs] = useState<string[]>([
    `⚡ ${t("pipeline.logs.ready")} ${t("pipeline.logs.configureKey")}`,
  ]);

  // Check if any AI API key is configured
  const [hasAiKey, setHasAiKey] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const gemini = localStorage.getItem("GEMINI_API_KEY");
    const openrouter = localStorage.getItem("OPENROUTER_API_KEY");
    const nim = localStorage.getItem("NIM_API_KEY");
    setHasAiKey(!!(gemini || openrouter || nim));
  }, []);

  const isRunning = pipelineStatus?.status === "running";
  const isCompleted = pipelineStatus?.status === "completed";
  const isError = pipelineStatus?.status === "error";
  const isIdle = !runId;

  // Compute translated step labels/descriptions
  const stepLabels: Record<string, { label: string; desc: string }> = useMemo(
    () => ({
      scrape: { label: t("pipeline.steps.scraping"), desc: t("pipeline.steps.scrapingDesc") },
      match: { label: t("pipeline.steps.matching"), desc: t("pipeline.steps.matchingDesc") },
      email: { label: t("pipeline.steps.completion"), desc: t("pipeline.steps.completionDesc") },
    }),
    [t],
  );

  // Update steps based on pipeline logs
  useEffect(() => {
    if (!pipelineStatus?.logs) return;

    const logs = pipelineStatus.logs;
    setDisplayedLogs(logs);

    // Determine which steps are active based on log content
    const activeSteps = new Set<string>();
    let latestStep: string | null = "scrape";

    for (const log of logs) {
      const step = inferStepFromLog(log);
      if (step) {
        activeSteps.add(step);
        latestStep = step;
      }
    }

    // Determine completion status based on pipeline status
    const isRunningPipeline = pipelineStatus.status === "running";
    const isCompletedPipeline = pipelineStatus.status === "completed";
    const isErrorPipeline = pipelineStatus.status === "error";

    setSteps((prev) =>
      prev.map((s, idx) => {
        const stepIds = ["scrape", "match", "email"];
        const stepIndex = stepIds.indexOf(s.id);
        const latestIndex = stepIds.indexOf(latestStep || "scrape");

        if (isErrorPipeline) {
          const isCurrentOrPast = stepIndex <= latestIndex;
          return {
            ...s,
            status: isCurrentOrPast ? ("error" as StepStatus) : ("pending" as StepStatus),
          };
        }

        if (isCompletedPipeline) {
          return { ...s, status: "done" as StepStatus };
        }

        if (isRunningPipeline) {
          if (stepIndex < latestIndex) {
            return { ...s, status: "done" as StepStatus };
          }
          if (stepIndex === latestIndex) {
            return { ...s, status: "running" as StepStatus };
          }
          return { ...s, status: "pending" as StepStatus };
        }

        return s;
      })
    );
  }, [pipelineStatus?.logs, pipelineStatus?.status]);

  const runPipeline = useCallback(async () => {
    setDisplayedLogs([`🚀 ${t("pipeline.running")}`]);
    setSteps(initialSteps.map((s) => ({ ...s, status: "pending" })));

    try {
      const result = await runPipelineMutation.mutateAsync(undefined);
      setRunId(result.runId);
    } catch (err) {
      setDisplayedLogs((prev) => [
        ...prev,
        `❌ ${t("common.error")}: ${err instanceof Error ? err.message : t("pipeline.results.failed")}`,
      ]);
      setSteps((prev) => prev.map((s) => ({ ...s, status: "error" as StepStatus })));
    }
  }, [runPipelineMutation, t]);

  const resetPipeline = useCallback(() => {
    setRunId(null);
    setSteps(initialSteps.map((s) => ({ ...s, status: "pending" })));
    setDisplayedLogs([`⚡ ${t("pipeline.logs.ready")}`]);
  }, [t]);

  const statusIcon = (status: StepStatus) => {
    switch (status) {
      case "done":
        return <CheckCircle2 size={20} className="text-emerald-500" />;
      case "running":
        return (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Loader2 size={20} className="text-primary animate-spin" />
          </motion.div>
        );
      case "error":
        return <AlertTriangle size={20} className="text-rose-500" />;
      default:
        return <Circle size={20} className="text-slate-300 dark:text-slate-600" />;
    }
  };

  const result = pipelineStatus?.result;
  const topMatches = result?.matches?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-xl font-semibold">{t("pipeline.title")}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("pipeline.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetPipeline} disabled={isRunning}>
            <RefreshCw size={14} />
            {t("pipeline.reset")}
          </Button>
          <Button
            onClick={runPipeline}
            disabled={isRunning || runPipelineMutation.isPending || hasAiKey === false}
            size="lg"
            title={hasAiKey === false ? t("pipeline.apiKeyRequiredDesc") : undefined}
          >
            {runPipelineMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t("pipeline.starting")}
              </>
            ) : isRunning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t("pipeline.running")}
              </>
            ) : (
              <>
                <PlayCircle size={16} />
                {t("pipeline.run")}
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {/* AI Key Warning Banner */}
      {hasAiKey === false && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
            <CardContent className="pt-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-800/40 flex-shrink-0">
                  <Shield size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    {t("pipeline.apiKeyRequired")}
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    {t("pipeline.apiKeyRequiredDesc")}
                  </p>
                  <div className="mt-3 flex gap-3">
                    <Link href="/settings">
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                        <Settings size={14} />
                        {t("pipeline.goToSettings")}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Steps + Summary */}
        <div className="lg:col-span-2 space-y-4">
          {/* Steps Progress */}
          <Card>
            <CardHeader>
              <CardTitle>{t("pipeline.progress")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {steps.map((step, i) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08, type: "spring", stiffness: 200 }}
                    className="relative flex gap-4 pb-8 last:pb-0"
                  >
                    {i < steps.length - 1 && (
                      <motion.div
                        className="absolute left-[10px] top-8 h-full w-px bg-slate-200 dark:bg-slate-700"
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: i * 0.08 + 0.2, duration: 0.3 }}
                        style={{ originY: 0 }}
                      />
                    )}
                    <div className="relative z-10 flex-shrink-0 bg-surface dark:bg-dark-surface-secondary">
                      {statusIcon(step.status)}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm font-medium">
                        {stepLabels[step.id]?.label || step.label}
                      </p>
                      {step.status === "running" ? (
                        <motion.p
                          className="text-xs text-slate-500 mt-0.5"
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                          {stepLabels[step.id]?.desc || step.description}
                        </motion.p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {step.status === "done"
                            ? t("pipeline.status.completed")
                            : step.status === "error"
                              ? t("pipeline.status.error")
                              : t("pipeline.status.pending")}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Results Summary */}
          {isCompleted && result && (
            <Card>
              <CardHeader>
                <CardTitle>{t("pipeline.results.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: t("pipeline.results.jobsScraped"), value: result.scraped, color: "text-primary" },
                    { label: t("pipeline.results.matchScores"), value: result.matched, color: "text-emerald-500" },
                    { label: t("pipeline.results.savedInDb"), value: result.saved, color: "text-amber-500" },
                    { label: t("pipeline.results.jobsCleaned"), value: result.cleaned, color: "text-slate-500" },
                  ].map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 200 }}
                      className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 text-center"
                    >
                      <motion.p
                        className={`text-2xl font-bold ${item.color} tabular-nums`}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.08 }}
                      >
                        {item.value}
                      </motion.p>
                      <p className="text-xs text-slate-500">{item.label}</p>
                    </motion.div>
                  ))}
                </div>

                {result.errors.length > 0 && (
                  <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 p-3">
                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-1">
                      {t("pipeline.results.warnings")} ({result.errors.length})
                    </p>
                    {result.errors.map((err: string, i: number) => (
                      <p key={i} className="text-xs text-rose-500">
                        {err}
                      </p>
                    ))}
                  </div>
                )}

                {/* Per-scraper stats */}
                {result.scraperStats.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">{t("pipeline.results.sources")}</p>
                    <div className="space-y-1">
                      {result.scraperStats.map((s: { name: string; jobs: number; errors: number }, i: number) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-600 dark:text-slate-400">
                            {s.name}
                          </span>
                          <Badge variant={s.jobs > 0 ? "success" : "default"}>
                            {s.jobs} {t("pipeline.results.jobsFound")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Matches */}
                {topMatches.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">
                      {t("pipeline.results.topMatches")}
                    </p>
                    <div className="space-y-1">
                      {topMatches.map((m: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-md bg-slate-50 dark:bg-slate-800/50 px-3 py-2"
                        >
                          <div className="flex-1 min-w-0 mr-2">
                            <p className="text-xs font-medium truncate">
                              {m.job.title}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {m.job.company}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                m.score?.overall >= 80
                                  ? "success"
                                  : m.score?.overall >= 60
                                    ? "warning"
                                    : "default"
                              }
                            >
                              {m.score?.overall || 0}%
                            </Badge>
                            {m.job.url && (
                              <a
                                href={m.job.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-400 hover:text-primary transition-colors"
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {isError && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-rose-500">
                  <AlertTriangle size={16} />
                  {t("pipeline.status.error")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-rose-600 dark:text-rose-400">
                  {pipelineStatus.error || t("pipeline.results.failed")}
                </p>
                {pipelineStatus.result?.errors && pipelineStatus.result.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {pipelineStatus.result.errors.map((err: string, i: number) => (
                      <p key={i} className="text-xs text-rose-500">• {err}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Last Execution Summary */}
          <Card>
            <CardHeader>
              <CardTitle>{t("pipeline.results.lastExecution")}</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : stats?.lastPipelineRun ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {formatDate(stats.lastPipelineRun.startedAt)}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge>{stats.totalJobs} jobs (30d)</Badge>
                    <Badge variant="success">{stats.totalMatches} {t("pipeline.results.matched")}</Badge>
                    {stats.pipelinesRun > 0 && (
                      <Badge variant="default">{stats.pipelinesRun} pipelines</Badge>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  {t("pipeline.results.noPreviousRuns")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Log Viewer */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal size={16} />
                {t("pipeline.logs.title")}
                {isRunning && (
                  <Badge variant="default" className="ml-auto">
                    <Loader2 size={10} className="animate-spin mr-1" />
                    {t("pipeline.logs.live")}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[500px] overflow-y-auto rounded-b-[--radius-card] bg-slate-950 p-4 font-mono text-xs leading-relaxed">
                <AnimatePresence mode="popLayout">
                  {displayedLogs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`${
                        log.includes("✅")
                          ? "text-emerald-400"
                          : log.includes("❌")
                            ? "text-rose-400"
                            : log.includes("[Scraper]")
                              ? "text-sky-400"
                              : log.includes("[Matcher]")
                                ? "text-amber-400"
                                : log.includes("[Email]")
                                  ? "text-violet-400"
                                  : log.startsWith("🚀") || log.startsWith("⚡")
                                    ? "text-slate-400"
                                    : log.includes("⚠️")
                                      ? "text-yellow-400"
                                      : log === ""
                                        ? "h-2"
                                        : "text-slate-300"
                      }`}
                    >
                      {log || "\u00A0"}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
