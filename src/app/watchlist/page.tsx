"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Download,
  FolderPlus,
  RefreshCw,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeading } from "@/components/radar/pagination";
import { RepoCard, RepoGridSkeleton } from "@/components/radar/repo-card";
import { EmptyState, InlineNote } from "@/components/radar/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { apiFetch, buildQuery } from "@/lib/api-client";
import type {
  BatchReposResponse,
  RepoWithGrowth,
  SnapshotMutationResponse,
} from "@/lib/api-types";
import { COMPARE_LIMIT } from "@/lib/constants";
import type { RepoGrowth } from "@/lib/radar/types";
import { cn, formatNumber, getErrorMessage, pluralize } from "@/lib/utils";
import { useWatchlist } from "@/providers/watchlist-provider";
import { useCompare } from "@/providers/compare-provider";

const BATCH_SIZE = 8;

function unavailableGrowth(): RepoGrowth {
  const base = {
    available: false as const,
    reason: "no_baseline" as const,
    starsGained: null,
    growthPct: null,
    momentum: null,
    intervalHours: null,
    baselineAt: null,
    latestAt: null,
    samples: 0,
  };
  return {
    "24h": { ...base, window: "24h" },
    "7d": { ...base, window: "7d" },
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export default function WatchlistPage() {
  const watchlist = useWatchlist();
  const compare = useCompare();
  const queryClient = useQueryClient();

  const [filter, setFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [newCollection, setNewCollection] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const names = React.useMemo(
    () => watchlist.entries.map((entry) => entry.fullName),
    [watchlist.entries],
  );

  const batch = useQuery({
    queryKey: ["watchlist-batch", names.join(",")],
    enabled: names.length > 0,
    queryFn: async ({ signal }) => {
      const groups = chunk(names, BATCH_SIZE);
      const responses = await Promise.all(
        groups.map((group) =>
          apiFetch<BatchReposResponse>(
            `/api/github/repos/batch${buildQuery({ names: group.join(",") })}`,
            { signal },
          ),
        ),
      );
      const map = new Map<string, RepoWithGrowth>();
      for (const response of responses) {
        for (const item of response.items) {
          if (item.repo) map.set(item.fullName, item.repo);
        }
      }
      return map;
    },
  });

  const collect = useMutation({
    mutationFn: async () => {
      const groups = chunk(names, BATCH_SIZE);
      let captured = 0;
      let skipped = 0;
      for (const group of groups) {
        const result = await apiFetch<SnapshotMutationResponse>(
          "/api/radar/snapshots",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repos: group }),
          },
        );
        captured += result.captured;
        skipped += result.skipped;
      }
      return { captured, skipped };
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["watchlist-batch"] });
      void queryClient.invalidateQueries({ queryKey: ["system-status"] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      toast.success("Watchlist snapshots recorded", {
        description: `${result.captured} captured · ${result.skipped} skipped`,
      });
    },
    onError: (error) => {
      toast.error("Snapshot run failed", {
        description: getErrorMessage(error),
      });
    },
  });

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return watchlist.entries.filter((entry) => {
      if (filter === "favorites" && !entry.favorite) return false;
      if (
        filter !== "all" &&
        filter !== "favorites" &&
        !entry.collections.includes(filter)
      ) {
        return false;
      }
      if (!term) return true;
      return (
        entry.fullName.toLowerCase().includes(term) ||
        (entry.repo.description ?? "").toLowerCase().includes(term) ||
        (entry.repo.language ?? "").toLowerCase().includes(term)
      );
    });
  }, [watchlist.entries, filter, search]);

  const exportJson = React.useCallback(() => {
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        source: "github-radar watchlist",
        note: "Repositories saved locally. Snapshots live on the server, not in this file.",
        entries: watchlist.entries,
        collections: watchlist.collections,
      },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `github-radar-watchlist-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [watchlist.collections, watchlist.entries]);

  const ready = watchlist.ready;

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Local watchlist"
        title="Repositories you are tracking"
        description="The watchlist lives entirely in this browser. Snapshot growth is read from the server store for every saved repository."
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
          Collect snapshots ({names.length} repos, {BATCH_SIZE} per request)
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={exportJson}
          disabled={watchlist.entries.length === 0}
        >
          <Download className="size-4" aria-hidden />
          Export
        </Button>
      </PageHeading>

      {ready && watchlist.entries.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter saved repositories…"
              className="h-9 w-full max-w-xs font-mono text-xs"
              aria-label="Filter watchlist"
            />

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilter("all")}
                aria-pressed={filter === "all"}
                className={cn(
                  "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                  filter === "all"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/70 text-muted-foreground hover:text-foreground",
                )}
              >
                ALL {watchlist.entries.length}
              </button>
              <button
                type="button"
                onClick={() => setFilter("favorites")}
                aria-pressed={filter === "favorites"}
                className={cn(
                  "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                  filter === "favorites"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/70 text-muted-foreground hover:text-foreground",
                )}
              >
                FAVORITES{" "}
                {watchlist.entries.filter((entry) => entry.favorite).length}
              </button>

              {watchlist.collections.map((collection) => (
                <span
                  key={collection.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                    filter === collection.id
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/70 text-muted-foreground",
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={filter === collection.id}
                    onClick={() => setFilter(collection.id)}
                    className="hover:text-foreground"
                  >
                    {collection.name.toUpperCase()}{" "}
                    {
                      watchlist.entries.filter((entry) =>
                        entry.collections.includes(collection.id),
                      ).length
                    }
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete collection ${collection.name}`}
                    className="text-muted-foreground hover:text-[color:var(--destructive)]"
                    onClick={() => watchlist.deleteCollection(collection.id)}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </span>
              ))}

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <FolderPlus className="size-3.5" aria-hidden />
                    New collection
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New collection</DialogTitle>
                    <DialogDescription>
                      Collections are stored locally and only group your saved
                      repositories.
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    value={newCollection}
                    onChange={(event) => setNewCollection(event.target.value)}
                    placeholder="e.g. Agents, Rust tooling"
                    maxLength={40}
                  />
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        const created = watchlist.createCollection(
                          newCollection,
                        );
                        if (created) {
                          setNewCollection("");
                          setDialogOpen(false);
                        }
                      }}
                      disabled={!newCollection.trim()}
                    >
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <p className="font-mono text-[11px] text-muted-foreground">
            showing {formatNumber(filtered.length)} of{" "}
            {formatNumber(watchlist.entries.length)}{" "}
            {pluralize(watchlist.entries.length, "repository")} · compare stack{" "}
            {compare.items.length}/{COMPARE_LIMIT}
          </p>
        </div>
      )}

      {ready && batch.isError && watchlist.entries.length > 0 && (
        <InlineNote tone="warning">
          Live GitHub data for saved repositories is unavailable right now (
          {getErrorMessage(batch.error)}). Cards below still show your local
          entries without fresh growth.
        </InlineNote>
      )}

      {ready && watchlist.entries.length === 0 && (
        <EmptyState
          icon={Star}
          title="Watchlist is empty"
          description="Save repositories from the dashboard, fresh, trending, AI or search pages. Saved entries stay in this browser and can be exported as JSON."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/trending">
                Find repositories to track
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
          }
        />
      )}

      {ready && watchlist.entries.length > 0 && filtered.length === 0 && (
        <EmptyState
          title="Nothing matches this filter"
          description="No saved repository matches the current search term or collection. Clear the filter to see everything again."
        />
      )}

      {ready && filtered.length > 0 && (
        <>
          {batch.isPending && <RepoGridSkeleton count={Math.min(filtered.length, 6)} />}

          {!batch.isPending && (
            <div className="space-y-4">
              {filtered.map((entry, index) => {
                const live = batch.data?.get(entry.fullName);
                const repo: RepoWithGrowth =
                  live ?? {
                    ...entry.repo,
                    growth: unavailableGrowth(),
                  };
                return (
                  <div key={entry.fullName} className="relative">
                    <RepoCard
                      repo={repo}
                      style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => watchlist.toggleFavorite(entry.fullName)}
                      >
                        {entry.favorite ? (
                          <>
                            <StarOff className="size-3.5" aria-hidden />
                            Unpin
                          </>
                        ) : (
                          <>
                            <Star className="size-3.5" aria-hidden />
                            Pin
                          </>
                        )}
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                          >
                            Collections
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuLabel>Add to collection</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {watchlist.collections.length === 0 && (
                            <DropdownMenuLabel className="font-normal text-muted-foreground">
                              No collections yet
                            </DropdownMenuLabel>
                          )}
                          {watchlist.collections.map((collection) => (
                            <DropdownMenuCheckboxItem
                              key={collection.id}
                              checked={entry.collections.includes(collection.id)}
                              onCheckedChange={() =>
                                watchlist.toggleCollection(
                                  entry.fullName,
                                  collection.id,
                                )
                              }
                            >
                              {collection.name}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-[color:var(--destructive)]"
                        onClick={() => watchlist.remove(entry.fullName)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Remove
                      </Button>

                      {entry.collections.map((collectionId) => {
                        const collection = watchlist.collections.find(
                          (candidate) => candidate.id === collectionId,
                        );
                        if (!collection) return null;
                        return (
                          <Badge
                            key={collectionId}
                            variant="outline"
                            className="font-mono text-[10px] font-normal"
                            style={{ borderColor: collection.color }}
                          >
                            {collection.name}
                          </Badge>
                        );
                      })}

                      <span className="font-mono text-[10px] text-muted-foreground">
                        saved {new Date(entry.savedAt).toISOString().slice(0, 10)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
