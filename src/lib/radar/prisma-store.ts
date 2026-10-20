import { PrismaClient, Prisma } from "@prisma/client";
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
} from "@/lib/radar/types";
import type { SnapshotStore } from "@/lib/radar/store-types";
import { SPARKLINE_LOOKBACK_DAYS } from "@/lib/radar/sparkline";
import { SNAPSHOT_MIN_INTERVAL_MINUTES } from "@/lib/constants";

interface PrismaGlobal {
  __githubRadarPrisma?: PrismaClient;
}

const globalPrisma = globalThis as typeof globalThis & PrismaGlobal;
const prisma =
  globalPrisma.__githubRadarPrisma ??
  (globalPrisma.__githubRadarPrisma = new PrismaClient({
    log: ["error"],
  }));

const RETENTION_DAYS = 120;
const GROWTH_LOOKBACK_DAYS = 10;

function validDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function toRawPoints(
  points: { capturedAt: Date; stars: number; forks: number }[],
): RawSnapshotPoint[] {
  return points.map((point) => ({
    t: point.capturedAt.getTime(),
    stars: point.stars,
    forks: point.forks,
  }));
}

export class PrismaSnapshotStore implements SnapshotStore {
  readonly driver = "postgres" as const;

  async recordRepositories(
    repos: RepoSummary[],
    now = new Date(),
  ): Promise<RecordSnapshotsResult> {
    const unique = new Map<string, RepoSummary>();
    for (const repo of repos) {
      if (repo.fullName.includes("/")) unique.set(repo.fullName, repo);
    }
    const list = [...unique.values()].slice(0, 60);
    if (list.length === 0) {
      return {
        captured: 0,
        skipped: 0,
        tracked: await prisma.trackedRepository.count(),
      };
    }

    const names = list.map((repo) => repo.fullName);
    const latest = await prisma.repositorySnapshot.groupBy({
      by: ["repoFullName"],
      where: { repoFullName: { in: names } },
      _max: { capturedAt: true },
    });
    const latestByRepo = new Map(
      latest.map((entry) => [
        entry.repoFullName.toLowerCase(),
        entry._max.capturedAt,
      ]),
    );
    const minInterval = SNAPSHOT_MIN_INTERVAL_MINUTES * 60_000;

    let captured = 0;
    let skipped = 0;

    for (const repo of list) {
      const repoLatest = latestByRepo.get(repo.fullName.toLowerCase());
      const shouldCapture =
        !repoLatest || now.getTime() - repoLatest.getTime() >= minInterval;

      await prisma.trackedRepository.upsert({
        where: { fullName: repo.fullName },
        create: {
          fullName: repo.fullName,
          name: repo.name,
          owner: repo.owner.login,
          description: repo.description,
          language: repo.language,
          topics: repo.topics.slice(0, 12),
          htmlUrl: repo.htmlUrl,
          avatarUrl: repo.owner.avatarUrl,
          createdAt: validDate(repo.createdAt),
          updatedAt: validDate(repo.updatedAt),
          lastSeenAt: now,
        },
        update: {
          name: repo.name,
          owner: repo.owner.login,
          description: repo.description,
          language: repo.language,
          topics: repo.topics.slice(0, 12),
          htmlUrl: repo.htmlUrl,
          avatarUrl: repo.owner.avatarUrl,
          updatedAt: validDate(repo.updatedAt),
          lastSeenAt: now,
        },
      });

      if (!shouldCapture) {
        skipped += 1;
        continue;
      }

      try {
        await prisma.repositorySnapshot.create({
          data: {
            repoFullName: repo.fullName,
            stars: Math.max(0, Math.round(repo.stars)),
            forks: Math.max(0, Math.round(repo.forks)),
            capturedAt: now,
          },
        });
        captured += 1;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          skipped += 1;
        } else {
          throw error;
        }
      }
    }

    return {
      captured,
      skipped,
      tracked: await prisma.trackedRepository.count(),
    };
  }

  async getRepoGrowth(
    fullNames: string[],
    now = new Date(),
  ): Promise<Map<string, RepoGrowth>> {
    const since = new Date(
      now.getTime() - GROWTH_LOOKBACK_DAYS * 86_400_000,
    );
    const rows = await prisma.repositorySnapshot.findMany({
      where: {
        repoFullName: { in: fullNames },
        capturedAt: { gte: since, lte: now },
      },
      orderBy: { capturedAt: "asc" },
    });

    const grouped = new Map<
      string,
      { capturedAt: Date; stars: number; forks: number }[]
    >();
    for (const row of rows) {
      const key = row.repoFullName.toLowerCase();
      const points = grouped.get(key) ?? [];
      points.push(row);
      grouped.set(key, points);
    }

    const result = new Map<string, RepoGrowth>();
    for (const name of fullNames) {
      const points = grouped.get(name.toLowerCase()) ?? [];
      result.set(name, computeRepoGrowth(toRawPoints(points), now.getTime()));
    }
    return result;
  }

  async getHistory(
    fullName: string,
    now = new Date(),
  ): Promise<SnapshotHistory> {
    const canonical = await prisma.trackedRepository.findFirst({
      where: { fullName: { equals: fullName, mode: "insensitive" } },
      select: { fullName: true },
    });
    if (!canonical) {
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

    const points = await prisma.repositorySnapshot.findMany({
      where: {
        repoFullName: canonical.fullName,
        capturedAt: {
          gte: new Date(now.getTime() - RETENTION_DAYS * 86_400_000),
          lte: now,
        },
      },
      orderBy: { capturedAt: "asc" },
    });

    const mapped = points.map((point) => ({
      capturedAt: point.capturedAt.toISOString(),
      stars: point.stars,
      forks: point.forks,
    }));

    return {
      fullName: canonical.fullName,
      points: mapped,
      firstAt: mapped[0]?.capturedAt ?? null,
      lastAt: mapped[mapped.length - 1]?.capturedAt ?? null,
      totalPoints: mapped.length,
      earliestStars: mapped[0]?.stars ?? null,
      latestStars: mapped[mapped.length - 1]?.stars ?? null,
    };
  }

  async getHistories(
    fullNames: string[],
    now = new Date(),
  ): Promise<Map<string, SnapshotHistory>> {
    const result = new Map<string, SnapshotHistory>();
    const names = [...new Set(fullNames)];
    if (names.length === 0) return result;

    const since = new Date(
      now.getTime() - SPARKLINE_LOOKBACK_DAYS * 86_400_000,
    );
    const rows = await prisma.repositorySnapshot.findMany({
      where: {
        repoFullName: { in: names },
        capturedAt: { gte: since, lte: now },
      },
      orderBy: { capturedAt: "asc" },
    });

    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.repoFullName.toLowerCase();
      const points = grouped.get(key) ?? [];
      points.push(row);
      grouped.set(key, points);
    }

    for (const name of names) {
      const points = grouped.get(name.toLowerCase()) ?? [];
      const mapped = points.map((point) => ({
        capturedAt: point.capturedAt.toISOString(),
        stars: point.stars,
        forks: point.forks,
      }));
      result.set(name, {
        fullName: points[0]?.repoFullName ?? name,
        points: mapped,
        firstAt: mapped[0]?.capturedAt ?? null,
        lastAt: mapped[mapped.length - 1]?.capturedAt ?? null,
        totalPoints: mapped.length,
        earliestStars: mapped[0]?.stars ?? null,
        latestStars: mapped[mapped.length - 1]?.stars ?? null,
      });
    }

    return result;
  }

  async getLeaderboard(
    window: GrowthWindow,
    limit: number,
    now = new Date(),
  ): Promise<LeaderboardEntry[]> {
    const since = new Date(
      now.getTime() - GROWTH_LOOKBACK_DAYS * 86_400_000,
    );
    const repos = await prisma.trackedRepository.findMany({
      where: { snapshots: { some: { capturedAt: { gte: since } } } },
      include: {
        snapshots: {
          where: { capturedAt: { gte: since, lte: now } },
          orderBy: { capturedAt: "asc" },
        },
      },
    });

    const entries: LeaderboardEntry[] = [];
    for (const repo of repos) {
      if (repo.snapshots.length < 2) continue;
      const latest = repo.snapshots[repo.snapshots.length - 1];
      const growth = computeGrowthForWindow(
        toRawPoints(repo.snapshots),
        window,
        now.getTime(),
      );
      if (!growth.available) continue;
      const weekly = computeGrowthForWindow(
        toRawPoints(repo.snapshots),
        "7d",
        now.getTime(),
      );
      growth.momentum = computeMomentum(growth, weekly);
      entries.push({
        repo: {
          fullName: repo.fullName,
          name: repo.name,
          owner: repo.owner,
          description: repo.description,
          language: repo.language,
          htmlUrl: repo.htmlUrl,
          avatarUrl: repo.avatarUrl,
          topics: repo.topics,
          createdAt: repo.createdAt.toISOString(),
          stars: latest.stars,
          forks: latest.forks,
        },
        growth,
      });
    }

    entries.sort((a, b) => {
      const deltaA = a.growth.starsGained ?? Number.NEGATIVE_INFINITY;
      const deltaB = b.growth.starsGained ?? Number.NEGATIVE_INFINITY;
      if (deltaA !== deltaB) return deltaB - deltaA;
      return (
        (b.growth.growthPct ?? Number.NEGATIVE_INFINITY) -
        (a.growth.growthPct ?? Number.NEGATIVE_INFINITY)
      );
    });

    return entries.slice(0, limit);
  }

  async getStatus(now = new Date()): Promise<SnapshotStatus> {
    const [trackedRepos, snapshotCount, oldest, newest, starsResult] =
      await Promise.all([
        prisma.trackedRepository.count(),
        prisma.repositorySnapshot.count(),
        prisma.repositorySnapshot.findFirst({
          orderBy: { capturedAt: "asc" },
          select: { capturedAt: true },
        }),
        prisma.repositorySnapshot.findFirst({
          orderBy: { capturedAt: "desc" },
          select: { capturedAt: true },
        }),
        prisma.$queryRaw<{ total: bigint | number }[]>`
          SELECT COALESCE(SUM(latest.stars), 0) AS total
          FROM (
            SELECT DISTINCT ON (repo_full_name) stars
            FROM repository_snapshots
            ORDER BY repo_full_name, captured_at DESC
          ) AS latest
        `,
      ]);

    const since = new Date(
      now.getTime() - GROWTH_LOOKBACK_DAYS * 86_400_000,
    );
    const reposWithPoints = await prisma.trackedRepository.findMany({
      where: { snapshots: { some: { capturedAt: { gte: since } } } },
      include: {
        snapshots: {
          where: { capturedAt: { gte: since, lte: now } },
          orderBy: { capturedAt: "asc" },
        },
      },
    });

    let available24h = 0;
    let available7d = 0;
    for (const repo of reposWithPoints) {
      if (repo.snapshots.length < 2) continue;
      const raw = toRawPoints(repo.snapshots);
      if (computeGrowthForWindow(raw, "24h", now.getTime()).available) {
        available24h += 1;
      }
      if (computeGrowthForWindow(raw, "7d", now.getTime()).available) {
        available7d += 1;
      }
    }

    const totalStars = starsResult[0]?.total;
    return {
      driver: this.driver,
      trackedRepos,
      snapshotCount,
      starsTracked:
        typeof totalStars === "bigint" ? Number(totalStars) : (totalStars ?? 0),
      oldestSnapshotAt: oldest?.capturedAt.toISOString() ?? null,
      newestSnapshotAt: newest?.capturedAt.toISOString() ?? null,
      available24h,
      available7d,
      writable: true,
      note: null,
    };
  }
}
