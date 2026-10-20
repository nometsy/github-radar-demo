import type {
  FeedLens,
  FreshSort,
  SmartSearchSort,
  TrendingLaneConfig,
  TrendingLaneId,
} from "@/lib/constants";
import { TRENDING_LANES } from "@/lib/constants";

export const DAY_MS = 86_400_000;

// Relative search windows are rounded down to five-minute buckets so the same
// query string can be reused from the server cache instead of missing on every
// request by a few seconds. The window grows by less than five minutes.
const QUERY_TIME_BUCKET_MS = 5 * 60_000;

function bucketTime(timestamp: number): number {
  return Math.floor(timestamp / QUERY_TIME_BUCKET_MS) * QUERY_TIME_BUCKET_MS;
}

export interface RepoQueryOptions {
  /** Free text. Appended as-is after sanitisation. */
  keywords?: string;
  /** Ready-made qualifiers, e.g. "topic:llm stars:>=100". */
  rawQualifiers?: string;
  language?: string;
  topic?: string;
  minStars?: number;
  maxStars?: number;
  minForks?: number;
  createdAfter?: Date;
  pushedAfter?: Date;
  includeForks?: boolean;
  includeArchived?: boolean;
  /** Append in:name,description,readme when free text is present. */
  keywordInFields?: boolean;
}

export interface GitHubSortValue {
  sort: "stars" | "forks" | "updated" | null;
  order: "desc" | null;
}

export interface DashboardLensQuery {
  query: string;
  sort: "stars" | "updated";
  order: "desc";
  windowLabel: string;
}

const DASHBOARD_LENS_DEFINITIONS: Record<
  FeedLens,
  {
    createdWithinHours: number;
    pushedWithinHours?: number;
    minStars: number;
    sort: "stars" | "updated";
    windowLabel: string;
  }
> = {
  today: {
    createdWithinHours: 24,
    minStars: 5,
    sort: "stars",
    windowLabel: "new · created ≤24h",
  },
  rising: {
    createdWithinHours: 14 * 24,
    minStars: 25,
    sort: "stars",
    windowLabel: "created ≤14d · ≥25 stars",
  },
  fresh: {
    createdWithinHours: 3 * 24,
    minStars: 2,
    sort: "updated",
    windowLabel: "created ≤3d · latest activity",
  },
  active: {
    createdWithinHours: 90 * 24,
    pushedWithinHours: 24,
    minStars: 100,
    sort: "updated",
    windowLabel: "active ≤24h · ≥100 stars",
  },
};

export function daysBefore(days: number, now = Date.now()): Date {
  return new Date(bucketTime(now) - days * DAY_MS);
}

export function hoursBefore(hours: number, now = Date.now()): Date {
  return new Date(bucketTime(now) - hours * 3_600_000);
}

export function toGitHubDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function sanitizeSearchText(input: string, maxLength = 120): string {
  return input
    .replace(/[\u0000-\u001f\u007f\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function quoteValue(value: string): string {
  const cleaned = value.replace(/["\\]/g, "").trim();
  if (!cleaned) return "";
  if (/^[A-Za-z0-9+#._-]+$/.test(cleaned)) return cleaned;
  return `"${cleaned}"`;
}

export function sanitizeTopic(topic: string): string {
  return topic
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function buildRepoSearchQuery(options: RepoQueryOptions): string {
  const parts: string[] = [];

  if (options.keywords) {
    const keywords = sanitizeSearchText(options.keywords);
    if (keywords) {
      parts.push(keywords);
      if (
        options.keywordInFields &&
        !/\bin:/.test(keywords) &&
        !keywords.includes(":")
      ) {
        parts.push("in:name,description,readme");
      }
    }
  }

  if (options.rawQualifiers) {
    const qualifiers = sanitizeSearchText(options.rawQualifiers, 240);
    if (qualifiers) parts.push(qualifiers);
  }

  if (options.language) {
    const language = quoteValue(options.language);
    if (language) parts.push(`language:${language}`);
  }

  if (options.topic) {
    const topic = sanitizeTopic(options.topic);
    if (topic) parts.push(`topic:${topic}`);
  }

  const minStars =
    Number.isFinite(options.minStars) && (options.minStars ?? 0) > 0
      ? Math.floor(options.minStars as number)
      : 0;
  const maxStars =
    Number.isFinite(options.maxStars) && (options.maxStars ?? 0) > 0
      ? Math.floor(options.maxStars as number)
      : null;

  if (minStars > 0 && maxStars !== null) {
    parts.push(`stars:${minStars}..${maxStars}`);
  } else if (minStars > 0) {
    parts.push(`stars:>=${minStars}`);
  } else if (maxStars !== null) {
    parts.push(`stars:<=${maxStars}`);
  }

  if (Number.isFinite(options.minForks) && (options.minForks ?? 0) > 0) {
    parts.push(`forks:>=${Math.floor(options.minForks as number)}`);
  }

  if (options.createdAfter) {
    parts.push(`created:>=${toGitHubDate(options.createdAfter)}`);
  }

  if (options.pushedAfter) {
    parts.push(`pushed:>=${toGitHubDate(options.pushedAfter)}`);
  }

  if (!options.includeForks) parts.push("fork:false");
  if (!options.includeArchived) parts.push("archived:false");

  return parts.filter(Boolean).join(" ").trim();
}

export function buildDashboardLensQuery(
  lens: FeedLens,
  now = Date.now(),
): DashboardLensQuery {
  const definition = DASHBOARD_LENS_DEFINITIONS[lens];
  const query = buildRepoSearchQuery({
    createdAfter: hoursBefore(definition.createdWithinHours, now),
    pushedAfter: definition.pushedWithinHours
      ? hoursBefore(definition.pushedWithinHours, now)
      : undefined,
    minStars: definition.minStars,
  });
  return {
    query,
    sort: definition.sort,
    order: "desc",
    windowLabel:
      lens === "rising"
        ? "Trending · created ≤14d · ≥25 stars"
        : definition.windowLabel,
  };
}

export function buildNewTodayQuery(now = new Date()): string {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return buildRepoSearchQuery({ createdAfter: start });
}

export function buildFreshQuery(input: {
  /** Window length in hours (6, 12, 24, 72, 168, 720). */
  hours: number;
  language?: string;
  minStars?: number;
  minForks?: number;
  topic?: string;
  now?: number;
}): string {
  return buildRepoSearchQuery({
    createdAfter: hoursBefore(input.hours, input.now),
    language: input.language,
    topic: input.topic,
    minStars: input.minStars,
    minForks: input.minForks,
  });
}

export function getTrendingLane(id: TrendingLaneId): TrendingLaneConfig {
  return TRENDING_LANES.find((lane) => lane.id === id) ?? TRENDING_LANES[1];
}

export function buildTrendingQuery(
  lane: TrendingLaneConfig,
  now = Date.now(),
): string {
  return buildRepoSearchQuery({
    createdAfter: daysBefore(lane.createdWithinDays, now),
    pushedAfter:
      lane.pushedWithinHours === null
        ? undefined
        : hoursBefore(lane.pushedWithinHours, now),
    minStars: lane.minStars,
    maxStars: lane.maxStars ?? undefined,
    topic: lane.topic,
  });
}

export function buildSmartSearchQuery(input: {
  q: string;
  language?: string;
  minStars?: number;
  topic?: string;
  createdDays?: number;
  now?: number;
}): string {
  return buildRepoSearchQuery({
    keywords: input.q,
    language: input.language,
    minStars: input.minStars,
    topic: input.topic,
    createdAfter:
      input.createdDays && input.createdDays > 0
        ? daysBefore(input.createdDays, input.now)
        : undefined,
    keywordInFields: true,
  });
}

export function mapSearchSort(
  sort: FreshSort | SmartSearchSort,
): GitHubSortValue {
  switch (sort) {
    case "stars":
      return { sort: "stars", order: "desc" };
    case "updated":
      return { sort: "updated", order: "desc" };
    default:
      return { sort: null, order: null };
  }
}

export function cleanSortQuery(value: GitHubSortValue): string {
  if (!value.sort) return "";
  const params = new URLSearchParams({ sort: value.sort });
  if (value.order) params.set("order", value.order);
  return params.toString();
}
