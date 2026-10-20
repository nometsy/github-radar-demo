import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { RepoSummary } from "@/lib/github/types";
import { computeGrowthForWindow, computeMomentum, computeRepoGrowth } from "@/lib/radar/growth";
import type {
  GrowthWindow,
  LeaderboardEntry,
  RawSnapshotPoint,
  RecordSnapshotsResult,
  RepoGrowth,
  SnapshotHistory,
  SnapshotStatus,
  TrackedRepoSummary,
} from "@/lib/radar/types";
import type { SnapshotStore } from "@/lib/radar/store-types";
import { SPARKLINE_LOOKBACK_DAYS } from "@/lib/radar/sparkline";
import { SNAPSHOT_MIN_INTERVAL_MINUTES } from "@/lib/constants";
import { getDataDir } from "@/lib/data-dir";

const RETENTION_DAYS = 120;
const MAX_POINTS_PER_REPO = 3_000;
const MAX_TRACKED_REPOS = 5_000;
const STORE_VERSION = 1;

interface PersistedRepo {
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  language: string | null;
  htmlUrl: string;
  avatarUrl: string;
  topics: string[];
  createdAt: string;
  lastSeenAt: number;
}

interface PersistedPoint {
  t: number;
  s: number;
  f: number;
}

interface PersistedData {
  version: number;
  repos: Record<string, PersistedRepo>;
  snapshots: Record<string, PersistedPoint[]>;
  updatedAt: number;
}

function emptyData(): PersistedData {
  return {
    version: STORE_VERSION,
    repos: {},
    snapshots: {},
    updatedAt: Date.now(),
  };
}

function emptyHistory(fullName: string): SnapshotHistory {
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

function historyFor(
  data: PersistedData,
  fullName: string,
  cutoff: number,
): SnapshotHistory {
  const key = resolveRepoKey(data, fullName);
  if (!key) return emptyHistory(fullName);

  const points = (data.snapshots[key] ?? [])
    .filter((point) => point.t >= cutoff)
    .map((point) => ({
      capturedAt: new Date(point.t).toISOString(),
      stars: point.s,
      forks: point.f,
    }));

  return {
    fullName: data.repos[key]?.fullName ?? key,
    points,
    firstAt: points[0]?.capturedAt ?? null,
    lastAt: points[points.length - 1]?.capturedAt ?? null,
    totalPoints: points.length,
    earliestStars: points[0]?.stars ?? null,
    latestStars: points[points.length - 1]?.stars ?? null,
  };
}

function isPersistedPoint(value: unknown): value is PersistedPoint {
  if (typeof value !== "object" || value === null) return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.t === "number" &&
    Number.isFinite(point.t) &&
    typeof point.s === "number" &&
    Number.isFinite(point.s) &&
    typeof point.f === "number" &&
    Number.isFinite(point.f)
  );
}

function isPersistedRepo(value: unknown): value is PersistedRepo {
  if (typeof value !== "object" || value === null) return false;
  const repo = value as Record<string, unknown>;
  return (
    typeof repo.fullName === "string" &&
    typeof repo.name === "string" &&
    typeof repo.owner === "string" &&
    typeof repo.htmlUrl === "string" &&
    typeof repo.avatarUrl === "string" &&
    typeof repo.createdAt === "string" &&
    Array.isArray(repo.topics) &&
    repo.topics.every((topic) => typeof topic === "string")
  );
}

function parseData(raw: string): PersistedData | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as Record<string, unknown>;
    if (candidate.version !== STORE_VERSION) return null;
    if (
      typeof candidate.repos !== "object" ||
      candidate.repos === null ||
      typeof candidate.snapshots !== "object" ||
      candidate.snapshots === null
    ) {
      return null;
    }

    const repos: Record<string, PersistedRepo> = {};
    for (const [key, value] of Object.entries(
      candidate.repos as Record<string, unknown>,
    )) {
      if (isPersistedRepo(value)) repos[key] = value;
    }

    const snapshots: Record<string, PersistedPoint[]> = {};
    for (const [key, value] of Object.entries(
      candidate.snapshots as Record<string, unknown>,
    )) {
      if (!Array.isArray(value)) continue;
      const points = value.filter(isPersistedPoint).sort((a, b) => a.t - b.t);
      if (points.length > 0) snapshots[key] = points;
    }

    return {
      version: STORE_VERSION,
      repos,
      snapshots,
      updatedAt:
        typeof candidate.updatedAt === "number"
          ? candidate.updatedAt
          : Date.now(),
    };
  } catch {
    return null;
  }
}

function resolveRepoKey(
  data: PersistedData,
  fullName: string,
): string | null {
  if (data.snapshots[fullName]) return fullName;
  const target = fullName.toLowerCase();
  for (const key of Object.keys(data.snapshots)) {
    if (key.toLowerCase() === target) return key;
  }
  for (const key of Object.keys(data.repos)) {
    if (key.toLowerCase() === target) return key;
  }
  return null;
}

function latestPoint(points: PersistedPoint[] | undefined): PersistedPoint | null {
  if (!points || points.length === 0) return null;
  return points[points.length - 1];
}

function toRawPoints(points: PersistedPoint[]): RawSnapshotPoint[] {
  return points.map((point) => ({
    t: point.t,
    stars: point.s,
    forks: point.f,
  }));
}

function buildTrackedSummary(
  repo: PersistedRepo,
  point: PersistedPoint,
): TrackedRepoSummary {
  return {
    fullName: repo.fullName,
    name: repo.name,
    owner: repo.owner,
    description: repo.description,
    language: repo.language,
    htmlUrl: repo.htmlUrl,
    avatarUrl: repo.avatarUrl,
    topics: repo.topics,
    createdAt: repo.createdAt,
    stars: point.s,
    forks: point.f,
  };
}

export class FileSnapshotStore implements SnapshotStore {
  readonly driver = "file" as const;
  private readonly filePath: string;
  private readonly directory: string;
  private queue: Promise<unknown> = Promise.resolve();
  private data: PersistedData | null = null;
  private writable = true;
  private writeErrorLogged = false;

  constructor() {
    this.directory = getDataDir();
    this.filePath = path.join(this.directory, "radar.json");
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation, operation);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async ensureLoaded(): Promise<PersistedData> {
    if (this.data) return this.data;

    await fs.mkdir(this.directory, { recursive: true }).catch(() => {
      this.writable = false;
    });

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = parseData(raw);
      if (!parsed) {
        await fs
          .copyFile(
            this.filePath,
            `${this.filePath}.corrupt-${Date.now()}.bak`,
          )
          .catch(() => undefined);
        console.error(
          "[github-radar] Snapshot store was unreadable; starting a new one. A backup was kept.",
        );
        this.data = emptyData();
      } else {
        this.data = parsed;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("[github-radar] Could not read snapshot store:", error);
      }
      this.data = emptyData();
    }

    return this.data;
  }

  private async persist(data: PersistedData): Promise<void> {
    if (!this.writable) return;
    data.updatedAt = Date.now();
    const tempPath = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      await fs.mkdir(this.directory, { recursive: true });
      await fs.writeFile(tempPath, JSON.stringify(data), "utf8");
      await fs.rename(tempPath, this.filePath);
    } catch (error) {
      this.writable = false;
      if (!this.writeErrorLogged) {
        this.writeErrorLogged = true;
        console.error(
          "[github-radar] Snapshot store is not writable. Snapshots will live in memory for this process.",
          error,
        );
      }
      await fs.unlink(tempPath).catch(() => undefined);
    }
  }

  private prune(data: PersistedData, now: number): void {
    const cutoff = now - RETENTION_DAYS * 86_400_000;
    for (const [fullName, points] of Object.entries(data.snapshots)) {
      let pruned = points.filter((point) => point.t >= cutoff);
      if (pruned.length > MAX_POINTS_PER_REPO) {
        pruned = pruned.slice(pruned.length - MAX_POINTS_PER_REPO);
      }
      if (pruned.length === 0) {
        delete data.snapshots[fullName];
      } else {
        data.snapshots[fullName] = pruned;
      }
    }

    for (const key of Object.keys(data.repos)) {
      if (!data.snapshots[key]) delete data.repos[key];
    }

    const repoKeys = Object.keys(data.repos);
    if (repoKeys.length > MAX_TRACKED_REPOS) {
      repoKeys
        .sort((a, b) => (data.repos[a].lastSeenAt ?? 0) - (data.repos[b].lastSeenAt ?? 0))
        .slice(0, repoKeys.length - MAX_TRACKED_REPOS)
        .forEach((key) => {
          delete data.repos[key];
          delete data.snapshots[key];
        });
    }
  }

  async recordRepositories(
    repos: RepoSummary[],
    now = new Date(),
  ): Promise<RecordSnapshotsResult> {
    return this.runExclusive(async () => {
      const data = await this.ensureLoaded();
      const nowMs = now.getTime();
      let captured = 0;
      let skipped = 0;

      for (const repo of repos) {
        if (!repo.fullName || !repo.fullName.includes("/")) continue;
        const key = resolveRepoKey(data, repo.fullName) ?? repo.fullName;
        const [owner] = key.split("/");

        data.repos[key] = {
          fullName: key,
          name: repo.name,
          owner: repo.owner.login || owner,
          description: repo.description,
          language: repo.language,
          htmlUrl: repo.htmlUrl,
          avatarUrl: repo.owner.avatarUrl,
          topics: repo.topics.slice(0, 12),
          createdAt: repo.createdAt,
          lastSeenAt: nowMs,
        };

        const points = data.snapshots[key] ?? [];
        const last = latestPoint(points);
        const minInterval =
          SNAPSHOT_MIN_INTERVAL_MINUTES * 60_000;

        if (last && nowMs - last.t < minInterval) {
          data.repos[key].lastSeenAt = nowMs;
          skipped += 1;
          continue;
        }

        points.push({
          t: nowMs,
          s: Math.max(0, Math.round(repo.stars)),
          f: Math.max(0, Math.round(repo.forks)),
        });
        points.sort((a, b) => a.t - b.t);
        data.snapshots[key] = points;
        captured += 1;
      }

      if (captured > 0) {
        this.prune(data, nowMs);
        await this.persist(data);
      }

      return {
        captured,
        skipped,
        tracked: Object.keys(data.snapshots).length,
      };
    });
  }

  async getRepoGrowth(
    fullNames: string[],
    now = new Date(),
  ): Promise<Map<string, RepoGrowth>> {
    return this.runExclusive(async () => {
      const data = await this.ensureLoaded();
      const nowMs = now.getTime();
      const result = new Map<string, RepoGrowth>();
      for (const fullName of fullNames) {
        const key = resolveRepoKey(data, fullName);
        if (!key) continue;
        const points = data.snapshots[key] ?? [];
        result.set(fullName, computeRepoGrowth(toRawPoints(points), nowMs));
      }
      return result;
    });
  }

  async getHistory(
    fullName: string,
    now = new Date(),
  ): Promise<SnapshotHistory> {
    return this.runExclusive(async () => {
      const data = await this.ensureLoaded();
      return historyFor(
        data,
        fullName,
        now.getTime() - RETENTION_DAYS * 86_400_000,
      );
    });
  }

  async getHistories(
    fullNames: string[],
    now = new Date(),
  ): Promise<Map<string, SnapshotHistory>> {
    return this.runExclusive(async () => {
      const data = await this.ensureLoaded();
      const cutoff = now.getTime() - SPARKLINE_LOOKBACK_DAYS * 86_400_000;
      const result = new Map<string, SnapshotHistory>();

      for (const fullName of fullNames) {
        result.set(fullName, historyFor(data, fullName, cutoff));
      }

      return result;
    });
  }

  async getLeaderboard(
    window: GrowthWindow,
    limit: number,
    now = new Date(),
  ): Promise<LeaderboardEntry[]> {
    return this.runExclusive(async () => {
      const data = await this.ensureLoaded();
      const nowMs = now.getTime();
      const entries: LeaderboardEntry[] = [];

      for (const [key, points] of Object.entries(data.snapshots)) {
        if (points.length < 2) continue;
        const repo = data.repos[key];
        const point = latestPoint(points);
        if (!repo || !point) continue;
        const growth = computeGrowthForWindow(
          toRawPoints(points),
          window,
          nowMs,
        );
        if (!growth.available) continue;
        const weekly = computeGrowthForWindow(toRawPoints(points), "7d", nowMs);
        growth.momentum = computeMomentum(growth, weekly);
        entries.push({
          repo: buildTrackedSummary(repo, point),
          growth,
        });
      }

      entries.sort((a, b) => {
        const deltaA = a.growth.starsGained ?? Number.NEGATIVE_INFINITY;
        const deltaB = b.growth.starsGained ?? Number.NEGATIVE_INFINITY;
        if (deltaA !== deltaB) return deltaB - deltaA;
        return (b.growth.growthPct ?? Number.NEGATIVE_INFINITY) -
          (a.growth.growthPct ?? Number.NEGATIVE_INFINITY);
      });

      return entries.slice(0, limit);
    });
  }

  async getStatus(now = new Date()): Promise<SnapshotStatus> {
    return this.runExclusive(async () => {
      const data = await this.ensureLoaded();
      const nowMs = now.getTime();
      let snapshotCount = 0;
      let starsTracked = 0;
      let oldest: number | null = null;
      let newest: number | null = null;
      let available24h = 0;
      let available7d = 0;

      for (const points of Object.values(data.snapshots)) {
        snapshotCount += points.length;
        const latest = latestPoint(points);
        if (latest) starsTracked += latest.s;
        const first = points[0];
        if (first) oldest = oldest === null ? first.t : Math.min(oldest, first.t);
        if (latest) newest = newest === null ? latest.t : Math.max(newest, latest.t);

        if (points.length >= 2) {
          const raw = toRawPoints(points);
          if (computeGrowthForWindow(raw, "24h", nowMs).available) {
            available24h += 1;
          }
          if (computeGrowthForWindow(raw, "7d", nowMs).available) {
            available7d += 1;
          }
        }
      }

      return {
        driver: this.driver,
        trackedRepos: Object.keys(data.snapshots).length,
        snapshotCount,
        starsTracked,
        oldestSnapshotAt: oldest ? new Date(oldest).toISOString() : null,
        newestSnapshotAt: newest ? new Date(newest).toISOString() : null,
        available24h,
        available7d,
        writable: this.writable,
        note: this.writable
          ? null
          : "The local file store is not writable. Snapshots are held in memory.",
      };
    });
  }
}
