"use client";

import * as React from "react";

/**
 * Tiny external store on top of `localStorage`.
 *
 * `useSyncExternalStore` provides a consistent server snapshot during hydration
 * and subscribes to browser storage changes afterwards.
 *
 * Values are cached per raw string so repeated `getSnapshot` calls keep the
 * same reference — a new object on every call would loop forever.
 */

interface CacheEntry {
  raw: string | null;
  value: unknown;
  sessionOnly?: boolean;
}

const cache = new Map<string, CacheEntry>();
const subscribers = new Map<string, Set<() => void>>();

function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function notify(key: string): void {
  const listeners = subscribers.get(key);
  if (!listeners) return;
  for (const listener of listeners) listener();
}

export function readLocalValue<T>(
  key: string,
  parse: (raw: string) => T,
  fallback: T,
): T {
  const raw = readRaw(key);
  const cached = cache.get(key);
  if (cached?.sessionOnly) return cached.value as T;
  if (cached && cached.raw === raw) return cached.value as T;

  let value = fallback;
  if (raw !== null) {
    try {
      value = parse(raw);
    } catch {
      value = fallback;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

export function writeLocalValue<T>(
  key: string,
  value: T,
  serialize: (value: T) => string,
): void {
  const raw = serialize(value);
  let sessionOnly = false;
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // Storage can be unavailable in private mode; the session still works.
    sessionOnly = true;
  }

  cache.set(key, { raw, value, sessionOnly });
  notify(key);
}

export function subscribeLocalValue(
  key: string,
  onChange: () => void,
): () => void {
  let listeners = subscribers.get(key);
  if (!listeners) {
    listeners = new Set();
    subscribers.set(key, listeners);
  }
  listeners.add(onChange);

  // Keep other tabs of the same browser in sync.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === key) onChange();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    listeners?.delete(onChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function useLocalValue<T>(
  key: string,
  parse: (raw: string) => T,
  serialize: (value: T) => string,
  fallback: T,
): T {
  const subscribe = React.useCallback(
    (onChange: () => void) => subscribeLocalValue(key, onChange),
    [key],
  );
  const getSnapshot = React.useCallback(
    () => readLocalValue(key, parse, fallback),
    [key, parse, fallback],
  );
  const getServerSnapshot = React.useCallback(() => fallback, [fallback]);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
