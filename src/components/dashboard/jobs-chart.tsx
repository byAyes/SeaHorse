"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { motion } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface JobsChartProps {
  data?: Array<{ date: string; count: number }>;
  isLoading?: boolean;
  trend?: number;
}

type RangeKey = "7d" | "30d" | "90d";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "90d", label: "90 días" },
];

function filterDataByRange(
  data: Array<{ date: string; count: number }>,
  range: RangeKey
) {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return data.filter((d) => new Date(d.date) >= cutoff);
}

function formatDateLabel(dateStr: string, range: RangeKey) {
  const d = new Date(dateStr);
  if (range === "7d") {
    return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
  }
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="rounded-xl border bg-white p-3 shadow-xl dark:bg-slate-900 dark:border-slate-700"
    >
      <p className="text-xs text-slate-500 mb-1">
        {new Date(label || "").toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </p>
      <p className="text-lg font-bold text-primary">{payload[0].value} jobs</p>
    </motion.div>
  );
}

export function JobsChart({ data, isLoading, trend }: JobsChartProps) {
  const [range, setRange] = useState<RangeKey>("30d");

  const filteredData = useMemo(
    () => filterDataByRange(data || [], range),
    [data, range]
  );

  const totalInRange = filteredData.reduce((sum, d) => sum + d.count, 0);
  const avgPerDay =
    filteredData.length > 0
      ? Math.round(totalInRange / filteredData.length)
      : 0;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Tendencia de Jobs</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              ~{avgPerDay} jobs/día
            </span>
            {trend !== undefined && trend !== 0 && (
              <Badge
                variant={trend > 0 ? "success" : "danger"}
                className="text-[10px]"
              >
                {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
              </Badge>
            )}
          </div>
        </div>
        {/* Range selector */}
        <div className="flex gap-1 mt-2">
          {RANGES.map((r) => (
            <Button
              key={r.key}
              variant={range === r.key ? "default" : "ghost"}
              size="sm"
              onClick={() => setRange(r.key)}
              className="h-7 text-xs px-2.5"
            >
              {r.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-[280px] w-full rounded-lg" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
              <svg
                className="w-6 h-6 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-500">
              No hay datos de tendencia
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Los datos aparecerán después del primer scraping
            </p>
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={filteredData}
                margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="jobGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(0.928 0.006 264.531 / 0.15)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "oklch(0.606 0.036 275.724)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatDateLabel(v, range)}
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "oklch(0.606 0.036 275.724)" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={30}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "oklch(0.606 0.036 275.724 / 0.3)", strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  fill="url(#jobGradient)"
                  animationDuration={800}
                  activeDot={{
                    r: 5,
                    fill: "#4f46e5",
                    stroke: "white",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
