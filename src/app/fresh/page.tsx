"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Cable, RefreshCw, Sparkles } from "lucide-react";
import { PageHeading, Pagination } from "@/components/radar/pagination";
import { RepoCard, RepoGridSkeleton } from "@/components/radar/repo-card";
import { EmptyState, ErrorState, InlineNote } from "@/components/radar/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRefreshLock } from "@/hooks/use-refresh-lock";
import { apiFetch, buildQuery } from "@/lib/api-client";
import type { RepositoriesResponse } from "@/lib/api-types";
import {
  FILTER_DEBOUNCE_MS,
  FRESH_SORT_OPTIONS,
  FRESH_WINDOWS,
  LANGUAGE_OPTIONS,
  MIN_FORK_OPTIONS,
  MIN_STAR_OPTIONS,
  type FreshSort,
  type FreshWindowHours,
} from "@/lib/constants";
import {
  cn,
  formatDateTime,
  formatNumber,
  getErrorMessage,
  pluralize,
} from "@/lib/utils";

const PER_PAGE = 18;

export default function FreshReposPage() {
  const [windowHours, setWindowHours] = React.useState<FreshWindowHours>(24);
  const [language, setLanguage] = React.useState("any");
  const [minStars, setMinStars] = React.useState(10);
  const [minForks, setMinForks] = React.useState(0);
  const [topic, setTopic] = React.useState("");
  const [sort, setSort] = React.useState<FreshSort>("stars");
  const [page, setPage] = React.useState(1);
  const [refreshTick, setRefreshTick] = React.useState(0);

  const debouncedTopic = useDebouncedValue(topic.trim(), FILTER_DEBOUNCE_MS);
  const guardRefresh = useRefreshLock();

  const query = useQuery({
    queryKey: [
      "fresh",
      windowHours,
      language,
      minStars,
      minForks,
      debouncedTopic,
      sort,
      page,
      refreshTick,
    ],
    queryFn: ({ signal }) =>
      apiFetch<RepositoriesResponse>(
        `/api/github/fresh${buildQuery({
          window: windowHours,
          language: language === "any" ? undefined : language,
          minStars,
          minForks,
          topic: debouncedTopic || undefined,
          sort,
          page,
          perPage: PER_PAGE,
          refresh: refreshTick > 0 ? 1 : undefined,
        })}`,
        { signal },
      ),
    placeholderData: (previous) => previous,
  });

  const resetPage = () => setPage(1);
  const data = query.data;
  const activeWindow = FRESH_WINDOWS.find(
    (entry) => entry.hours === windowHours,
  );

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Fresh discovery"
        title="Repositories born in the last hours and days"
        description={
          activeWindow
            ? `${activeWindow.label} — ${activeWindow.description.toLowerCase()}. Ordered by GitHub stars, with measured growth where snapshots exist.`
            : undefined
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

      <div className="space-y-4">
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Fresh window"
        >
          {FRESH_WINDOWS.map((entry) => (
            <button
              key={entry.hours}
              type="button"
              role="tab"
              aria-selected={windowHours === entry.hours}
              onClick={() => {
                setWindowHours(entry.hours);
                // Very short windows rarely contain repos with a star floor,
                // so the filter opens up instead of showing an empty feed.
                if (entry.hours <= 12 && minStars > 0) setMinStars(0);
                resetPage();
              }}
              className={cn(
                "shrink-0 rounded-lg border px-3 py-2 font-mono text-xs tracking-wider transition-colors",
                windowHours === entry.hours
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.shortLabel}
            </button>
          ))}
        </div>

        <div className="panel grid grid-cols-2 gap-3 rounded-xl p-3 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="fresh-language" className="eyebrow">
              Language
            </Label>
            <Select
              value={language}
              onValueChange={(value) => {
                setLanguage(value);
                resetPage();
              }}
            >
              <SelectTrigger id="fresh-language" className="h-9">
                <SelectValue placeholder="Any language" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="any">Any language</SelectItem>
                {LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fresh-stars" className="eyebrow">
              Min stars
            </Label>
            <Select
              value={String(minStars)}
              onValueChange={(value) => {
                setMinStars(Number(value));
                resetPage();
              }}
            >
              <SelectTrigger id="fresh-stars" className="h-9 font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MIN_STAR_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option === 0 ? "Any" : `≥ ${formatNumber(option)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fresh-forks" className="eyebrow">
              Min forks
            </Label>
            <Select
              value={String(minForks)}
              onValueChange={(value) => {
                setMinForks(Number(value));
                resetPage();
              }}
            >
              <SelectTrigger id="fresh-forks" className="h-9 font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MIN_FORK_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option === 0 ? "Any" : `≥ ${formatNumber(option)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fresh-topic" className="eyebrow">
              Topic
            </Label>
            <Input
              id="fresh-topic"
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value);
                resetPage();
              }}
              placeholder="e.g. llm, rust, cli"
              className="h-9 font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fresh-sort" className="eyebrow">
              Sort by
            </Label>
            <Select
              value={sort}
              onValueChange={(value) => {
                setSort(value as FreshSort);
                resetPage();
              }}
            >
              <SelectTrigger id="fresh-sort" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FRESH_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {data?.meta.stale && (
        <InlineNote tone="warning">
          GitHub is rate limited or unreachable — showing the cached response
          from {formatDateTime(data.meta.fetchedAt)}.
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
          icon={Sparkles}
          title="No fresh repositories matched"
          description="Nothing matched these filters inside the selected window. Widen the window, lower the star floor or clear the topic filter."
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

          <p className="flex flex-wrap items-center justify-center gap-2 text-center font-mono text-[11px] text-muted-foreground">
            <Cable className="size-3.5" aria-hidden />
            {formatNumber(data.totalCount)} {pluralize(data.totalCount, "match")}{" "}
            · fetched {formatDateTime(data.meta.fetchedAt)}
          </p>
        </>
      )}
    </div>
  );
}
