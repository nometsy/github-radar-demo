import type { RepoSummary } from "@/lib/github/types";

export type GrowthWindow = "24h" | "7d";

export type GrowthUnavailableReason =
  | "not_enough_snapshots"
  | "snapshot_too_old"
  | "no_baseline"
  | "invalid_data";

export interface GrowthMetrics {
  window: GrowthWindow;
  available: boolean;
  reason: GrowthUnavailableReason | null;
  starsGained: number | null;
  growthPct: number | null;
  momentum: number | null;
  intervalHours: number | null;
  baselineAt: string | null;
  latestAt: string | null;
  samples: number;
}

export type RepoGrowth = Record<GrowthWindow, GrowthMetrics>;

export interface RawSnapshotPoint {
  /** epoch milliseconds */
  t: number;
  stars: number;
  forks: number;
}

export interface SnapshotPoint {
  capturedAt: string;
  stars: number;
  forks: number;
}

export interface SnapshotHistory {
  fullName: string;
  points: SnapshotPoint[];
  firstAt: string | null;
  lastAt: string | null;
  totalPoints: number;
  earliestStars: number | null;
  latestStars: number | null;
}

export interface SnapshotStatus {
  driver: "file" | "postgres";
  trackedRepos: number;
  snapshotCount: number;
  starsTracked: number;
  oldestSnapshotAt: string | null;
  newestSnapshotAt: string | null;
  available24h: number;
  available7d: number;
  writable: boolean;
  note: string | null;
}

export interface TrackedRepoSummary {
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  language: string | null;
  htmlUrl: string;
  avatarUrl: string;
  topics: string[];
  createdAt: string;
  stars: number;
  forks: number;
}

export interface LeaderboardEntry {
  repo: TrackedRepoSummary;
  growth: GrowthMetrics;
}

export interface RecordSnapshotsResult {
  captured: number;
  skipped: number;
  tracked: number;
}

export interface SnapshotRepoInput {
  repo: RepoSummary;
}
