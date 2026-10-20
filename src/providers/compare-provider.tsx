"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  readLocalValue,
  useLocalValue,
  writeLocalValue,
} from "@/lib/local-storage";
import { COMPARE_LIMIT, COMPARE_STORAGE_KEY } from "@/lib/constants";
import type { RepoSummary } from "@/lib/github/types";
import { useHydrated } from "@/hooks/use-hydrated";

export interface CompareItem {
  fullName: string;
  name: string;
  owner: string;
  avatarUrl: string;
  stars: number;
  language: string | null;
}

interface CompareContextValue {
  ready: boolean;
  items: CompareItem[];
  isSelected: (fullName: string) => boolean;
  toggle: (repo: RepoSummary) => void;
  remove: (fullName: string) => void;
  clear: () => void;
}

const CompareContext = React.createContext<CompareContextValue | null>(null);

const EMPTY_ITEMS: CompareItem[] = [];

function isCompareItem(value: unknown): value is CompareItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.fullName === "string" &&
    typeof item.name === "string" &&
    typeof item.owner === "string" &&
    typeof item.avatarUrl === "string" &&
    typeof item.stars === "number"
  );
}

function parseCompare(raw: string): CompareItem[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return EMPTY_ITEMS;
  return parsed.filter(isCompareItem).slice(0, COMPARE_LIMIT);
}

function serializeCompare(items: CompareItem[]): string {
  return JSON.stringify(items);
}

function currentItems(): CompareItem[] {
  return readLocalValue<CompareItem[]>(
    COMPARE_STORAGE_KEY,
    parseCompare,
    EMPTY_ITEMS,
  );
}

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const items = useLocalValue<CompareItem[]>(
    COMPARE_STORAGE_KEY,
    parseCompare,
    serializeCompare,
    EMPTY_ITEMS,
  );

  // False while server-rendering and during the hydration pass, true right
  // after the browser snapshot is available.
  const ready = useHydrated();

  const isSelected = React.useCallback(
    (fullName: string) => items.some((item) => item.fullName === fullName),
    [items],
  );

  const toggle = React.useCallback((repo: RepoSummary) => {
    const current = currentItems();

    if (current.some((item) => item.fullName === repo.fullName)) {
      writeLocalValue(
        COMPARE_STORAGE_KEY,
        current.filter((item) => item.fullName !== repo.fullName),
        serializeCompare,
      );
      return;
    }

    if (current.length >= COMPARE_LIMIT) {
      toast.error(`Compare is limited to ${COMPARE_LIMIT} repositories.`);
      return;
    }

    toast("Added to compare stack", {
      description: `${repo.fullName} · ${current.length + 1}/${COMPARE_LIMIT}`,
    });
    writeLocalValue(
      COMPARE_STORAGE_KEY,
      [
        ...current,
        {
          fullName: repo.fullName,
          name: repo.name,
          owner: repo.owner.login,
          avatarUrl: repo.owner.avatarUrl,
          stars: repo.stars,
          language: repo.language,
        },
      ],
      serializeCompare,
    );
  }, []);

  const remove = React.useCallback((fullName: string) => {
    const current = currentItems();
    writeLocalValue(
      COMPARE_STORAGE_KEY,
      current.filter((item) => item.fullName !== fullName),
      serializeCompare,
    );
  }, []);

  const clear = React.useCallback(() => {
    toast("Compare stack cleared");
    writeLocalValue(COMPARE_STORAGE_KEY, EMPTY_ITEMS, serializeCompare);
  }, []);

  const value = React.useMemo<CompareContextValue>(
    () => ({ ready, items, isSelected, toggle, remove, clear }),
    [ready, items, isSelected, toggle, remove, clear],
  );

  return (
    <CompareContext.Provider value={value}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare(): CompareContextValue {
  const context = React.useContext(CompareContext);
  if (!context) {
    throw new Error("useCompare must be used inside CompareProvider");
  }
  return context;
}
