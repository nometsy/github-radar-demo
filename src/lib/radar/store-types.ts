import type { RepoSummary } from "@/lib/github/types";
import type {
  GrowthWindow,
  LeaderboardEntry,
  RecordSnapshotsResult,
  RepoGrowth,
  SnapshotHistory,
  SnapshotStatus,
} from "@/lib/radar/types";

export interface SnapshotStore {
  readonly driver: "file" | "postgres";
  recordRepositories(
    repos: RepoSummary[],
    now?: Date,
  ): Promise<RecordSnapshotsResult>;
  getRepoGrowth(
    fullNames: string[],
    now?: Date,
  ): Promise<Map<string, RepoGrowth>>;
  getHistory(fullName: string, now?: Date): Promise<SnapshotHistory>;
  getHistories(
    fullNames: string[],
    now?: Date,
  ): Promise<Map<string, SnapshotHistory>>;
  getLeaderboard(
    window: GrowthWindow,
    limit: number,
    now?: Date,
  ): Promise<LeaderboardEntry[]>;
  getStatus(now?: Date): Promise<SnapshotStatus>;
}

export class StoreConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreConfigurationError";
  }
}
