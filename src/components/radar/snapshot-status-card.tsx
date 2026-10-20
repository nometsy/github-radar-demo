"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import type { SnapshotMutationResponse } from "@/lib/api-types";
import { useSystemStatus } from "@/hooks/use-system-status";
import { SNAPSHOT_MIN_INTERVAL_MINUTES } from "@/lib/constants";
import {
  cn,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  getErrorMessage,
} from "@/lib/utils";

export function SnapshotStatusCard({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useSystemStatus();

  const collect = useMutation({
    mutationFn: () =>
      apiFetch<SnapshotMutationResponse>("/api/radar/collect", {
        method: "POST",
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["system-status"] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["repo-details"] });
      void queryClient.invalidateQueries({ queryKey: ["batch-repos"] });
      toast.success("Snapshot run finished", {
        description: `${result.captured} captured · ${result.skipped} skipped · ${result.tracked} repositories tracked`,
      });
    },
    onError: (error) => {
      toast.error("Snapshot run failed", {
        description: getErrorMessage(error),
      });
    },
  });

  const storage = data?.storage ?? null;

  return (
    <section className={cn("panel tech-corners rounded-xl", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          {storage?.driver === "postgres" ? (
            <Database className="size-4 text-cyan" aria-hidden />
          ) : (
            <HardDrive className="size-4 text-primary" aria-hidden />
          )}
          <h2 className="text-sm font-semibold">Snapshot storage</h2>
          {storage && (
            <Badge
              variant="outline"
              className="font-mono text-[10px] font-normal"
            >
              {storage.driver === "postgres" ? "postgresql" : "file"}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={collect.isPending || storage?.writable === false}
          onClick={() => collect.mutate()}
        >
          <RefreshCw
            className={cn("size-3.5", collect.isPending && "animate-spin")}
            aria-hidden
          />
          {collect.isPending ? "Collecting…" : "Collect now"}
        </Button>
      </header>

      <div className="space-y-3 px-4 py-3.5">
        {isPending && (
          <div className="space-y-2">
            <div className="skeleton-shimmer h-3.5 w-3/4 rounded" />
            <div className="skeleton-shimmer h-3.5 w-1/2 rounded" />
          </div>
        )}

        {isError && (
          <p className="text-xs text-muted-foreground">
            Snapshot status is unavailable right now.
          </p>
        )}

        {storage && (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">repos tracked</dt>
                <dd className="tabular-nums">
                  {formatNumber(storage.trackedRepos)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">snapshots</dt>
                <dd className="tabular-nums">
                  {formatNumber(storage.snapshotCount)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">stars tracked</dt>
                <dd className="tabular-nums">
                  {formatNumber(storage.starsTracked)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">24h coverage</dt>
                <dd className="tabular-nums">
                  {formatNumber(storage.available24h)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">7d coverage</dt>
                <dd className="tabular-nums">
                  {formatNumber(storage.available7d)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">last snapshot</dt>
                <dd>{formatRelativeTime(storage.newestSnapshotAt)}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {storage.writable ? (
                  <ShieldCheck className="size-3.5 text-primary" aria-hidden />
                ) : (
                  <TriangleAlert
                    className="size-3.5 text-[color:var(--warning)]"
                    aria-hidden
                  />
                )}
                {storage.writable ? "writable" : "read-only"}
              </span>
              <span className="font-mono">
                oldest {formatDateTime(storage.oldestSnapshotAt)}
              </span>
            </div>

            {storage.note && (
              <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                {storage.note}
              </p>
            )}

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              A run collects snapshots for the rising feed, the AI lane and the
              fresh feed. Rows are skipped if they were already captured within
              the minimum interval, so a safe cron cadence is every{" "}
              {SNAPSHOT_MIN_INTERVAL_MINUTES} minutes or more.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
