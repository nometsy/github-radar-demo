import nodePath from "node:path";
import type { ZodType } from "zod";
import { z } from "zod";
import { GitHubApiError } from "@/lib/github/errors";
import {
  loadPersistedCache,
  MAX_PERSISTED_ENTRIES,
  savePersistedCache,
  type PersistedCacheEntry,
} from "@/lib/github/persistent-cache";
import type { RateLimitBucket } from "@/lib/github/types";
import {
  getRateLimitBucket,
  recordRateLimitHeaders,
  recordRateLimitSnapshot,
} from "@/lib/github/rate-limit";
import {
  rawGitHubErrorSchema,
  rawRateLimitSchema,
} from "@/lib/github/schemas";
import { getDataDir } from "@/lib/data-dir";

const GITHUB_API = "https://api.github.com";
const USER_AGENT = "GitHub-Radar/1.0 (+https://github.com)";
const DEFAULT_SEARCH_TTL = 3 * 60_000;
const DEFAULT_CORE_TTL = 5 * 60_000;
const STALE_WINDOW = 12 * 60 * 60_000;
const MAX_CACHE_ENTRIES = MAX_PERSISTED_ENTRIES;
const CACHE_FILE = nodePath.join(getDataDir(), "github-cache.json");
const CACHE_SAVE_DEBOUNCE_MS = 750;

type GitHubResource = "core" | "search";
type CacheEntry = PersistedCacheEntry;

interface CacheGlobal {
  __githubRadarApiCache?: Map<string, CacheEntry>;
  __githubRadarCacheHydrated?: Promise<void>;
  __githubRadarCacheSaveTimer?: ReturnType<typeof setTimeout>;
}

const globalCache = globalThis as typeof globalThis & CacheGlobal;
const cache =
  globalCache.__githubRadarApiCache ??
  (globalCache.__githubRadarApiCache = new Map<string, CacheEntry>());

async function ensureCacheHydrated(): Promise<void> {
  if (!globalCache.__githubRadarCacheHydrated) {
    globalCache.__githubRadarCacheHydrated = loadPersistedCache(
      CACHE_FILE,
      Date.now(),
      MAX_CACHE_ENTRIES,
    ).then((persisted) => {
      for (const [key, entry] of persisted) {
        if (!cache.has(key)) cache.set(key, entry);
      }
      pruneCache();
    });
  }
  await globalCache.__githubRadarCacheHydrated;
}

function scheduleCacheSave(): void {
  if (globalCache.__githubRadarCacheSaveTimer) {
    clearTimeout(globalCache.__githubRadarCacheSaveTimer);
  }
  const timer = setTimeout(() => {
    globalCache.__githubRadarCacheSaveTimer = undefined;
    void savePersistedCache(CACHE_FILE, cache, Date.now(), MAX_CACHE_ENTRIES).catch(
      (error: unknown) => {
        console.error(
          "[github-radar] Could not persist the GitHub cache:",
          error instanceof Error ? error.message : error,
        );
      },
    );
  }, CACHE_SAVE_DEBOUNCE_MS);
  timer.unref?.();
  globalCache.__githubRadarCacheSaveTimer = timer;
}

export interface GitHubRequestOptions {
  resource?: GitHubResource;
  cacheTtlMs?: number;
  bypassCache?: boolean;
}

export interface GitHubResponseMeta {
  fetchedAt: string;
  cached: boolean;
  stale: boolean;
  rateLimit: RateLimitBucket | null;
}

export interface GitHubResponse<T> {
  data: T;
  meta: GitHubResponseMeta;
}

function currentRate(resource: GitHubResource): RateLimitBucket | null {
  return getRateLimitBucket(resource);
}

function pruneCache(): void {
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  const excess = cache.size - MAX_CACHE_ENTRIES;
  let removed = 0;
  for (const key of cache.keys()) {
    cache.delete(key);
    removed += 1;
    if (removed >= excess) break;
  }
}

function getCachedEntry(key: string): CacheEntry | undefined {
  return cache.get(key);
}

function staleResponse<T>(
  entry: CacheEntry,
  resource: GitHubResource,
): GitHubResponse<T> {
  return {
    data: entry.data as T,
    meta: {
      fetchedAt: entry.fetchedAt,
      cached: true,
      stale: true,
      rateLimit: currentRate(resource),
    },
  };
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAtFromHeaders(headers: Headers): string | null {
  const reset = Number.parseInt(headers.get("x-ratelimit-reset") ?? "", 10);
  if (Number.isFinite(reset)) {
    return new Date(reset * 1000).toISOString();
  }
  const retryAfter = Number.parseInt(headers.get("retry-after") ?? "", 10);
  if (Number.isFinite(retryAfter)) {
    return new Date(Date.now() + retryAfter * 1000).toISOString();
  }
  return null;
}

async function readUpstreamError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return "";
    const json = JSON.parse(text) as unknown;
    const parsed = rawGitHubErrorSchema.safeParse(json);
    return parsed.success ? (parsed.data.message ?? "") : "";
  } catch {
    return "";
  }
}

/**
 * Single gateway to api.github.com. It validates every payload, records rate
 * limit headers, retries transient failures once, and can serve a recent stale
 * copy when GitHub is unreachable or rate limited.
 */
export async function githubRequest<T>(
  schema: ZodType<T>,
  path: string,
  options: GitHubRequestOptions = {},
): Promise<GitHubResponse<T>> {
  const resource = options.resource ?? "core";
  const cacheTtlMs =
    options.cacheTtlMs ??
    (resource === "search" ? DEFAULT_SEARCH_TTL : DEFAULT_CORE_TTL);
  await ensureCacheHydrated();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const cacheKey = `${resource}:${normalizedPath}`;
  const now = Date.now();
  const existing = getCachedEntry(cacheKey);

  if (!options.bypassCache && existing && existing.expiresAt > now) {
    return {
      data: existing.data as T,
      meta: {
        fetchedAt: existing.fetchedAt,
        cached: true,
        stale: false,
        rateLimit: currentRate(resource),
      },
    };
  }

  const token = process.env.GITHUB_TOKEN?.trim();
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let lastError: unknown = null;
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${GITHUB_API}${normalizedPath}`, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });

      recordRateLimitHeaders(resource, response.headers);

      if (response.ok) {
        const json = (await response.json()) as unknown;
        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          console.error(
            "[github-radar] GitHub payload failed validation:",
            z.prettifyError(parsed.error).slice(0, 1_200),
          );
          throw new GitHubApiError("GitHub returned an unexpected payload.", {
            code: "INVALID_RESPONSE",
            status: 502,
          });
        }

        const fetchedAt = new Date().toISOString();
        const expiresAt = Date.now() + cacheTtlMs;
        cache.set(cacheKey, {
          data: parsed.data,
          fetchedAt,
          expiresAt,
          staleUntil: expiresAt + STALE_WINDOW,
        });
        pruneCache();
        scheduleCacheSave();

        return {
          data: parsed.data,
          meta: {
            fetchedAt,
            cached: false,
            stale: false,
            rateLimit: currentRate(resource),
          },
        };
      }

      const remaining = Number.parseInt(
        response.headers.get("x-ratelimit-remaining") ?? "",
        10,
      );
      const message = await readUpstreamError(response);
      const retryAt = retryAtFromHeaders(response.headers);

      if (response.status === 404) {
        throw new GitHubApiError("GitHub resource not found.", {
          code: "NOT_FOUND",
          status: 404,
        });
      }

      if (response.status === 401) {
        throw new GitHubApiError("GitHub rejected the token.", {
          code: "UNAUTHORIZED",
          status: 401,
        });
      }

      const isRateLimited =
        response.status === 429 ||
        (response.status === 403 &&
          (remaining === 0 || /rate limit/i.test(message)));

      if (isRateLimited) {
        // GitHub sometimes returns a secondary-limit 403 while the primary
        // budget is not empty. A single short retry covers that case.
        if (
          attempt < maxAttempts &&
          remaining !== 0 &&
          response.status === 403
        ) {
          await delay(1_000);
          lastError = new GitHubApiError(
            "GitHub secondary rate limit.",
            { code: "RATE_LIMITED", status: 429, retryAt },
          );
          continue;
        }

        throw new GitHubApiError(
          "GitHub API rate limit reached.",
          {
            code: "RATE_LIMITED",
            status: 429,
            retryAt,
          },
        );
      }

      if (response.status === 403) {
        throw new GitHubApiError(
          message || "GitHub forbade the request.",
          { code: "FORBIDDEN", status: 403, retryAt },
        );
      }

      if (response.status >= 500 && attempt < maxAttempts) {
        lastError = new GitHubApiError(
          "GitHub is temporarily unavailable.",
          { code: "UPSTREAM", status: 502 },
        );
        await delay(500 * attempt);
        continue;
      }

      throw new GitHubApiError(
        message || `GitHub responded with HTTP ${response.status}.`,
        { code: "UPSTREAM", status: 502 },
      );
    } catch (error) {
      lastError = error;

      if (error instanceof GitHubApiError) {
        if (error.code === "NOT_FOUND" || error.code === "UNAUTHORIZED") {
          throw error;
        }
        if (
          error.code === "RATE_LIMITED" ||
          error.code === "FORBIDDEN" ||
          error.code === "INVALID_RESPONSE"
        ) {
          break;
        }
      }

      if (attempt < maxAttempts) {
        await delay(500 * attempt);
        continue;
      }

      if (error instanceof DOMException && error.name === "TimeoutError") {
        lastError = new GitHubApiError("GitHub request timed out.", {
          code: "TIMEOUT",
          status: 504,
        });
      } else if (!(error instanceof GitHubApiError)) {
        lastError = new GitHubApiError("Could not reach GitHub.", {
          code: "NETWORK",
          status: 502,
          cause: error,
        });
      }
    }
  }

  // A recent snapshot of the same exact query is better than an empty screen.
  if (existing && existing.staleUntil > Date.now()) {
    return staleResponse<T>(existing, resource);
  }

  if (lastError instanceof GitHubApiError) throw lastError;

  throw new GitHubApiError("Could not load data from GitHub.", {
    code: "UPSTREAM",
    status: 502,
    cause: lastError,
  });
}

export async function fetchGitHubRateLimit(): Promise<
  GitHubResponse<z.infer<typeof rawRateLimitSchema>>
> {
  const result = await githubRequest(rawRateLimitSchema, "/rate_limit", {
    resource: "core",
    cacheTtlMs: 60_000,
  });
  recordRateLimitSnapshot(result.data.resources);
  return result;
}
