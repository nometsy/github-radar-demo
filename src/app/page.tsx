"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  Clock,
  Flame,
  RefreshCw,
  Satellite,
  Star,
  TrendingUp,
} from "lucide-react";
import { LeaderboardPanel } from "@/components/radar/leaderboard-panel";
import { RepoCard, RepoGridSkeleton } from "@/components/radar/repo-card";
import { PageHeading } from "@/components/radar/pagination";
import { SnapshotStatusCard } from "@/components/radar/snapshot-status-card";
import { EmptyState, ErrorState, InlineNote } from "@/components/radar/states";
import { StatTile } from "@/components/radar/stat-tile";
import { Button } from "@/components/ui/button";
import { useRefreshLock } from "@/hooks/use-refresh-lock";
import { apiFetch, buildQuery } from "@/lib/api-client";
import type { DashboardResponse } from "@/lib/api-types";
import { FEED_LENSES, type FeedLens } from "@/lib/constants";
import {
  cn,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  getErrorMessage,
} from "@/lib/utils";

export default function DashboardPage() {
  const [lens, setLens] = React.useState<FeedLens>("rising");
  const [refreshTick, setRefreshTick] = React.useState(0);
  const guardRefresh = useRefreshLock();

  const query = useQuery({
    queryKey: ["dashboard", lens, refreshTick],
    queryFn: ({ signal }) =>
      apiFetch<DashboardResponse>(
        `/api/github/dashboard${buildQuery({
          lens,
          refresh: refreshTick > 0 ? 1 : undefined,
        })}`,
        { signal },
      ),
  });

  const data = query.data;
  const activeLens = FEED_LENSES.find((entry) => entry.id === lens);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Live radar · github rest api"
        title="What is gaining speed right now"
        description={
          <>
            Live repository discovery from GitHub, filtered by how young and how
            active a project is. Growth percentages appear only where this radar
            has collected its own snapshot history.
          </>
        }
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => guardRefresh(() => setRefreshTick((tick) => tick + 1))}
          disabled={query.isFetching}
        >
          <RefreshCw
            className={cn("size-4", query.isFetching && "animate-spin")}
            aria-hidden
          />
          Refresh
        </Button>
      </PageHeading>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Link
          href="/fresh?window=24"
          className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <StatTile
            label="New · 24h"
            icon={Satellite}
            tone="primary"
            value={data ? formatNumber(data.stats.newToday) : "…"}
            hint={
              data
                ? data.stats.newToday === null
                  ? "GitHub did not return a count for this window."
                  : `Created since ${formatRelativeTime(data.stats.newTodaySince)}`
                : "Loading live count"
            }
          />
        </Link>
        <StatTile
          label="Trending"
          icon={Flame}
          tone="cyan"
          value={data ? formatNumber(data.stats.trendingCount) : "…"}
          hint={data ? data.stats.trendingWindowLabel : "Loading lane size"}
        />
        <StatTile
          label="Measured 24h movers"
          icon={TrendingUp}
          tone="primary"
          value={data ? formatNumber(data.stats.measuredGrowers24h) : "…"}
          hint="Repositories with a real 24h snapshot pair"
        />
        <StatTile
          label="Stars tracked"
          icon={Star}
          value={data ? formatNumber(data.stats.starsTracked) : "…"}
          hint="Stars stored across snapshots"
        />
        <StatTile
          label="Repositories tracked"
          icon={Boxes}
          value={data ? formatNumber(data.stats.reposTracked) : "…"}
          hint="Locally observed repositories"
        />
        <StatTile
          label="Snapshots stored"
          icon={Clock}
          value={data ? formatNumber(data.stats.snapshotsTracked) : "…"}
          hint="Raw measurement points"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
            <div
              className="-mx-4 flex overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="Feed lens"
            >
              {FEED_LENSES.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={lens === entry.id}
                  onClick={() => setLens(entry.id)}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                    lens === entry.id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <p className="font-mono text-[11px] text-muted-foreground">
              {activeLens?.hint}
            </p>
          </div>

          {data?.feed.meta.stale && (
            <InlineNote tone="warning">
              <span>
                GitHub rate limit or network issue: showing the last cached
                response from {formatDateTime(data.feed.meta.fetchedAt)}.
              </span>
            </InlineNote>
          )}

          {data?.feed.meta.note && !data.feed.meta.stale && (
            <InlineNote>{data.feed.meta.note}</InlineNote>
          )}

          {query.isPending && <RepoGridSkeleton count={6} />}

          {query.isError && (
            <ErrorState
              message={getErrorMessage(query.error)}
              onRetry={() => void query.refetch()}
            />
          )}

          {data && data.feed.items.length === 0 && (
            <EmptyState
              title="Nothing matched this lens"
              description="GitHub returned no repositories for this filter combination. Try another lens or refresh in a moment."
            />
          )}

          {data && data.feed.items.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {data.feed.items.map((repo, index) => (
                <RepoCard
                  key={repo.fullName}
                  repo={repo}
                  style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                />
              ))}
            </div>
          )}

          {data && (
            <p className="font-mono text-[11px] text-muted-foreground">
              {formatNumber(data.feed.totalCount)} matches · page{" "}
              {data.feed.page}/{Math.max(1, data.feed.pageCount)} · fetched{" "}
              {formatRelativeTime(data.feed.meta.fetchedAt)}
              {data.feed.incompleteResults && " · GitHub marked results as incomplete"}
            </p>
          )}
        </div>

        <div className="space-y-6">
          <LeaderboardPanel limit={6} />
          <SnapshotStatusCard />
        </div>
      </div>
    </div>
  );
}
