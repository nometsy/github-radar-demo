"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search as SearchIcon, SlidersHorizontal } from "lucide-react";
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
  CREATED_WINDOW_OPTIONS,
  FILTER_DEBOUNCE_MS,
  LANGUAGE_OPTIONS,
  SEARCH_DEBOUNCE_MS,
  SEARCH_EXAMPLES,
  SMART_SEARCH_SORT_OPTIONS,
  type SmartSearchSort,
} from "@/lib/constants";
import {
  cn,
  formatDateTime,
  formatNumber,
  getErrorMessage,
  pluralize,
} from "@/lib/utils";

const PER_PAGE = 20;

export function SmartSearchView({ initialQuery = "" }: { initialQuery?: string }) {
  const [q, setQ] = React.useState(initialQuery);
  const [language, setLanguage] = React.useState("any");
  const [minStars, setMinStars] = React.useState(0);
  const [createdDays, setCreatedDays] = React.useState(0);
  const [topic, setTopic] = React.useState("");
  const [sort, setSort] = React.useState<SmartSearchSort>("best");
  const [page, setPage] = React.useState(1);
  const [refreshTick, setRefreshTick] = React.useState(0);
  const [showFilters, setShowFilters] = React.useState(false);

  const debouncedQuery = useDebouncedValue(q.trim(), SEARCH_DEBOUNCE_MS);
  const debouncedTopic = useDebouncedValue(topic.trim(), FILTER_DEBOUNCE_MS);
  const guardRefresh = useRefreshLock();

  const hasQuery = debouncedQuery.length > 0;

  const query = useQuery({
    queryKey: [
      "smart-search",
      debouncedQuery,
      language,
      minStars,
      createdDays,
      debouncedTopic,
      sort,
      page,
      refreshTick,
    ],
    enabled: hasQuery,
    queryFn: ({ signal }) =>
      apiFetch<RepositoriesResponse>(
        `/api/github/search${buildQuery({
          q: debouncedQuery,
          language: language === "any" ? undefined : language,
          minStars,
          topic: debouncedTopic || undefined,
          createdDays,
          sort,
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
        eyebrow="Smart search"
        title="Query GitHub with intent"
        description="Full-text search over names, descriptions and READMEs with language, freshness and popularity filters. Results are the live GitHub index; growth badges stay honest."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters((value) => !value)}
          aria-pressed={showFilters}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filters
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => guardRefresh(() => setRefreshTick((tick) => tick + 1))}
          disabled={query.isFetching || !hasQuery}
        >
          <RefreshCw
            className={cn("size-4", query.isFetching && "animate-spin")}
            aria-hidden
          />
          Refresh
        </Button>
      </PageHeading>

      <form
        className="panel flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          void query.refetch();
        }}
      >
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
            placeholder="Try “agent framework”, “rust cli”, “self-hosted analytics”…"
            aria-label="Search query"
            className="h-10 pl-9 font-mono text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as SmartSearchSort);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SMART_SEARCH_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" className="h-10" disabled={!hasQuery}>
            Search
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">Try</span>
        {SEARCH_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setQ(example);
              setPage(1);
            }}
            className="rounded-md border border-border/70 px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            {example}
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="panel grid gap-3 rounded-xl p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="search-language" className="eyebrow">
              Language
            </Label>
            <Select
              value={language}
              onValueChange={(value) => {
                setLanguage(value);
                setPage(1);
              }}
            >
              <SelectTrigger id="search-language" className="h-9">
                <SelectValue />
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
            <Label htmlFor="search-stars" className="eyebrow">
              Min stars
            </Label>
            <Select
              value={String(minStars)}
              onValueChange={(value) => {
                setMinStars(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger id="search-stars" className="h-9 font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 10, 50, 100, 500, 1_000, 5_000].map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option === 0 ? "Any" : `≥ ${formatNumber(option)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="search-created" className="eyebrow">
              Created
            </Label>
            <Select
              value={String(createdDays)}
              onValueChange={(value) => {
                setCreatedDays(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger id="search-created" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREATED_WINDOW_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="search-topic" className="eyebrow">
              Topic
            </Label>
            <Input
              id="search-topic"
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value);
                setPage(1);
              }}
              placeholder="e.g. kubernetes"
              className="h-9 font-mono text-xs"
            />
          </div>
        </div>
      )}

      {!hasQuery && (
        <EmptyState
          icon={SearchIcon}
          title="Start with a keyword"
          description="Search the live GitHub index and combine it with the filters above. Nothing is fetched until you type at least one character."
        />
      )}

      {data?.meta.stale && (
        <InlineNote tone="warning">
          Cached response from {formatDateTime(data.meta.fetchedAt)}.
        </InlineNote>
      )}

      {hasQuery && query.isPending && <RepoGridSkeleton count={PER_PAGE} />}

      {hasQuery && query.isError && (
        <ErrorState
          message={getErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      )}

      {data && hasQuery && data.items.length === 0 && (
        <EmptyState
          title="No results"
          description={`GitHub found no repository for “${debouncedQuery}” with these filters. Remove a filter or try a broader keyword.`}
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
            {formatNumber(data.totalCount)}{" "}
            {pluralize(data.totalCount, "match")} · fetched{" "}
            {formatDateTime(data.meta.fetchedAt)}
          </p>
        </>
      )}
    </div>
  );
}
