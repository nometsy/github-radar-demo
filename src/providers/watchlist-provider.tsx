"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  readLocalValue,
  useLocalValue,
  writeLocalValue,
} from "@/lib/local-storage";
import { WATCHLIST_STORAGE_KEY } from "@/lib/constants";
import type { RepoSummary } from "@/lib/github/types";
import { useHydrated } from "@/hooks/use-hydrated";

const COLLECTION_COLORS = [
  "#00ff9c",
  "#00d9ff",
  "#9b8cff",
  "#ffcc66",
  "#ff6b9a",
];

export interface WatchlistEntry {
  fullName: string;
  repo: RepoSummary;
  savedAt: string;
  favorite: boolean;
  collections: string[];
}

export interface WatchlistCollection {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

interface WatchlistData {
  version: 1;
  entries: Record<string, WatchlistEntry>;
  collections: WatchlistCollection[];
}

interface WatchlistContextValue {
  ready: boolean;
  entries: WatchlistEntry[];
  collections: WatchlistCollection[];
  isSaved: (fullName: string) => boolean;
  isFavorite: (fullName: string) => boolean;
  toggleSave: (repo: RepoSummary) => void;
  remove: (fullName: string) => void;
  toggleFavorite: (fullName: string) => void;
  createCollection: (name: string) => WatchlistCollection | null;
  deleteCollection: (id: string) => void;
  toggleCollection: (fullName: string, collectionId: string) => void;
}

const WatchlistContext = React.createContext<WatchlistContextValue | null>(
  null,
);

const EMPTY_DATA: WatchlistData = {
  version: 1,
  entries: {},
  collections: [],
};

function emptyData(): WatchlistData {
  return { version: 1, entries: {}, collections: [] };
}

function resumeData(value: unknown): WatchlistData {
  if (typeof value !== "object" || value === null) return emptyData();
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1) return emptyData();

  const entries: Record<string, WatchlistEntry> = {};
  if (typeof candidate.entries === "object" && candidate.entries !== null) {
    for (const [key, value] of Object.entries(
      candidate.entries as Record<string, unknown>,
    )) {
      if (typeof value !== "object" || value === null) continue;
      const entry = value as Record<string, unknown>;
      const repo = entry.repo as Record<string, unknown> | undefined;
      if (
        typeof entry.fullName !== "string" ||
        typeof entry.savedAt !== "string" ||
        !repo ||
        typeof repo.fullName !== "string" ||
        typeof repo.name !== "string" ||
        typeof repo.stars !== "number" ||
        typeof repo.htmlUrl !== "string" ||
        typeof repo.owner !== "object" ||
        repo.owner === null
      ) {
        continue;
      }
      entries[key] = {
        fullName: entry.fullName,
        savedAt: entry.savedAt,
        favorite: entry.favorite === true,
        collections: Array.isArray(entry.collections)
          ? entry.collections.filter(
              (id): id is string => typeof id === "string",
            )
          : [],
        repo: repo as unknown as RepoSummary,
      };
    }
  }

  const collections: WatchlistCollection[] = [];
  if (Array.isArray(candidate.collections)) {
    for (const value of candidate.collections) {
      if (typeof value !== "object" || value === null) continue;
      const collection = value as Record<string, unknown>;
      if (
        typeof collection.id === "string" &&
        typeof collection.name === "string" &&
        typeof collection.color === "string" &&
        typeof collection.createdAt === "string"
      ) {
        collections.push({
          id: collection.id,
          name: collection.name,
          color: collection.color,
          createdAt: collection.createdAt,
        });
      }
    }
  }

  return { version: 1, entries, collections };
}

function parseWatchlist(raw: string): WatchlistData {
  return resumeData(JSON.parse(raw) as unknown);
}

function serializeWatchlist(value: WatchlistData): string {
  return JSON.stringify(value);
}

function currentData(): WatchlistData {
  return readLocalValue<WatchlistData>(
    WATCHLIST_STORAGE_KEY,
    parseWatchlist,
    EMPTY_DATA,
  );
}

function commit(next: WatchlistData): void {
  writeLocalValue(WATCHLIST_STORAGE_KEY, next, serializeWatchlist);
}

export function WatchlistProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = useLocalValue<WatchlistData>(
    WATCHLIST_STORAGE_KEY,
    parseWatchlist,
    serializeWatchlist,
    EMPTY_DATA,
  );
  // False while server-rendering and during the hydration pass, true right
  // after the browser snapshot is available.
  const ready = useHydrated();

  const entries = React.useMemo(
    () =>
      Object.values(data.entries).sort(
        (a, b) =>
          new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
      ),
    [data.entries],
  );

  const isSaved = React.useCallback(
    (fullName: string) => Boolean(data.entries[fullName]),
    [data.entries],
  );

  const isFavorite = React.useCallback(
    (fullName: string) => data.entries[fullName]?.favorite === true,
    [data.entries],
  );

  const toggleSave = React.useCallback((repo: RepoSummary) => {
    const current = currentData();
    const existing = current.entries[repo.fullName];

    if (existing) {
      const nextEntries = { ...current.entries };
      delete nextEntries[repo.fullName];
      toast("Removed from watchlist", { description: repo.fullName });
      commit({ ...current, entries: nextEntries });
      return;
    }

    const entry: WatchlistEntry = {
      fullName: repo.fullName,
      repo,
      savedAt: new Date().toISOString(),
      favorite: false,
      collections: [],
    };
    toast("Saved to watchlist", {
      description: `${repo.fullName} is now being tracked locally.`,
    });
    commit({
      ...current,
      entries: { ...current.entries, [repo.fullName]: entry },
    });
  }, []);

  const remove = React.useCallback((fullName: string) => {
    const current = currentData();
    if (!current.entries[fullName]) return;
    const next = { ...current.entries };
    delete next[fullName];
    toast("Removed from watchlist", { description: fullName });
    commit({ ...current, entries: next });
  }, []);

  const toggleFavorite = React.useCallback((fullName: string) => {
    const current = currentData();
    const entry = current.entries[fullName];
    if (!entry) return;
    const favorite = !entry.favorite;
    toast(favorite ? "Pinned as favorite" : "Unpinned", {
      description: fullName,
    });
    commit({
      ...current,
      entries: {
        ...current.entries,
        [fullName]: { ...entry, favorite },
      },
    });
  }, []);

  const createCollection = React.useCallback(
    (name: string): WatchlistCollection | null => {
      const trimmed = name.trim().slice(0, 40);
      if (!trimmed) return null;

      const current = currentData();
      if (
        current.collections.some(
          (collection) =>
            collection.name.toLowerCase() === trimmed.toLowerCase(),
        )
      ) {
        toast.error("A collection with that name already exists.");
        return null;
      }

      const collection: WatchlistCollection = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `col-${Date.now()}`,
        name: trimmed,
        color:
          COLLECTION_COLORS[current.collections.length % COLLECTION_COLORS.length],
        createdAt: new Date().toISOString(),
      };
      toast("Collection created", { description: trimmed });
      commit({
        ...current,
        collections: [...current.collections, collection],
      });
      return collection;
    },
    [],
  );

  const deleteCollection = React.useCallback((id: string) => {
    const current = currentData();
    const entries = Object.fromEntries(
      Object.entries(current.entries).map(([key, entry]) => [
        key,
        {
          ...entry,
          collections: entry.collections.filter(
            (collectionId) => collectionId !== id,
          ),
        },
      ]),
    );
    toast("Collection deleted");
    commit({
      ...current,
      entries,
      collections: current.collections.filter(
        (collection) => collection.id !== id,
      ),
    });
  }, []);

  const toggleCollection = React.useCallback(
    (fullName: string, collectionId: string) => {
      const current = currentData();
      const entry = current.entries[fullName];
      if (!entry) return;
      const exists = entry.collections.includes(collectionId);
      commit({
        ...current,
        entries: {
          ...current.entries,
          [fullName]: {
            ...entry,
            collections: exists
              ? entry.collections.filter((id) => id !== collectionId)
              : [...entry.collections, collectionId],
          },
        },
      });
    },
    [],
  );

  const value = React.useMemo<WatchlistContextValue>(
    () => ({
      ready,
      entries,
      collections: data.collections,
      isSaved,
      isFavorite,
      toggleSave,
      remove,
      toggleFavorite,
      createCollection,
      deleteCollection,
      toggleCollection,
    }),
    [
      ready,
      entries,
      data.collections,
      isSaved,
      isFavorite,
      toggleSave,
      remove,
      toggleFavorite,
      createCollection,
      deleteCollection,
      toggleCollection,
    ],
  );

  return (
    <WatchlistContext.Provider value={value}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist(): WatchlistContextValue {
  const context = React.useContext(WatchlistContext);
  if (!context) {
    throw new Error("useWatchlist must be used inside WatchlistProvider");
  }
  return context;
}
