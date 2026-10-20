import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

export const PERSISTED_CACHE_VERSION = 1;
export const MAX_PERSISTED_ENTRIES = 200;
const MAX_KEY_LENGTH = 512;
const MAX_ENTRY_BYTES = 256_000;
const MAX_FILE_BYTES = 8_000_000;

export interface PersistedCacheEntry {
  data: unknown;
  fetchedAt: string;
  expiresAt: number;
  staleUntil: number;
}

const entrySchema = z.object({
  data: z.unknown(),
  fetchedAt: z.string(),
  expiresAt: z.number().finite(),
  staleUntil: z.number().finite(),
});

const fileSchema = z.object({
  version: z.literal(PERSISTED_CACHE_VERSION),
  entries: z.record(z.string(), entrySchema),
});

function newestFirst(
  a: [string, PersistedCacheEntry],
  b: [string, PersistedCacheEntry],
): number {
  return Date.parse(b[1].fetchedAt) - Date.parse(a[1].fetchedAt);
}

function serializedDataSize(entry: PersistedCacheEntry): number {
  try {
    return JSON.stringify(entry.data).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Validates a cache file and drops entries whose stale window has passed.
 * Corrupt files degrade to an empty cache instead of breaking requests.
 */
export function parsePersistedCache(
  raw: string,
  now: number,
  maxEntries = MAX_PERSISTED_ENTRIES,
): Map<string, PersistedCacheEntry> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return new Map();
  }

  const parsed = fileSchema.safeParse(parsedJson);
  if (!parsed.success) return new Map();

  const entries = Object.entries(parsed.data.entries)
    .filter(
      ([key, entry]) =>
        key.length > 0 &&
        key.length <= MAX_KEY_LENGTH &&
        Number.isFinite(entry.staleUntil) &&
        entry.staleUntil > now,
    )
    .sort(newestFirst)
    .slice(0, Math.max(0, maxEntries));

  return new Map(entries);
}

export function serializePersistedCache(
  entries: Iterable<[string, PersistedCacheEntry]>,
  now = Date.now(),
  maxEntries = MAX_PERSISTED_ENTRIES,
): string {
  const bounded = [...entries]
    .filter(([key]) => key.length > 0 && key.length <= MAX_KEY_LENGTH)
    .sort(newestFirst)
    .slice(0, Math.max(0, maxEntries));

  const selected: [string, PersistedCacheEntry][] = [];
  let bytes = 0;
  for (const candidate of bounded) {
    const size = serializedDataSize(candidate[1]);
    if (!Number.isFinite(size) || size > MAX_ENTRY_BYTES) continue;
    if (bytes + size > MAX_FILE_BYTES) continue;
    selected.push(candidate);
    bytes += size;
  }

  return JSON.stringify({
    version: PERSISTED_CACHE_VERSION,
    savedAt: new Date(now).toISOString(),
    entries: Object.fromEntries(selected),
  });
}

export async function loadPersistedCache(
  filePath: string,
  now = Date.now(),
  maxEntries = MAX_PERSISTED_ENTRIES,
): Promise<Map<string, PersistedCacheEntry>> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return parsePersistedCache(raw, now, maxEntries);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(
        "[github-radar] Could not read the persistent GitHub cache:",
        error instanceof Error ? error.message : error,
      );
    }
    return new Map();
  }
}

/** Writes atomically so a crash cannot leave a half-written JSON file. */
export async function savePersistedCache(
  filePath: string,
  entries: Iterable<[string, PersistedCacheEntry]>,
  now = Date.now(),
  maxEntries = MAX_PERSISTED_ENTRIES,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(
    temporary,
    serializePersistedCache(entries, now, maxEntries),
    "utf8",
  );
  await fs.rename(temporary, filePath);
}
