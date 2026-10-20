"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Clock,
  Copy,
  Flame,
  GitCompare,
  GitFork,
  ScrollText,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { GrowthPair } from "@/components/radar/growth-badge";
import { LanguageDot } from "@/components/radar/language-dot";
import { Sparkline } from "@/components/radar/sparkline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RepoWithGrowth } from "@/lib/api-types";
import { SNAPSHOT_MIN_INTERVAL_MINUTES } from "@/lib/constants";
import { isHotGrowth } from "@/lib/radar/presentation";
import {
  cn,
  copyToClipboard,
  formatCompactNumber,
  formatDate,
  formatRelativeTime,
  safeHttpUrl,
} from "@/lib/utils";
import { useCompare } from "@/providers/compare-provider";
import { useWatchlist } from "@/providers/watchlist-provider";

export function RepoCard({
  repo,
  className,
  style,
}: {
  repo: RepoWithGrowth;
  className?: string;
  style?: React.CSSProperties;
}) {
  const watchlist = useWatchlist();
  const compare = useCompare();
  const [copied, setCopied] = React.useState(false);

  const saved = watchlist.isSaved(repo.fullName);
  const selected = compare.isSelected(repo.fullName);
  const hot = isHotGrowth(repo.growth["24h"]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(repo.fullName);
    if (ok) {
      setCopied(true);
      toast("Copied", { description: repo.fullName });
      window.setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error("Clipboard is not available in this browser.");
    }
  };

  return (
    <Card
      data-hot={hot}
      className={cn(
        "panel repo-card tech-corners animate-fade-up flex h-full flex-col gap-3 p-4",
        className,
      )}
      style={style}
    >
      <div className="flex items-start gap-3">
        {safeHttpUrl(repo.owner.avatarUrl) ? (
          <img
            src={safeHttpUrl(repo.owner.avatarUrl) ?? ""}
            alt=""
            loading="lazy"
            className="size-9 shrink-0 rounded-md border border-border/70 object-cover"
          />
        ) : (
          <span className="flex size-9 items-center justify-center rounded-md border border-border/70 bg-muted font-mono text-xs">
            {repo.owner.login.slice(0, 2).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <Link
            href={`/repos/${repo.owner.login}/${repo.name}`}
            className="block truncate text-sm font-semibold hover:text-primary focus-visible:text-primary"
          >
            {repo.owner.login}
            <span className="text-muted-foreground">/</span>
            <span>{repo.name}</span>
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Star className="size-3" aria-hidden />
              {formatCompactNumber(repo.stars)}
            </span>
            <span className="inline-flex items-center gap-1">
              <GitFork className="size-3" aria-hidden />
              {formatCompactNumber(repo.forks)}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-foreground/80"
              title={`Created ${formatDate(repo.createdAt)}`}
            >
              <Clock className="size-3" aria-hidden />
              created {formatRelativeTime(repo.createdAt)}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="tap-target size-8 sm:size-8"
                aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
                aria-pressed={saved}
                onClick={() => watchlist.toggleSave(repo)}
              >
                <Star
                  className={cn("size-4", saved && "fill-primary text-primary")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{saved ? "In watchlist" : "Watch"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="tap-target size-8 sm:size-8"
                aria-label={selected ? "Remove from compare" : "Add to compare"}
                aria-pressed={selected}
                onClick={() => compare.toggle(repo)}
              >
                <GitCompare
                  className={cn("size-4", selected && "text-cyan")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {selected ? "In compare stack" : "Compare"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <p className="line-clamp-2 min-h-9 text-sm text-muted-foreground">
        {repo.description ?? "No description provided."}
      </p>

      {repo.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {repo.topics.slice(0, 4).map((topic) => (
            <Badge
              key={topic}
              variant="outline"
              className="max-w-36 truncate border-border/70 bg-muted/40 font-mono text-[10px] font-normal"
            >
              {topic}
            </Badge>
          ))}
          {repo.topics.length > 4 && (
            <span className="self-center font-mono text-[10px] text-muted-foreground">
              +{repo.topics.length - 4}
            </span>
          )}
        </div>
      )}

      {hot && (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-hot/30 bg-hot/10 px-2 py-1 font-mono text-[11px] text-hot">
          <Flame className="size-3.5" aria-hidden />
          Hot · momentum {repo.growth["24h"].momentum}/100
        </span>
      )}

      {repo.sparkline && (
        <Sparkline data={repo.sparkline} className="text-muted-foreground" />
      )}

      <GrowthPair growth={repo.growth} />

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3 font-mono text-[11px] text-muted-foreground">
        <LanguageDot language={repo.language} />
        <span className="truncate">
          pushed {formatRelativeTime(repo.pushedAt ?? repo.updatedAt)}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Button asChild variant="outline" size="sm" className="h-8 flex-1 text-xs">
          <Link href={`/repos/${repo.owner.login}/${repo.name}`}>
            <ScrollText className="size-3.5" aria-hidden />
            Details
          </Link>
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="tap-target size-8 sm:size-7"
              aria-label="Copy full repository name"
              onClick={handleCopy}
            >
              <Copy className={cn("size-3.5", copied && "text-primary")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied ? "Copied" : repo.fullName}</TooltipContent>
        </Tooltip>
        <Button asChild variant="outline" size="icon" className="tap-target size-8 sm:size-7">
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`Open ${repo.fullName} on GitHub`}
          >
            <ArrowUpRight className="size-3.5" />
          </a>
        </Button>
      </div>

      <span className="sr-only">
        Growth snapshots are collected at most every{" "}
        {SNAPSHOT_MIN_INTERVAL_MINUTES} minutes.
      </span>
    </Card>
  );
}

export function RepoCardSkeleton() {
  return (
    <Card className="panel flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <div className="skeleton-shimmer size-9 rounded-md" />
        <div className="flex-1 space-y-2">
          <div className="skeleton-shimmer h-3.5 w-2/3 rounded" />
          <div className="skeleton-shimmer h-3 w-1/2 rounded" />
        </div>
      </div>
      <div className="skeleton-shimmer h-3.5 w-full rounded" />
      <div className="skeleton-shimmer h-3.5 w-4/5 rounded" />
      <div className="skeleton-shimmer h-5 w-40 rounded" />
      <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3">
        <div className="skeleton-shimmer h-3 w-20 rounded" />
        <div className="skeleton-shimmer h-3 w-24 rounded" />
      </div>
    </Card>
  );
}

export function RepoGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <RepoCardSkeleton key={index} />
      ))}
    </div>
  );
}
