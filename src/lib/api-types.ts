import type {
  RateLimitBucket,
  RateLimitSnapshot,
  ReadmePayload,
  ReleaseSummary,
  RepoDetails,
  RepoSummary,
} from "@/lib/github/types";
import type {
  GrowthMetrics,
  GrowthWindow,
  LeaderboardEntry,
  RepoGrowth,
  SnapshotHistory,
  SnapshotStatus,
} from "@/lib/radar/types";
import type { SparklineData } from "@/lib/radar/sparkline";

export type RepoWithGrowth = RepoSummary & {
  growth: RepoGrowth;
  /** Compact measured star history; absent when fewer than two points exist. */
  sparkline?: SparklineData;
};

export interface ResponseMeta {
  fetchedAt: string;
  cached: boolean;
  stale: boolean;
  rateLimit: RateLimitBucket | null;
  note?: string;
}

export interface RepositoriesResponse {
  items: RepoWithGrowth[];
  totalCount: number;
  incompleteResults: boolean;
  page: number;
  perPage: number;
  pageCount: number;
  query: string;
  meta: ResponseMeta;
}

export interface DashboardStats {
  newToday: number | null;
  newTodaySince: string;
  trendingCount: number | null;
  trendingWindowLabel: string;
  measuredGrowers24h: number;
  starsTracked: number;
  reposTracked: number;
  snapshotsTracked: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  feed: RepositoriesResponse;
  status: SnapshotStatus;
}

export interface LeaderboardResponse {
  window: GrowthWindow;
  items: LeaderboardEntry[];
  status: SnapshotStatus;
  fetchedAt: string;
}

export interface RepoDetailResponse {
  repo: RepoDetails;
  languages: Record<string, number>;
  releases: ReleaseSummary[];
  readme: ReadmePayload | null;
  growth: RepoGrowth;
  history: SnapshotHistory;
  partialErrors: {
    languages?: string;
    releases?: string;
    readme?: string;
  };
  meta: ResponseMeta;
}

export interface BatchReposResponse {
  items: {
    repo: RepoWithGrowth | null;
    fullName: string;
    error?: string;
  }[];
  meta: ResponseMeta;
}

export interface SystemResponse {
  rateLimit: RateLimitSnapshot;
  storage: SnapshotStatus;
  tokenConfigured: boolean;
  app: {
    name: string;
    version: string;
    storageDriver: SnapshotStatus["driver"];
  };
}

export interface SnapshotMutationResponse {
  captured: number;
  skipped: number;
  tracked: number;
  status: SnapshotStatus;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    status: number;
    retryAt?: string | null;
    rateLimit?: RateLimitSnapshot;
    issues?: { path: string; message: string }[];
  };
}

export interface RepoGrowthPayload {
  growth: RepoGrowth;
  metrics: GrowthMetrics[];
}

export type { GrowthMetrics, GrowthWindow, RepoGrowth };
