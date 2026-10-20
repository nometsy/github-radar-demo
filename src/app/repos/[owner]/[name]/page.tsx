"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Bug,
  Calendar,
  Copy,
  Eye,
  FileText,
  GitBranch,
  GitCompare,
  GitFork,
  GitPullRequest,
  Home,
  RefreshCw,
  Scale,
  Star,
  Timer,
  Users,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { LanguageDot } from "@/components/radar/language-dot";
import { StarHistoryChart } from "@/components/radar/star-history-chart";
import { EmptyState, ErrorState, InlineNote } from "@/components/radar/states";
import { StatTile } from "@/components/radar/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiFetch, isApiClientError } from "@/lib/api-client";
import type {
  RepoDetailResponse,
  SnapshotMutationResponse,
} from "@/lib/api-types";
import {
  cn,
  copyToClipboard,
  formatCompactNumber,
  formatDate,
  formatDateTime,
  formatHours,
  formatNumber,
  formatRelativeTime,
  formatSignedNumber,
  getErrorMessage,
  safeHttpUrl,
} from "@/lib/utils";
import { useCompare } from "@/providers/compare-provider";
import { useWatchlist } from "@/providers/watchlist-provider";

export default function RepoDetailPage() {
  const params = useParams<{ owner: string; name: string }>();
  const owner = params?.owner ?? "";
  const name = params?.name ?? "";
  const fullName = `${owner}/${name}`;

  const queryClient = useQueryClient();
  const watchlist = useWatchlist();
  const compare = useCompare();
  const [copied, setCopied] = React.useState(false);

  const query = useQuery({
    queryKey: ["repo-details", owner, name],
    enabled: Boolean(owner && name),
    queryFn: ({ signal }) =>
      apiFetch<RepoDetailResponse>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
        { signal },
      ),
  });

  const collect = useMutation({
    mutationFn: () =>
      apiFetch<SnapshotMutationResponse>("/api/radar/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repos: [fullName] }),
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: ["repo-details", owner, name],
      });
      void queryClient.invalidateQueries({ queryKey: ["system-status"] });
      toast.success("Snapshot recorded", {
        description: `${result.captured} captured · ${result.skipped} skipped for ${fullName}`,
      });
    },
    onError: (error) => {
      toast.error("Could not collect a snapshot", {
        description: getErrorMessage(error),
      });
    },
  });

  const data = query.data;
  const repo = data?.repo ?? null;

  const handleCopy = async () => {
    const ok = await copyToClipboard(fullName);
    if (ok) {
      setCopied(true);
      toast("Copied", { description: fullName });
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  const notFound =
    isApiClientError(query.error) && query.error.code === "GITHUB_NOT_FOUND";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
          <Link href="/">
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to radar
          </Link>
        </Button>
      </div>

      {query.isPending && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
      )}

      {query.isError && (
        <ErrorState
          title={notFound ? "Repository not found" : "Could not load repository"}
          message={
            notFound
              ? `GitHub has no public repository at ${fullName}. Check the owner and name spelling.`
              : getErrorMessage(query.error)
          }
          onRetry={() => void query.refetch()}
        />
      )}

      {repo && data && (
        <>
          <header className="panel tech-corners rounded-xl px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {safeHttpUrl(repo.owner.avatarUrl) ? (
                <img
                  src={safeHttpUrl(repo.owner.avatarUrl) ?? ""}
                  alt=""
                  className="size-14 rounded-lg border border-border/70 object-cover"
                />
              ) : null}

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    <Link
                      href={`https://github.com/${repo.owner.login}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="hover:text-primary"
                    >
                      {repo.owner.login}
                    </Link>
                    <span className="text-muted-foreground">/</span>
                    {repo.name}
                  </h1>
                  {repo.archived && (
                    <Badge variant="outline" className="text-[10px]">
                      archived
                    </Badge>
                  )}
                  {repo.fork && (
                    <Badge variant="outline" className="text-[10px]">
                      fork
                    </Badge>
                  )}
                </div>

                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {repo.description ?? "No description provided."}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] text-muted-foreground">
                  <LanguageDot language={repo.language} />
                  {repo.license && (
                    <span className="inline-flex items-center gap-1">
                      <Scale className="size-3" aria-hidden />
                      {repo.license.spdxId ?? repo.license.name}
                    </span>
                  )}
                  <span
                    className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-foreground/80"
                    title={`Created ${formatDate(repo.createdAt)}`}
                  >
                    <Calendar className="size-3" aria-hidden />
                    created {formatRelativeTime(repo.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Timer className="size-3" aria-hidden />
                    pushed {formatRelativeTime(repo.pushedAt ?? repo.updatedAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <GitBranch className="size-3" aria-hidden />
                    {repo.defaultBranch}
                  </span>
                </div>

                {repo.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {repo.topics.map((topic) => (
                      <Badge
                        key={topic}
                        variant="outline"
                        className="border-border/70 bg-muted/40 font-mono text-[10px] font-normal"
                      >
                        {topic}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  variant={watchlist.isSaved(repo.fullName) ? "default" : "outline"}
                  size="sm"
                  onClick={() => watchlist.toggleSave(repo)}
                >
                  <Star
                    className={cn(
                      "size-4",
                      watchlist.isSaved(repo.fullName) && "fill-current",
                    )}
                    aria-hidden
                  />
                  {watchlist.isSaved(repo.fullName) ? "Saved" : "Watch"}
                </Button>
                <Button
                  variant={compare.isSelected(repo.fullName) ? "default" : "outline"}
                  size="sm"
                  onClick={() => compare.toggle(repo)}
                >
                  <GitCompare className="size-4" aria-hidden />
                  Compare
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9"
                      aria-label="Copy full name"
                      onClick={handleCopy}
                    >
                      <Copy className={cn("size-4", copied && "text-primary")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{copied ? "Copied" : fullName}</TooltipContent>
                </Tooltip>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={repo.htmlUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    GitHub
                    <ArrowUpRight className="size-4" aria-hidden />
                  </a>
                </Button>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile
              label="Stars"
              icon={Star}
              tone="primary"
              value={formatNumber(repo.stars)}
            />
            <StatTile
              label="Forks"
              icon={GitFork}
              value={formatNumber(repo.forks)}
            />
            <StatTile
              label="Open issues"
              icon={Bug}
              value={formatNumber(repo.openIssues)}
            />
            <StatTile
              label="Subscribers"
              icon={Users}
              value={formatNumber(repo.subscribersCount)}
            />
            <StatTile
              label="Watchers"
              icon={Eye}
              value={formatNumber(repo.watchers)}
            />
            <StatTile
              label="Size"
              icon={FileText}
              value={
                repo.sizeKb === null
                  ? "—"
                  : `${formatCompactNumber(repo.sizeKb)} KB`
              }
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <section className="panel tech-corners space-y-4 rounded-xl p-4 xl:col-span-2">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">
                    Measured star history
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {data.history.totalPoints > 0
                      ? `${data.history.totalPoints} snapshot points · first ${formatDateTime(data.history.firstAt)} · latest ${formatDateTime(data.history.lastAt)}`
                      : "No snapshots stored for this repository yet."}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={collect.isPending}
                  onClick={() => collect.mutate()}
                >
                  <RefreshCw
                    className={cn(
                      "size-3.5",
                      collect.isPending && "animate-spin",
                    )}
                    aria-hidden
                  />
                  Collect snapshot
                </Button>
              </header>

              <StarHistoryChart history={data.history} />

              <div className="grid gap-3 sm:grid-cols-2">
                {(["24h", "7d"] as const).map((window) => {
                  const metrics = data.growth[window];
                  const earned = metrics.starsGained ?? 0;
                  return (
                    <div
                      key={window}
                      className="rounded-lg border border-border/70 bg-muted/30 px-3.5 py-3"
                    >
                      <p className="eyebrow">
                        {window === "24h"
                          ? "Last 24 hours"
                          : "Last 7 days"}{" "}
                        · measured
                      </p>
                      {metrics.available ? (
                        <>
                          <p
                            className={cn(
                              "mt-1 font-mono text-xl font-semibold tabular-nums",
                              earned > 0 && "text-primary",
                              earned < 0 &&
                                "text-[color:var(--destructive)]",
                            )}
                          >
                            {formatSignedNumber(earned)}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                            over {formatHours(metrics.intervalHours)} ·{" "}
                            {metrics.samples} points
                            {metrics.momentum !== null &&
                              ` · momentum ${metrics.momentum}/100`}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="mt-1 font-mono text-sm text-muted-foreground">
                            insufficient data
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                            {metrics.reason === "snapshot_too_old"
                              ? "The newest snapshot is too old for this window."
                              : metrics.reason === "no_baseline"
                                ? "No baseline snapshot exists yet."
                                : "At least two collections across this window are required."}
                          </p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {earliestLatest(data) && (
                <p className="font-mono text-[11px] text-muted-foreground">
                  earliest stored {formatNumber(data.history.earliestStars)} stars
                  → latest {formatNumber(data.history.latestStars)} stars
                </p>
              )}
            </section>

            <div className="space-y-6">
              <section className="panel tech-corners rounded-xl p-4">
                <h2 className="text-sm font-semibold">Languages</h2>
                {Object.keys(data.languages).length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    GitHub returned no language breakdown for this repository.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {Object.entries(data.languages)
                      .slice(0, 8)
                      .map(([language, bytes]) => {
                        const total = Object.values(data.languages).reduce(
                          (sum, value) => sum + value,
                          0,
                        );
                        const share = total > 0 ? (bytes / total) * 100 : 0;
                        return (
                          <li key={language} className="space-y-1">
                            <div className="flex items-center justify-between font-mono text-[11px]">
                              <LanguageDot language={language} />
                              <span className="text-muted-foreground">
                                {share.toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary/70"
                                style={{ width: `${Math.max(share, 1.5)}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                )}
                {data.partialErrors.languages && (
                  <InlineNote className="mt-3" tone="warning">
                    {data.partialErrors.languages}
                  </InlineNote>
                )}
              </section>

              <section className="panel tech-corners rounded-xl p-4">
                <h2 className="text-sm font-semibold">Latest releases</h2>
                {data.releases.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {data.partialErrors.releases ??
                      "No published releases found."}
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {data.releases.slice(0, 5).map((release) => (
                      <li
                        key={release.id}
                        className="border-b border-border/50 pb-3 last:border-0 last:pb-0"
                      >
                        <a
                          href={release.htmlUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="flex items-center gap-1.5 text-xs font-medium hover:text-primary"
                        >
                          <GitPullRequest className="size-3.5" aria-hidden />
                          {release.name || release.tagName}
                          {release.prerelease && (
                            <Badge
                              variant="outline"
                              className="font-mono text-[9px]"
                            >
                              pre
                            </Badge>
                          )}
                        </a>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                          {release.tagName} ·{" "}
                          {formatDate(release.publishedAt ?? release.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="panel tech-corners rounded-xl p-4">
                <h2 className="text-sm font-semibold">Repository facts</h2>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px]">
                  <FactRow label="issues" value={repo.hasIssues ? "on" : "off"} />
                  <FactRow
                    label="discussions"
                    value={repo.hasDiscussions ? "on" : "off"}
                  />
                  <FactRow label="wiki" value={repo.hasWiki ? "on" : "off"} />
                  <FactRow label="pages" value={repo.hasPages ? "on" : "off"} />
                  <FactRow
                    label="projects"
                    value={repo.hasProjects ? "on" : "off"}
                  />
                  <FactRow
                    label="updated"
                    value={formatDate(repo.updatedAt)}
                  />
                </dl>
                {safeHttpUrl(repo.homepage) && (
                  <a
                    href={safeHttpUrl(repo.homepage) ?? "#"}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-cyan hover:underline"
                  >
                    <Home className="size-3.5" aria-hidden />
                    {safeHttpUrl(repo.homepage)}
                  </a>
                )}
              </section>
            </div>
          </div>

          <section className="panel tech-corners rounded-xl p-4 sm:p-5">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">
                  README{data.readme ? ` · ${data.readme.path}` : ""}
                </h2>
                {data.readme?.truncated && (
                  <p className="text-xs text-muted-foreground">
                    Truncated by GitHub&apos;s API. Open the repository for the
                    full document.
                  </p>
                )}
              </div>
              {data.readme?.htmlUrl && (
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                  <a
                    href={data.readme.htmlUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Open on GitHub
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </a>
                </Button>
              )}
            </header>

            {data.readme ? (
              <div className="markdown-body max-w-none text-sm leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  skipHtml
                  components={{
                    h1: (props) => (
                      <h2 className="mt-6 mb-2 text-lg font-semibold" {...props} />
                    ),
                    h2: (props) => (
                      <h3 className="mt-5 mb-2 text-base font-semibold" {...props} />
                    ),
                    h3: (props) => (
                      <h4 className="mt-4 mb-1.5 text-sm font-semibold" {...props} />
                    ),
                    p: (props) => (
                      <p className="mb-3 text-muted-foreground" {...props} />
                    ),
                    ul: (props) => (
                      <ul
                        className="mb-3 list-disc space-y-1 pl-5 text-muted-foreground"
                        {...props}
                      />
                    ),
                    ol: (props) => (
                      <ol
                        className="mb-3 list-decimal space-y-1 pl-5 text-muted-foreground"
                        {...props}
                      />
                    ),
                    a: (props) => (
                      <a
                        className="text-cyan hover:underline"
                        target="_blank"
                        rel="noreferrer noopener"
                        {...props}
                      />
                    ),
                    code: (props) => (
                      <code
                        className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
                        {...props}
                      />
                    ),
                    pre: (props) => (
                      <pre
                        className="mb-3 overflow-x-auto rounded-lg border border-border/70 bg-muted/50 p-3 font-mono text-xs"
                        {...props}
                      />
                    ),
                    blockquote: (props) => (
                      <blockquote
                        className="mb-3 border-l-2 border-primary/40 pl-3 text-muted-foreground italic"
                        {...props}
                      />
                    ),
                    img: (props) => (
                      <img
                        className="my-2 h-auto max-w-full rounded-lg border border-border/60"
                        loading="lazy"
                        alt={props.alt ?? ""}
                        {...props}
                      />
                    ),
                    table: (props) => (
                      <div className="mb-3 overflow-x-auto">
                        <table
                          className="w-full border-collapse text-xs [&_td]:border [&_td]:border-border/60 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border/60 [&_th]:px-2 [&_th]:py-1"
                          {...props}
                        />
                      </div>
                    ),
                  }}
                >
                  {data.readme.markdown}
                </ReactMarkdown>
              </div>
            ) : (
              <EmptyState
                className="border-0 bg-transparent py-8"
                icon={FileText}
                title="No README"
                description={
                  data.partialErrors.readme ??
                  "GitHub returned no README content for this repository."
                }
              />
            )}
          </section>

          <p className="font-mono text-[11px] text-muted-foreground">
            Live GitHub data fetched {formatDateTime(data.meta.fetchedAt)}
            {data.meta.cached && " · served from cache"}
            {data.meta.stale && " · stale (rate limited)"}
          </p>
        </>
      )}
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function earliestLatest(data: RepoDetailResponse): boolean {
  return (
    data.history.earliestStars !== null && data.history.latestStars !== null
  );
}
