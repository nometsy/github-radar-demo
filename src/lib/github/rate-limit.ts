import type {
  RateLimitBucket,
  RateLimitSnapshot,
} from "@/lib/github/types";

type GitHubResource = "core" | "search";

interface RateLimitGlobal {
  __githubRadarRateLimit?: Partial<
    Record<GitHubResource, RateLimitBucket>
  >;
}

const globalStore = globalThis as typeof globalThis & RateLimitGlobal;

function parseHeaderInt(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function recordRateLimitHeaders(
  resource: GitHubResource,
  headers: Headers,
): void {
  const limit = parseHeaderInt(headers.get("x-ratelimit-limit"));
  const remaining = parseHeaderInt(headers.get("x-ratelimit-remaining"));
  const used = parseHeaderInt(headers.get("x-ratelimit-used"));
  const reset = parseHeaderInt(headers.get("x-ratelimit-reset"));

  if (limit === null && remaining === null) return;

  const previous = globalStore.__githubRadarRateLimit?.[resource];
  const bucket: RateLimitBucket = {
    resource,
    limit: limit ?? previous?.limit ?? 0,
    remaining: remaining ?? previous?.remaining ?? 0,
    used: used ?? previous?.used ?? 0,
    // GitHub sends x-ratelimit-reset as epoch seconds; the app stores epoch
    // milliseconds so Date-based formatting stays consistent.
    resetAt: reset !== null ? reset * 1000 : (previous?.resetAt ?? null),
    updatedAt: new Date().toISOString(),
  };

  globalStore.__githubRadarRateLimit = {
    ...globalStore.__githubRadarRateLimit,
    [resource]: bucket,
  };
}

export function recordRateLimitSnapshot(
  data: {
    core?: {
      limit: number;
      remaining: number;
      used: number;
      reset: number;
    };
    search?: {
      limit: number;
      remaining: number;
      used: number;
      reset: number;
    };
  },
): void {
  const now = new Date().toISOString();
  const next: Partial<Record<GitHubResource, RateLimitBucket>> = {
    ...globalStore.__githubRadarRateLimit,
  };

  for (const resource of ["core", "search"] as const) {
    const bucket = data[resource];
    if (!bucket) continue;
    next[resource] = {
      resource,
      limit: bucket.limit,
      remaining: bucket.remaining,
      used: bucket.used,
      // The /rate_limit payload reports reset as epoch seconds as well.
      resetAt: bucket.reset * 1000,
      updatedAt: now,
    };
  }

  globalStore.__githubRadarRateLimit = next;
}

export function getRateLimitSnapshot(): RateLimitSnapshot {
  return {
    core: globalStore.__githubRadarRateLimit?.core ?? null,
    search: globalStore.__githubRadarRateLimit?.search ?? null,
    tokenConfigured: Boolean(process.env.GITHUB_TOKEN?.trim()),
  };
}

export function getRateLimitBucket(
  resource: GitHubResource,
): RateLimitBucket | null {
  return globalStore.__githubRadarRateLimit?.[resource] ?? null;
}
