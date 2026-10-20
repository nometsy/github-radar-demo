"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Info, RefreshCw } from "lucide-react";
import { PageHeading, Pagination } from "@/components/radar/pagination";
import { RepoCard, RepoGridSkeleton } from "@/components/radar/repo-card";
import { EmptyState, ErrorState, InlineNote } from "@/components/radar/states";
import { Button } from "@/components/ui/button";
import { useRefreshLock } from "@/hooks/use-refresh-lock";
import { apiFetch, buildQuery } from "@/lib/api-client";
import type { RepositoriesResponse } from "@/lib/api-types";
import { TRENDING_LANES, type TrendingLaneId } from "@/lib/constants";
import {
  cn,
  formatDateTime,
  formatNumber,
  getErrorMessage,
} from "@/lib/utils";

const PER_PAGE = 18;

export default function TrendingPage() {
  const [lane, setLane] = React.useState<TrendingLaneId>("week");
  const [page, setPage] = React.useState(1);
  const [refreshTick, setRefreshTick] = React.useState(0);
  const guardRefresh = useRefreshLock();

  const activeLane = TRENDING_LANES.find((entry) => entry.id === lane);

  const query = useQuery({
    queryKey: ["trending", lane, page, refreshTick],
    queryFn: ({ signal }) =>
      apiFetch<RepositoriesResponse>(
        `/api/github/trending${buildQuery({
          lane,
          page,
          perPage: PER_PAGE,
          refresh: refreshTick > 0 ? 1 : undefined,
        })}`,
        { signal },
      ),
    placeholderData: (previous) => previous,
  });

  const data = query.data;

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Trending radar"
        title="Lanes of activity, not guesses"
        description="Each lane is a documented GitHub query. Star totals are live values; growth badges only appear when this radar holds matching snapshots."
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
          Scan
        </Button>
      </PageHeading>

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Trending lane"
      >
        {TRENDING_LANES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={lane === entry.id}
            onClick={() => {
              setLane(entry.id);
              setPage(1);
            }}
            className={cn(
              "rounded-lg border px-3 py-1.5 font-mono text-xs tracking-wider transition-colors",
              lane === entry.id
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/70 text-muted-foreground hover:text-foreground",
            )}
          >
            {entry.shortLabel}
          </button>
        ))}
      </div>

      {activeLane && (
        <div className="panel tech-corners rounded-xl px-4 py-3">
          <p className="eyebrow flex items-center gap-1.5">
            <Info className="size-3.5" aria-hidden />
            {activeLane.label} methodology
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {activeLane.description} {activeLane.methodology}
          </p>
        </div>
      )}

      {data?.meta.stale && (
        <InlineNote tone="warning">
          Showing the cached response from {formatDateTime(data.meta.fetchedAt)} —
          GitHub is rate limited or unreachable.
        </InlineNote>
      )}

      {data?.meta.note && !data.meta.stale && (
        <InlineNote>{data.meta.note}</InlineNote>
      )}

      {query.isPending && <RepoGridSkeleton count={PER_PAGE} />}

      {query.isError && (
        <ErrorState
          message={getErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          icon={Activity}
          title="This lane is empty"
          description="No repository currently matches the lane query. GitHub search is strict about freshness windows — try another lane or scan again later."
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((repo, index) => (
              <RepoCard
                key={repo.fullName}
                repo={repo}
                style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
              />
            ))}
          </div>

          <Pagination
            page={data.page}
            pageCount={data.pageCount}
            disabled={query.isFetching}
            onPageChange={setPage}
          />

          <p className="text-center font-mono text-[11px] text-muted-foreground">
            {formatNumber(data.totalCount)} matches · fetched{" "}
            {formatDateTime(data.meta.fetchedAt)}
          </p>
        </>
      )}
    </div>
  );
}
