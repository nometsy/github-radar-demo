"use client";

import { Gauge, KeyRound } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSystemStatus } from "@/hooks/use-system-status";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

function tone(remaining: number, limit: number): string {
  if (limit <= 0) return "text-muted-foreground";
  const ratio = remaining / limit;
  if (ratio <= 0.1) return "text-[color:var(--destructive)]";
  if (ratio <= 0.3) return "text-[color:var(--warning)]";
  return "text-primary";
}

export function RateLimitPill() {
  const { data, isPending, isError } = useSystemStatus();

  const core = data?.rateLimit.core ?? null;
  const search = data?.rateLimit.search ?? null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-9 items-center gap-2 rounded-lg border border-border/70 bg-card/60 px-2.5 text-xs">
          <Gauge className="size-3.5 text-muted-foreground" aria-hidden />
          {isPending ? (
            <span className="font-mono text-muted-foreground">…/…</span>
          ) : isError || !core ? (
            <span className="font-mono text-muted-foreground">n/a</span>
          ) : (
            <span
              className={cn("font-mono tabular-nums", tone(core.remaining, core.limit))}
            >
              {core.remaining}/{core.limit}
            </span>
          )}
          <span className="hidden font-mono text-[10px] tracking-widest text-muted-foreground uppercase sm:inline">
            core
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-72 space-y-2 text-xs">
        <p className="terminal-label text-muted-foreground">
          GitHub API quota
        </p>
        <div className="space-y-1 font-mono">
          <p>
            core:{" "}
            {core
              ? `${core.remaining}/${core.limit} · resets ${formatDateTime(core.resetAt === null ? null : new Date(core.resetAt))}`
              : "no data"}
          </p>
          <p>
            search:{" "}
            {search
              ? `${search.remaining}/${search.limit} · resets ${formatDateTime(search.resetAt === null ? null : new Date(search.resetAt))}`
              : "no data"}
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <KeyRound className="size-3" aria-hidden />
          {data?.tokenConfigured
            ? "GITHUB_TOKEN detected (server-side)"
            : "No token — anonymous quota (60 req/h)"}
        </p>
        <p className="text-muted-foreground">
          Snapshot storage: {data?.storage.driver ?? "unknown"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
