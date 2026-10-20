"use client";

import { Activity, Flame, Hourglass } from "lucide-react";
import { isHotGrowth } from "@/lib/radar/presentation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { GrowthMetrics } from "@/lib/radar/types";
import { cn, formatHours, formatPercent, formatSignedNumber } from "@/lib/utils";

const REASON_TEXT: Record<string, string> = {
  not_enough_snapshots:
    "This radar has not collected two snapshots far enough apart for this window yet.",
  snapshot_too_old:
    "A snapshot exists but it is older than the tolerance for this window, so growth would be inaccurate.",
  no_baseline: "No baseline snapshot recorded for this repository yet.",
  invalid_data: "The stored snapshots are inconsistent and were ignored.",
};

export function GrowthBadge({
  metrics,
  windowLabel,
  className,
}: {
  metrics: GrowthMetrics;
  windowLabel: string;
  className?: string;
}) {
  if (metrics.available) {
    const gained = metrics.starsGained ?? 0;
    const positive = gained > 0;
    const negative = gained < 0;
    const hot = isHotGrowth(metrics);
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
              hot && "border-hot/35 bg-hot/10 text-hot",
              positive && !hot &&
                "border-primary/35 bg-primary/10 text-[color:var(--primary)]",
              negative &&
                "border-[color:var(--destructive)]/35 bg-[color:var(--destructive)]/10 text-[color:var(--destructive)]",
              !positive &&
                !negative &&
                "border-border bg-muted/60 text-muted-foreground",
              className,
            )}
          >
            {hot ? <Flame className="size-3" aria-hidden /> : <Activity className="size-3" aria-hidden />}
            {formatSignedNumber(gained)}
            {metrics.growthPct !== null && (
              <span className="opacity-80">({formatPercent(metrics.growthPct)})</span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-72 space-y-1 text-xs">
          <p className="terminal-label text-muted-foreground">
            Measured {windowLabel} growth
          </p>
          <p className="font-mono">
            {formatSignedNumber(gained)} stars over{" "}
            {formatHours(metrics.intervalHours)}
          </p>
          <p className="text-muted-foreground">
            Baseline {metrics.baselineAt ? new Date(metrics.baselineAt).toISOString().slice(0, 16).replace("T", " ") : "unknown"}{" "}
            UTC · {metrics.samples} snapshot points
          </p>
          <p className="text-muted-foreground">
            Momentum score{" "}
            {metrics.momentum === null ? "—" : `${metrics.momentum}/100`} — a
            heuristic built from measured growth only, not a GitHub metric.
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground",
            className,
          )}
        >
          <Hourglass className="size-3" aria-hidden />
          no {windowLabel} history
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72 space-y-1 text-xs">
        <p className="terminal-label text-muted-foreground">Insufficient data</p>
        <p>{REASON_TEXT[metrics.reason ?? "no_baseline"]}</p>
        <p className="text-muted-foreground">
          Collect snapshots regularly (for example from{" "}
          <span className="font-mono">/api/radar/collect</span>) to measure real
          growth here.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function GrowthPair({
  growth,
  className,
}: {
  growth: Record<"24h" | "7d", GrowthMetrics>;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <GrowthBadge metrics={growth["24h"]} windowLabel="24h" />
      <GrowthBadge metrics={growth["7d"]} windowLabel="7d" />
    </div>
  );
}
