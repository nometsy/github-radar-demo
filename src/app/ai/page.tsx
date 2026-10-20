"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Boxes,
  Brain,
  BrainCircuit,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { PageHeading, Pagination } from "@/components/radar/pagination";
import { RepoCard, RepoGridSkeleton } from "@/components/radar/repo-card";
import { EmptyState, ErrorState, InlineNote } from "@/components/radar/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRefreshLock } from "@/hooks/use-refresh-lock";
import { apiFetch, buildQuery } from "@/lib/api-client";
import type { RepositoriesResponse } from "@/lib/api-types";
import {
  AI_CATEGORIES,
  FILTER_DEBOUNCE_MS,
  type AiCategoryIcon,
  type AiCategoryId,
} from "@/lib/constants";
import {
  cn,
  formatDateTime,
  formatNumber,
  getErrorMessage,
} from "@/lib/utils";

const PER_PAGE = 18;

const CATEGORY_ICONS: Record<AiCategoryIcon, LucideIcon> = {
  brain: Brain,
  llm: BrainCircuit,
  agents: Bot,
  sparkles: Sparkles,
  terminal: Terminal,
  workflow: Workflow,
  shield: ShieldCheck,
  boxes: Boxes,
};

export default function AiDiscoveryPage() {
  const [category, setCategory] =
    React.useState<AiCategoryId>("artificial-intelligence");
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<"stars" | "updated">("stars");
  const [page, setPage] = React.useState(1);
  const [refreshTick, setRefreshTick] = React.useState(0);

  const debouncedQ = useDebouncedValue(q.trim(), FILTER_DEBOUNCE_MS);
  const guardRefresh = useRefreshLock();
  const activeCategory = AI_CATEGORIES.find((entry) => entry.id === category);

  const query = useQuery({
    queryKey: ["ai", category, debouncedQ, sort, page, refreshTick],
    queryFn: ({ signal }) =>
      apiFetch<RepositoriesResponse>(
        `/api/github/ai${buildQuery({
          category,
          q: debouncedQ || undefined,
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
        eyebrow="AI discovery"
        title="Applied AI, LLMs, agents and vibe coding"
        description="Curated topic queries across the AI ecosystem. Star counts are live GitHub values; growth is only reported when snapshots exist."
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

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {AI_CATEGORIES.map((entry) => {
          const Icon = CATEGORY_ICONS[entry.icon];
          const active = category === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setCategory(entry.id);
                setPage(1);
              }}
              className={cn(
                "panel surface-hover flex items-start gap-3 rounded-xl px-3.5 py-3 text-left transition-colors",
                active && "border-primary/40 bg-primary/8",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border",
                  active
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border/70 bg-muted/50 text-muted-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{entry.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {entry.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="panel grid gap-3 rounded-xl p-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <label htmlFor="ai-keyword" className="eyebrow block">
            Narrow this category
          </label>
          <Input
            id="ai-keyword"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
            placeholder="Optional keyword, e.g. inference, rag, copilot"
            className="h-9 font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <span className="eyebrow block">Sort</span>
          <div className="flex rounded-lg border border-border/70 p-0.5">
            {(
              [
                { value: "stars", label: "Stars" },
                { value: "updated", label: "Updated" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={sort === option.value}
                onClick={() => {
                  setSort(option.value);
                  setPage(1);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs transition-colors",
                  sort === option.value
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeCategory && (
        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          query: {activeCategory.query}
          {debouncedQ && ` + "${debouncedQ}"`}
        </p>
      )}

      {data?.meta.stale && (
        <InlineNote tone="warning">
          Cached response from {formatDateTime(data.meta.fetchedAt)}.
        </InlineNote>
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
          title="No repositories in this category slice"
          description="The topic query returned nothing with the current star floor or keyword. Clear the keyword or pick a broader category."
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
