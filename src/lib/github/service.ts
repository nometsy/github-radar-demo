import type {
  BatchReposResponse,
  DashboardResponse,
  LeaderboardResponse,
  RepoDetailResponse,
  RepoWithGrowth,
  RepositoriesResponse,
  ResponseMeta,
  SnapshotMutationResponse,
  SystemResponse,
} from "@/lib/api-types";
import { APP_NAME, APP_VERSION } from "@/lib/constants";
import { getServerEnv } from "@/lib/env";
import { GitHubApiError } from "@/lib/github/errors";
import { fetchGitHubRateLimit, githubRequest } from "@/lib/github/client";
import type {
  RateLimitSnapshot,
  ReadmePayload,
  ReleaseSummary,
  RepoDetails,
  RepoSummary,
} from "@/lib/github/types";
import {
  rawLanguagesSchema,
  rawReadmeSchema,
  rawReleasesSchema,
  rawRepoBaseSchema,
  rawRepoDetailsSchema,
  rawSearchResponseSchema,
} from "@/lib/github/schemas";
import {
  normalizeLanguages,
  normalizeReadme,
  normalizeRelease,
  normalizeRepo,
  normalizeRepoDetails,
} from "@/lib/github/normalize";
import {
  buildDashboardLensQuery,
  buildFreshQuery,
  buildNewTodayQuery,
  buildSmartSearchQuery,
  buildTrendingQuery,
  getTrendingLane,
  mapSearchSort,
} from "@/lib/github/query";
import { getRateLimitBucket, getRateLimitSnapshot } from "@/lib/github/rate-limit";
import type {
  FeedLens,
  FreshSort,
  SmartSearchSort,
  TrendingLaneId,
} from "@/lib/constants";
import { AI_CATEGORIES } from "@/lib/constants";
import { computeRepoGrowth } from "@/lib/radar/growth";
import { getSnapshotStore } from "@/lib/radar/store";
import type { SnapshotStore } from "@/lib/radar/store-types";
import type {
  GrowthMetrics,
  GrowthWindow,
  LeaderboardEntry,
  RepoGrowth,
  SnapshotHistory,
  SnapshotStatus,
} from "@/lib/radar/types";
import { buildSparkline } from "@/lib/radar/sparkline";
import { formatDate } from "@/lib/utils";

const SEARCH_RESULT_WINDOW = 1_000;
const MAX_PAGE = 50;
const DEFAULT_NOTE =
  "GitHub Search is best-effort: it does not index every repository instantly, and the result window is capped at 1,000 items.";

function pageCount(totalCount: number, perPage: number): number {
  return Math.max(
    1,
    Math.min(
      Math.ceil(totalCount / perPage),
      Math.floor(SEARCH_RESULT_WINDOW / perPage),
      MAX_PAGE,
    ),
  );
}

function responseMeta(
  result: {
    meta: {
      fetchedAt: string;
      cached: boolean;
      stale: boolean;
      rateLimit: RateLimitSnapshot["core"];
    };
  },
  note?: string,
): ResponseMeta {
  return {
    fetchedAt: result.meta.fetchedAt,
    cached: result.meta.cached,
    stale: result.meta.stale,
    rateLimit: result.meta.rateLimit,
    ...(note ? { note } : {}),
  };
}

function emptyGrowth(now = Date.now()): RepoGrowth {
  return computeRepoGrowth([], now);
}

async function safeStore(): Promise<SnapshotStore | null> {
  try {
    return await getSnapshotStore();
  } catch (error) {
    console.error("[github-radar] Snapshot store unavailable:", error);
    return null;
  }
}

async function captureSnapshots(items: RepoSummary[]): Promise<void> {
  if (items.length === 0) return;
  try {
    const store = await getSnapshotStore();
    await store.recordRepositories(items.slice(0, 60));
  } catch (error) {
    console.error("[github-radar] Could not record snapshots:", error);
  }
}

async function attachGrowth(
  items: RepoSummary[],
  now = new Date(),
): Promise<RepoWithGrowth[]> {
  const store = await safeStore();
  if (!store) {
    return items.map((repo) => ({ ...repo, growth: emptyGrowth(now.getTime()) }));
  }

  try {
    const names = items.map((repo) => repo.fullName);
    const [growth, histories] = await Promise.all([
      store.getRepoGrowth(names, now),
      store.getHistories(names, now).catch((error: unknown) => {
        console.error("[github-radar] Could not read sparkline history:", error);
        return new Map<string, SnapshotHistory>();
      }),
    ]);
    return items.map((repo) => {
      const sparkline = buildSparkline(histories.get(repo.fullName)?.points ?? []);
      return {
        ...repo,
        growth: growth.get(repo.fullName) ?? emptyGrowth(now.getTime()),
        ...(sparkline ? { sparkline } : {}),
      };
    });
  } catch (error) {
    console.error("[github-radar] Could not read growth:", error);
    return items.map((repo) => ({ ...repo, growth: emptyGrowth(now.getTime()) }));
  }
}

async function getStatusSafe(now = new Date()): Promise<SnapshotStatus> {
  const env = getServerEnv();
  const store = await safeStore();
  if (!store) {
    return {
      driver: env.storageDriver,
      trackedRepos: 0,
      snapshotCount: 0,
      starsTracked: 0,
      oldestSnapshotAt: null,
      newestSnapshotAt: null,
      available24h: 0,
      available7d: 0,
      writable: false,
      note: "Snapshot storage is unavailable. Live GitHub search still works; growth metrics are paused.",
    };
  }

  try {
    return await store.getStatus(now);
  } catch (error) {
    console.error("[github-radar] Could not read snapshot status:", error);
    return {
      driver: store.driver,
      trackedRepos: 0,
      snapshotCount: 0,
      starsTracked: 0,
      oldestSnapshotAt: null,
      newestSnapshotAt: null,
      available24h: 0,
      available7d: 0,
      writable: false,
      note: "Snapshot storage returned an error. Growth metrics are temporarily paused.",
    };
  }
}

interface SearchPage {
  items: RepoWithGrowth[];
  totalCount: number;
  incompleteResults: boolean;
  page: number;
  perPage: number;
  pageCount: number;
  query: string;
  meta: ResponseMeta;
  rawItems: RepoSummary[];
}

async function searchRepositories(input: {
  query: string;
  sort: "stars" | "forks" | "updated" | null;
  order: "desc" | null;
  page: number;
  perPage: number;
  bypassCache?: boolean;
  note?: string;
  /** Overrides the default 3 minute search cache. */
  cacheTtlMs?: number;
}): Promise<SearchPage> {
  const params = new URLSearchParams({
    q: input.query,
    page: String(input.page),
    per_page: String(input.perPage),
  });
  if (input.sort) params.set("sort", input.sort);
  if (input.order) params.set("order", input.order);

  const result = await githubRequest(
    rawSearchResponseSchema,
    `/search/repositories?${params.toString()}`,
    {
      resource: "search",
      bypassCache: input.bypassCache,
      ...(input.cacheTtlMs ? { cacheTtlMs: input.cacheTtlMs } : {}),
    },
  );

  const rawItems = result.data.items
    .map((item) => {
      try {
        return normalizeRepo(item);
      } catch (error) {
        console.error("[github-radar] Skipped malformed repository:", error);
        return null;
      }
    })
    .filter((repo): repo is RepoSummary => repo !== null);

  await captureSnapshots(rawItems);
  const items = await attachGrowth(rawItems);

  const pages = pageCount(result.data.total_count, input.perPage);
  const cappedNote =
    result.data.total_count > SEARCH_RESULT_WINDOW
      ? "GitHub's search API exposes at most 1,000 results per query; totals are still useful as a directional count."
      : undefined;
  const note = [input.note, DEFAULT_NOTE, cappedNote].filter(Boolean).join(" ");

  return {
    items,
    totalCount: result.data.total_count,
    incompleteResults: result.data.incomplete_results,
    page: input.page,
    perPage: input.perPage,
    pageCount: pages,
    query: input.query,
    meta: responseMeta(result, note || undefined),
    rawItems,
  };
}

export async function getDashboardData(input: {
  lens: FeedLens;
  bypassCache?: boolean;
  now?: Date;
}): Promise<DashboardResponse> {
  const now = input.now ?? new Date();
  const lens = buildDashboardLensQuery(input.lens, now.getTime());
  const todayQuery = buildNewTodayQuery(now);
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const [feedResult, todayResult] = await Promise.allSettled([
    searchRepositories({
      query: lens.query,
      sort: lens.sort,
      order: "desc",
      page: 1,
      perPage: 12,
      bypassCache: input.bypassCache,
    }),
    searchRepositories({
      query: todayQuery,
      sort: null,
      order: null,
      page: 1,
      perPage: 1,
      bypassCache: input.bypassCache,
      // The daily counter moves slowly. A long cache keeps the anonymous
      // search quota (10 requests/minute) for the actual feed.
      cacheTtlMs: 10 * 60_000,
    }),
  ]);

  if (feedResult.status === "rejected") throw feedResult.reason;

  const feed = feedResult.value;
  const newToday =
    todayResult.status === "fulfilled"
      ? todayResult.value.totalCount
      : null;
  const status = await getStatusSafe(now);

  const notes = [feed.meta.note];
  if (newToday === null) {
    notes.push("The new-repositories count is temporarily unavailable.");
  }

  const repositories: RepositoriesResponse = {
    items: feed.items,
    totalCount: feed.totalCount,
    incompleteResults: feed.incompleteResults,
    page: feed.page,
    perPage: feed.perPage,
    pageCount: feed.pageCount,
    query: feed.query,
    meta: {
      ...feed.meta,
      note: notes.filter(Boolean).join(" ") || undefined,
    },
  };

  return {
    stats: {
      newToday,
      newTodaySince: todayStart.toISOString(),
      trendingCount: feed.totalCount,
      trendingWindowLabel: lens.windowLabel,
      measuredGrowers24h: status.available24h,
      starsTracked: status.starsTracked,
      reposTracked: status.trackedRepos,
      snapshotsTracked: status.snapshotCount,
    },
    feed: repositories,
    status,
  };
}

export async function getFreshRepositories(input: {
  hours: number;
  language: string;
  minStars: number;
  minForks: number;
  topic: string;
  sort: FreshSort;
  page: number;
  perPage: number;
  bypassCache?: boolean;
  now?: Date;
}): Promise<RepositoriesResponse> {
  const now = input.now ?? new Date();
  const query = buildFreshQuery({
    hours: input.hours,
    language: input.language || undefined,
    minStars: input.minStars,
    minForks: input.minForks,
    topic: input.topic || undefined,
    now: now.getTime(),
  });
  const sort = mapSearchSort(input.sort as SmartSearchSort);
  const windowLabel = describeFreshWindow(input.hours);
  const result = await searchRepositories({
    query,
    sort: sort.sort ?? "stars",
    order: "desc",
    page: input.page,
    perPage: input.perPage,
    bypassCache: input.bypassCache,
    note: `Created since ${formatDate(new Date(now.getTime() - input.hours * 3_600_000))} UTC · ${windowLabel}. GitHub sorts by total stars, so the newest projects climb up as they collect their first stars.`,
  });

  return {
    items: result.items,
    totalCount: result.totalCount,
    incompleteResults: result.incompleteResults,
    page: result.page,
    perPage: result.perPage,
    pageCount: result.pageCount,
    query: result.query,
    meta: result.meta,
  };
}

export function describeFreshWindow(hours: number): string {
  if (hours < 24) return `last ${hours} hours`;
  const days = Math.round(hours / 24);
  return `last ${days} ${days === 1 ? "day" : "days"}`;
}

export async function getTrendingRepositories(input: {
  lane: TrendingLaneId;
  page: number;
  perPage: number;
  bypassCache?: boolean;
  now?: Date;
}): Promise<RepositoriesResponse> {
  const now = input.now ?? new Date();
  const lane = getTrendingLane(input.lane);
  const query = buildTrendingQuery(lane, now.getTime());
  const result = await searchRepositories({
    query,
    sort: lane.sort,
    order: "desc",
    page: input.page,
    perPage: input.perPage,
    bypassCache: input.bypassCache,
    note: lane.methodology,
  });

  let items = result.items;
  if (lane.velocitySort) {
    items = [...items].sort((a, b) => {
      const ageA = Math.max(1, (now.getTime() - new Date(a.createdAt).getTime()) / 86_400_000);
      const ageB = Math.max(1, (now.getTime() - new Date(b.createdAt).getTime()) / 86_400_000);
      return b.stars / ageB - a.stars / ageA;
    });
  }

  return {
    items,
    totalCount: result.totalCount,
    incompleteResults: result.incompleteResults,
    page: result.page,
    perPage: result.perPage,
    pageCount: result.pageCount,
    query: result.query,
    meta: {
      ...result.meta,
      note: [lane.methodology, result.meta.note].filter(Boolean).join(" "),
    },
  };
}

export async function getAiRepositories(input: {
  category: string;
  q: string;
  sort: "stars" | "updated";
  page: number;
  perPage: number;
  bypassCache?: boolean;
  now?: Date;
}): Promise<RepositoriesResponse> {
  const category =
    AI_CATEGORIES.find((entry) => entry.id === input.category) ??
    AI_CATEGORIES[0];

  const query = buildAiQuery(category.query, input.q);
  const sort = mapSearchSort(input.sort);
  let result = await searchRepositories({
    query,
    sort: sort.sort ?? "stars",
    order: "desc",
    page: input.page,
    perPage: input.perPage,
    bypassCache: input.bypassCache,
    note: category.description,
  });

  if (
    result.totalCount === 0 &&
    category.fallbackQuery &&
    process.env.NODE_ENV !== "test"
  ) {
    const fallback = buildAiQuery(category.fallbackQuery, input.q);
    result = await searchRepositories({
      query: fallback,
      sort: sort.sort ?? "stars",
      order: "desc",
      page: input.page,
      perPage: input.perPage,
      bypassCache: input.bypassCache,
      note: "Primary topic had no matches; showing a keyword fallback.",
    });
  }

  return {
    items: result.items,
    totalCount: result.totalCount,
    incompleteResults: result.incompleteResults,
    page: result.page,
    perPage: result.perPage,
    pageCount: result.pageCount,
    query: result.query,
    meta: result.meta,
  };
}

function buildAiQuery(baseQuery: string, keywords: string): string {
  const cleanKeywords = keywords.trim();
  if (!cleanKeywords) {
    return baseQuery.includes("fork:")
      ? baseQuery
      : `${baseQuery} fork:false archived:false`;
  }
  const inFields = /in:/.test(cleanKeywords)
    ? ""
    : " in:name,description,readme";
  return `${baseQuery} ${cleanKeywords}${inFields} fork:false archived:false`;
}

export async function getSmartSearchResults(input: {
  q: string;
  language: string;
  minStars: number;
  topic: string;
  createdDays: number;
  sort: SmartSearchSort;
  page: number;
  perPage: number;
  bypassCache?: boolean;
  now?: Date;
}): Promise<RepositoriesResponse> {
  const query = buildSmartSearchQuery({
    q: input.q,
    language: input.language || undefined,
    minStars: input.minStars,
    topic: input.topic || undefined,
    createdDays: input.createdDays,
    now: input.now?.getTime(),
  });
  const sort = mapSearchSort(input.sort);
  const result = await searchRepositories({
    query,
    sort: sort.sort,
    order: sort.order,
    page: input.page,
    perPage: input.perPage,
    bypassCache: input.bypassCache,
  });

  return {
    items: result.items,
    totalCount: result.totalCount,
    incompleteResults: result.incompleteResults,
    page: result.page,
    perPage: result.perPage,
    pageCount: result.pageCount,
    query: result.query,
    meta: result.meta,
  };
}

export async function getRepoDetails(input: {
  owner: string;
  name: string;
  bypassCache?: boolean;
  now?: Date;
}): Promise<RepoDetailResponse> {
  const owner = encodeURIComponent(input.owner);
  const name = encodeURIComponent(input.name);
  const basePath = `/repos/${owner}/${name}`;
  const now = input.now ?? new Date();

  const detailsPromise = githubRequest(rawRepoDetailsSchema, basePath, {
    resource: "core",
    cacheTtlMs: 10 * 60_000,
    bypassCache: input.bypassCache,
  });
  const languagesPromise = githubRequest(rawLanguagesSchema, `${basePath}/languages`, {
    resource: "core",
    cacheTtlMs: 30 * 60_000,
    bypassCache: input.bypassCache,
  });
  const releasesPromise = githubRequest(
    rawReleasesSchema,
    `${basePath}/releases?per_page=8`,
    {
      resource: "core",
      cacheTtlMs: 15 * 60_000,
      bypassCache: input.bypassCache,
    },
  );
  const readmePromise = githubRequest(rawReadmeSchema, `${basePath}/readme`, {
    resource: "core",
    cacheTtlMs: 30 * 60_000,
    bypassCache: input.bypassCache,
  });

  const [detailsResult, languagesResult, releasesResult, readmeResult] =
    await Promise.allSettled([
      detailsPromise,
      languagesPromise,
      releasesPromise,
      readmePromise,
    ]);

  if (detailsResult.status === "rejected") {
    throw detailsResult.reason;
  }

  const repo: RepoDetails = normalizeRepoDetails(detailsResult.value.data);
  await captureSnapshots([repo]);

  const store = await safeStore();
  let growth: RepoGrowth = emptyGrowth(now.getTime());
  let history: SnapshotHistory = await emptyHistory(repo.fullName);
  if (store) {
    try {
      const growthMap = await store.getRepoGrowth([repo.fullName], now);
      growth = growthMap.get(repo.fullName) ?? growth;
      history = await store.getHistory(repo.fullName, now);
    } catch (error) {
      console.error("[github-radar] Could not read repository history:", error);
    }
  }

  const languages =
    languagesResult.status === "fulfilled"
      ? normalizeLanguages(languagesResult.value.data)
      : {};

  const releases: ReleaseSummary[] =
    releasesResult.status === "fulfilled"
      ? releasesResult.value.data
          .filter((release) => !release.draft)
          .map(normalizeRelease)
          .slice(0, 6)
      : [];

  let readme: ReadmePayload | null = null;
  if (readmeResult.status === "fulfilled") {
    readme = await normalizeReadme(
      readmeResult.value.data,
      `${repo.htmlUrl}#readme`,
    );
  }

  const partialErrors: RepoDetailResponse["partialErrors"] = {};
  if (languagesResult.status === "rejected") {
    partialErrors.languages = "Language breakdown unavailable.";
  }
  if (releasesResult.status === "rejected") {
    partialErrors.releases = "Releases unavailable.";
  }
  if (readmeResult.status === "rejected") {
    const reason = readmeResult.reason;
    partialErrors.readme =
      reason instanceof GitHubApiError && reason.code === "NOT_FOUND"
        ? "This repository has no README."
        : "README could not be loaded.";
  }

  return {
    repo,
    languages,
    releases,
    readme,
    growth,
    history,
    partialErrors,
    meta: responseMeta(detailsResult.value),
  };
}

async function emptyHistory(fullName: string): Promise<SnapshotHistory> {
  return {
    fullName,
    points: [],
    firstAt: null,
    lastAt: null,
    totalPoints: 0,
    earliestStars: null,
    latestStars: null,
  };
}

export async function getBatchRepositories(input: {
  names: string[];
  bypassCache?: boolean;
  now?: Date;
}): Promise<BatchReposResponse> {
  const uniqueNames = [...new Set(input.names)].slice(0, 8);
  const settled = await Promise.allSettled(
    uniqueNames.map(async (fullName) => {
      const [owner, repo] = fullName.split("/");
      const result = await githubRequest(
        rawRepoBaseSchema,
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        {
          resource: "core",
          cacheTtlMs: 5 * 60_000,
          bypassCache: input.bypassCache,
        },
      );
      return normalizeRepo(result.data);
    }),
  );

  const rawRepos: RepoSummary[] = [];
  const items: BatchReposResponse["items"] = settled.map((entry, index) => {
    if (entry.status === "fulfilled") {
      rawRepos.push(entry.value);
      return { repo: null, fullName: uniqueNames[index] };
    }
    return {
      repo: null,
      fullName: uniqueNames[index],
      error:
        entry.reason instanceof GitHubApiError &&
        entry.reason.code === "NOT_FOUND"
          ? "Repository not found."
          : "Could not load this repository.",
    };
  });

  if (rawRepos.length === 0) {
    const firstRejection = settled.find(
      (entry): entry is PromiseRejectedResult => entry.status === "rejected",
    );
    if (firstRejection) throw firstRejection.reason;
  }

  await captureSnapshots(rawRepos);
  const withGrowth = await attachGrowth(rawRepos, input.now);
  const growthByFullName = new Map(
    withGrowth.map((repo) => [repo.fullName, repo]),
  );

  const finalItems = items.map((item) => ({
    ...item,
    repo: growthByFullName.get(item.fullName) ?? null,
  }));

  return {
    items: finalItems,
    meta: {
      fetchedAt: new Date().toISOString(),
      cached: false,
      stale: false,
      rateLimit: getRateLimitBucket("core"),
    },
  };
}

export async function getLeaderboardData(input: {
  window: GrowthWindow;
  limit: number;
  now?: Date;
}): Promise<LeaderboardResponse> {
  const now = input.now ?? new Date();
  const status = await getStatusSafe(now);
  const store = await safeStore();
  if (!store) {
    return {
      window: input.window,
      items: [],
      status,
      fetchedAt: now.toISOString(),
    };
  }

  let items: LeaderboardEntry[] = [];
  try {
    items = await store.getLeaderboard(input.window, input.limit, now);
  } catch (error) {
    console.error("[github-radar] Could not read leaderboard:", error);
  }

  return {
    window: input.window,
    items,
    status,
    fetchedAt: now.toISOString(),
  };
}

export async function getSystemStatus(): Promise<SystemResponse> {
  const env = getServerEnv();
  let rateLimit = getRateLimitSnapshot();

  if (!rateLimit.core || !rateLimit.search) {
    try {
      await fetchGitHubRateLimit();
      rateLimit = {
        ...getRateLimitSnapshot(),
        tokenConfigured: Boolean(env.githubToken),
      };
    } catch (error) {
      console.error("[github-radar] Could not refresh rate limit:", error);
    }
  }

  const storage = await getStatusSafe();
  return {
    rateLimit,
    storage,
    tokenConfigured: Boolean(env.githubToken),
    app: {
      name: APP_NAME,
      version: APP_VERSION,
      storageDriver: storage.driver,
    },
  };
}

export async function getWatchlistSnapshots(
  names: string[],
): Promise<Map<string, RepoGrowth>> {
  if (names.length === 0) return new Map();
  const store = await safeStore();
  if (!store) return new Map();
  try {
    return await store.getRepoGrowth(names);
  } catch (error) {
    console.error("[github-radar] Could not read watchlist growth:", error);
    return new Map();
  }
}

export async function captureSnapshotsForRepos(
  names: string[],
): Promise<SnapshotMutationResponse> {
  const store = await getSnapshotStore();
  const settled = await Promise.allSettled(
    names.slice(0, 8).map(async (fullName) => {
      const [owner, repo] = fullName.split("/");
      const result = await githubRequest(
        rawRepoBaseSchema,
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        { resource: "core", cacheTtlMs: 60_000 },
      );
      return normalizeRepo(result.data);
    }),
  );

  const repos = settled
    .filter(
      (entry): entry is PromiseFulfilledResult<RepoSummary> =>
        entry.status === "fulfilled",
    )
    .map((entry) => entry.value);

  const record = await store.recordRepositories(repos);
  return {
    ...record,
    status: await store.getStatus(),
  };
}

export async function collectRadarSnapshots(now = new Date()): Promise<
  SnapshotMutationResponse
> {
  const store = await getSnapshotStore();
  const rising = buildDashboardLensQuery("rising", now.getTime());
  const aiLane = getTrendingLane("ai");
  const ai = buildTrendingQuery(aiLane, now.getTime());
  const fresh = buildFreshQuery({
    hours: 24 * 7,
    minStars: 50,
    now: now.getTime(),
  });

  const queries = [
    { query: rising.query, sort: rising.sort },
    { query: ai, sort: aiLane.sort },
    { query: fresh, sort: "stars" },
  ] as const;

  const settled = await Promise.allSettled(
    queries.map(({ query, sort }) =>
      githubRequest(
        rawSearchResponseSchema,
        `/search/repositories?${new URLSearchParams({
          q: query,
          sort,
          order: "desc",
          per_page: "30",
          page: "1",
        }).toString()}`,
        { resource: "search", bypassCache: true },
      ),
    ),
  );

  const byFullName = new Map<string, RepoSummary>();
  for (const entry of settled) {
    if (entry.status !== "fulfilled") continue;
    for (const raw of entry.value.data.items) {
      try {
        const repo = normalizeRepo(raw);
        byFullName.set(repo.fullName, repo);
      } catch {
        // A malformed record should not abort a collection run.
      }
    }
  }

  if (byFullName.size === 0) {
    const rejection = settled.find(
      (entry): entry is PromiseRejectedResult => entry.status === "rejected",
    );
    if (rejection) throw rejection.reason;
  }

  const record = await store.recordRepositories(
    [...byFullName.values()].slice(0, 80),
    now,
  );
  return {
    ...record,
    status: await store.getStatus(now),
  };
}

export function getEmptyGrowth(now = Date.now()): RepoGrowth {
  return emptyGrowth(now);
}

export function summarizeGrowth(metrics: GrowthMetrics): string {
  if (!metrics.available) return "Insufficient measured history";
  return `${metrics.starsGained ?? 0} stars over ${metrics.intervalHours ?? 0}h`;
}
