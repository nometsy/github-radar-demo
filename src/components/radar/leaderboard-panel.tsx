"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, TrendingUp } from "lucide-react";
import { GrowthBadge } from "@/components/radar/growth-badge";
import { EmptyState, ErrorState } from "@/components/radar/states";
import { Button } from "@/components/ui/button";
import { apiFetch, buildQuery } from "@/lib/api-client";
import type { LeaderboardResponse } from "@/lib/api-types";
import type { GrowthWindow } from "@/lib/radar/types";
import {
  cn,
  formatCompactNumber,
  getErrorMessage,
  safeHttpUrl,
} from "@/lib/utils";

const WINDOWS: { id: GrowthWindow; label: string }[] = [
  { id: "24h", label: "24H" },
  { id: "7d", label: "7D" },
];

export function LeaderboardPanel({
  defaultWindow = "24h",
  limit = 6,
  className,
}: {
  defaultWindow?: GrowthWindow;
  limit?: number;
  className?: string;
}) {
  const [window, setWindow] = React.useState<GrowthWindow>(defaultWindow);

  const query = useQuery({
    queryKey: ["leaderboard", window, limit],
    queryFn: ({ signal }) =>
      apiFetch<LeaderboardResponse>(
        `/api/radar/leaderboard${buildQuery({ window, limit })}`,
        { signal },
      ),
    staleTime: 60_000,
  });

  return (
    <section className={cn("panel tech-corners rounded-xl", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">Measured movers</h2>
        </div>
        <div
          className="flex rounded-lg border border-border/70 p-0.5"
          role="group"
          aria-label="Growth window"
        >
          {WINDOWS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={window === option.id}
              onClick={() => setWindow(option.id)}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-[11px] tracking-wider transition-colors",
                window === option.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-2">
        {query.isPending && (
          <div className="space-y-2 p-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="skeleton-shimmer h-12 w-full rounded-lg"
              />
            ))}
          </div>
        )}

        {query.isError && (
          <ErrorState
            className="border-0 bg-transparent py-8"
            message={getErrorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        )}

        {query.data && query.data.items.length === 0 && (
          <EmptyState
            className="border-0 bg-transparent py-8"
            icon={Activity}
            title="No measured movers yet"
            description={
              query.data.status.note ??
              "Growth is measured from stored snapshots. This radar needs at least two collections spaced across the selected window before a leaderboard can be shown."
            }
            action={
              <p className="font-mono text-[11px] text-muted-foreground">
                {query.data.status.snapshotCount} snapshots ·{" "}
                {query.data.status.trackedRepos} repositories tracked
              </p>
            }
          />
        )}

        {query.data && query.data.items.length > 0 && (
          <ol className="divide-y divide-border/60">
            {query.data.items.map((entry, index) => (
              <li
                key={entry.repo.fullName}
                className="flex items-center gap-3 px-2 py-2.5"
              >
                <span className="w-5 shrink-0 text-center font-mono text-xs text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                {safeHttpUrl(entry.repo.avatarUrl) ? (
                  <img
                    src={safeHttpUrl(entry.repo.avatarUrl) ?? ""}
                    alt=""
                    loading="lazy"
                    className="size-7 shrink-0 rounded border border-border/70 object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/repos/${entry.repo.fullName}`}
                    className="block truncate text-xs font-medium hover:text-primary"
                  >
                    {entry.repo.fullName}
                  </Link>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {formatCompactNumber(entry.repo.stars)} stars ·{" "}
                    {entry.repo.language ?? "unknown language"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <GrowthBadge
                    metrics={entry.growth}
                    windowLabel={window === "24h" ? "24h" : "7d"}
                  />
                  {entry.growth.momentum !== null && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      momentum {entry.growth.momentum}/100
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-border/70 px-4 py-2.5">
        <p className="text-[11px] leading-snug text-muted-foreground">
          Computed only from locally stored snapshots.
        </p>
        <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
          <Link href="/trending">Open lanes</Link>
        </Button>
      </footer>
    </section>
  );
}
