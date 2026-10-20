"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  GitCompare,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { GrowthBadge } from "@/components/radar/growth-badge";
import { LanguageDot } from "@/components/radar/language-dot";
import { PageHeading } from "@/components/radar/pagination";
import { EmptyState, InlineNote } from "@/components/radar/states";
import { Button } from "@/components/ui/button";
import { apiFetch, buildQuery } from "@/lib/api-client";
import type {
  BatchReposResponse,
  RepoWithGrowth,
  SnapshotMutationResponse,
} from "@/lib/api-types";
import {
  cn,
  formatCompactNumber,
  formatDate,
  formatHours,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  getErrorMessage,
  getRepoAgeDays,
  safeHttpUrl,
} from "@/lib/utils";
import { useCompare } from "@/providers/compare-provider";

export default function ComparePage() {
  const compare = useCompare();
  const queryClient = useQueryClient();

  const names = React.useMemo(
    () => compare.items.map((item) => item.fullName),
    [compare.items],
  );

  const batch = useQuery({
    queryKey: ["batch-repos", names.join(",")],
    enabled: names.length > 0,
    queryFn: ({ signal }) =>
      apiFetch<BatchReposResponse>(
        `/api/github/repos/batch${buildQuery({ names: names.join(",") })}`,
        { signal },
      ),
  });

  const collect = useMutation({
    mutationFn: () =>
      apiFetch<SnapshotMutationResponse>("/api/radar/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repos: names.slice(0, 8) }),
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["batch-repos"] });
      void queryClient.invalidateQueries({ queryKey: ["system-status"] });
      toast.success("Snapshots recorded", {
        description: `${result.captured} captured · ${result.skipped} skipped`,
      });
    },
    onError: (error) =>
      toast.error("Snapshot run failed", {
        description: getErrorMessage(error),
      }),
  });

  const repos = React.useMemo(() => {
    const map = new Map<string, RepoWithGrowth>();
    for (const item of batch.data?.items ?? []) {
      if (item.repo) map.set(item.fullName, item.repo);
    }
    return map;
  }, [batch.data]);

  const rows: {
    label: string;
    hint?: string;
    render: (repo: RepoWithGrowth) => React.ReactNode;
  }[] = [
    {
      label: "Stars",
      render: (repo) => (
        <span className="font-mono tabular-nums">
          {formatNumber(repo.stars)}
        </span>
      ),
    },
    {
      label: "Forks",
      render: (repo) => (
        <span className="font-mono tabular-nums">
          {formatNumber(repo.forks)}
        </span>
      ),
    },
    {
      label: "Open issues",
      render: (repo) => (
        <span className="font-mono tabular-nums">
          {formatNumber(repo.openIssues)}
        </span>
      ),
    },
    {
      label: "Language",
      render: (repo) => <LanguageDot language={repo.language} />,
    },
    {
      label: "Created",
      hint: "Age in days",
      render: (repo) => (
        <span className="font-mono">
          {formatDate(repo.createdAt)} ·{" "}
          {Math.round(getRepoAgeDays(repo.createdAt))}d
        </span>
      ),
    },
    {
      label: "Last push",
      render: (repo) => (
        <span className="font-mono">
          {formatRelativeTime(repo.pushedAt ?? repo.updatedAt)}
        </span>
      ),
    },
    {
      label: "License",
      render: (repo) => (
        <span className="font-mono">
          {repo.license?.spdxId ?? repo.license?.name ?? "—"}
        </span>
      ),
    },
    {
      label: "Repo size",
      render: (repo) => (
        <span className="font-mono tabular-nums">
          {repo.sizeKb === null ? "—" : `${formatCompactNumber(repo.sizeKb)} KB`}
        </span>
      ),
    },
    {
      label: "Topics",
      render: (repo) => (
        <span className="font-mono tabular-nums">
          {repo.topics.length > 0 ? repo.topics.slice(0, 3).join(", ") : "—"}
          {repo.topics.length > 3 && ` +${repo.topics.length - 3}`}
        </span>
      ),
    },
    {
      label: "Measured 24h",
      hint: "From stored snapshots only",
      render: (repo) => (
        <GrowthBadge metrics={repo.growth["24h"]} windowLabel="24h" />
      ),
    },
    {
      label: "Measured 7d",
      render: (repo) => (
        <GrowthBadge metrics={repo.growth["7d"]} windowLabel="7d" />
      ),
    },
    {
      label: "Growth % · 24h",
      render: (repo) => (
        <span className="font-mono tabular-nums">
          {formatPercent(repo.growth["24h"].growthPct)}
        </span>
      ),
    },
    {
      label: "Momentum · 24h",
      hint: "Heuristic 0–100 score from measured growth",
      render: (repo) => (
        <span className="font-mono tabular-nums">
          {repo.growth["24h"].momentum === null
            ? "—"
            : `${repo.growth["24h"].momentum}/100`}
        </span>
      ),
    },
    {
      label: "Snapshot window",
      render: (repo) => (
        <span className="font-mono">
          {repo.growth["24h"].available
            ? formatHours(repo.growth["24h"].intervalHours)
            : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Comparison"
        title="Side-by-side repository metrics"
        description="Up to four repositories compared on live GitHub values and measured snapshot growth. Metrics without collected history are shown as — instead of being invented."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => collect.mutate()}
          disabled={collect.isPending || names.length === 0}
        >
          <RefreshCw
            className={cn("size-4", collect.isPending && "animate-spin")}
            aria-hidden
          />
          Collect snapshots
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={compare.clear}
          disabled={names.length === 0}
        >
          <Trash2 className="size-4" aria-hidden />
          Clear stack
        </Button>
      </PageHeading>

      {names.length === 0 && (
        <EmptyState
          icon={GitCompare}
          title="Compare stack is empty"
          description="Add repositories with the compare button on any card, then return here to review their metrics side by side."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/trending">Browse trending</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/ai">Browse AI</Link>
              </Button>
            </div>
          }
        />
      )}

      {names.length > 0 && batch.isError && (
        <InlineNote tone="warning">
          Could not load live data for these repositories:{" "}
          {getErrorMessage(batch.error)}
        </InlineNote>
      )}

      {names.length > 0 && (
        <div className="panel tech-corners overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/70">
                  <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left align-bottom">
                    <span className="eyebrow">Metric</span>
                  </th>
                  {compare.items.map((item) => {
                    const repo = repos.get(item.fullName);
                    return (
                      <th
                        key={item.fullName}
                        className="min-w-56 px-4 py-3 text-left align-bottom"
                      >
                        <div className="flex items-start gap-2">
                          {safeHttpUrl(item.avatarUrl) ? (
                            <img
                              src={safeHttpUrl(item.avatarUrl) ?? ""}
                              alt=""
                              className="size-8 rounded border border-border/70 object-cover"
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/repos/${item.fullName}`}
                              className="block truncate text-sm font-semibold hover:text-primary"
                            >
                              {item.name}
                            </Link>
                            <span className="block truncate font-mono text-[10px] text-muted-foreground">
                              {item.owner}
                            </span>
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove ${item.fullName} from compare`}
                            className="text-muted-foreground hover:text-[color:var(--destructive)]"
                            onClick={() => compare.remove(item.fullName)}
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                        {!repo && batch.isPending && (
                          <span className="skeleton-shimmer mt-2 block h-3 w-24 rounded" />
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={row.label}
                    className={cn(
                      "border-b border-border/50 last:border-0",
                      rowIndex % 2 === 1 && "bg-muted/20",
                    )}
                  >
                    <th className="sticky left-0 z-10 bg-card px-4 py-2.5 text-left align-middle font-normal">
                      <span className="block text-xs text-muted-foreground">
                        {row.label}
                      </span>
                      {row.hint && (
                        <span className="block font-mono text-[10px] text-muted-foreground/70">
                          {row.hint}
                        </span>
                      )}
                    </th>
                    {compare.items.map((item) => {
                      const repo = repos.get(item.fullName);
                      return (
                        <td
                          key={`${row.label}-${item.fullName}`}
                          className="px-4 py-2.5 align-middle"
                        >
                          {repo ? (
                            row.render(repo)
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">
                              {batch.isPending ? "…" : "unavailable"}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <th className="sticky left-0 z-10 bg-card px-4 py-2.5 text-left">
                    <span className="text-xs text-muted-foreground">Links</span>
                  </th>
                  {compare.items.map((item) => (
                    <td key={`links-${item.fullName}`} className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                        >
                          <Link href={`/repos/${item.fullName}`}>Details</Link>
                        </Button>
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                        >
                          <a
                            href={`https://github.com/${item.fullName}`}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            GitHub
                            <ArrowUpRight className="size-3.5" aria-hidden />
                          </a>
                        </Button>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {batch.data && batch.data.meta.stale && (
        <InlineNote tone="warning">
          Live data came from a cached response because GitHub is rate limited.
        </InlineNote>
      )}
    </div>
  );
}
