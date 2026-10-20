import { clamp } from "@/lib/utils";
import type {
  GrowthMetrics,
  GrowthUnavailableReason,
  GrowthWindow,
  RawSnapshotPoint,
  RepoGrowth,
} from "@/lib/radar/types";

const HOUR_MS = 3_600_000;

interface WindowRule {
  windowMs: number;
  minBaselineAgeMs: number;
  maxBaselineAgeMs: number;
  maxLatestAgeMs: number;
}

export const GROWTH_RULES: Record<GrowthWindow, WindowRule> = {
  "24h": {
    windowMs: 24 * HOUR_MS,
    // For a "24h" reading we accept a baseline between 18 and 30 hours old.
    minBaselineAgeMs: 18 * HOUR_MS,
    maxBaselineAgeMs: 30 * HOUR_MS,
    maxLatestAgeMs: 12 * HOUR_MS,
  },
  "7d": {
    windowMs: 7 * 24 * HOUR_MS,
    // For a "7d" reading we accept a baseline between 5.25 and 8.75 days old.
    minBaselineAgeMs: 5.25 * 24 * HOUR_MS,
    maxBaselineAgeMs: 8.75 * 24 * HOUR_MS,
    maxLatestAgeMs: 48 * HOUR_MS,
  },
};

function unavailable(
  window: GrowthWindow,
  reason: GrowthUnavailableReason,
  samples: number,
): GrowthMetrics {
  return {
    window,
    available: false,
    reason,
    starsGained: null,
    growthPct: null,
    momentum: null,
    intervalHours: null,
    baselineAt: null,
    latestAt: null,
    samples,
  };
}

export function computeGrowthForWindow(
  rawPoints: RawSnapshotPoint[],
  window: GrowthWindow,
  now = Date.now(),
): GrowthMetrics {
  const points = rawPoints
    .filter(
      (point) =>
        Number.isFinite(point.t) &&
        Number.isFinite(point.stars) &&
        point.stars >= 0 &&
        point.t <= now + HOUR_MS,
    )
    .slice()
    .sort((a, b) => a.t - b.t);

  if (points.length < 2) {
    return unavailable(window, "not_enough_snapshots", points.length);
  }

  const rule = GROWTH_RULES[window];
  const latest = points[points.length - 1];
  const latestAge = now - latest.t;

  if (latestAge > rule.maxLatestAgeMs) {
    const result = unavailable(window, "snapshot_too_old", points.length);
    result.latestAt = new Date(latest.t).toISOString();
    return result;
  }

  const eligibleBaselines = points.filter((point) => {
    const age = now - point.t;
    return age >= rule.minBaselineAgeMs && age <= rule.maxBaselineAgeMs;
  });

  if (eligibleBaselines.length === 0) {
    const result = unavailable(window, "no_baseline", points.length);
    result.latestAt = new Date(latest.t).toISOString();
    return result;
  }

  // The newest eligible point is closest to the requested window.
  const baseline = eligibleBaselines[eligibleBaselines.length - 1];
  const starsGained = latest.stars - baseline.stars;
  const growthPct =
    baseline.stars > 0 ? (starsGained / baseline.stars) * 100 : null;
  const intervalHours = (latest.t - baseline.t) / HOUR_MS;

  return {
    window,
    available: true,
    reason: null,
    starsGained,
    growthPct: growthPct === null ? null : round(growthPct, 2),
    momentum: null,
    intervalHours: round(intervalHours, 1),
    baselineAt: new Date(baseline.t).toISOString(),
    latestAt: new Date(latest.t).toISOString(),
    samples: points.length,
  };
}

/**
 * A transparent, heuristic score built only from measured snapshots.
 * It is not a GitHub metric. Zero or negative growth always scores 0.
 */
export function computeMomentum(
  daily: GrowthMetrics,
  weekly: GrowthMetrics | null,
): number | null {
  if (!daily.available || daily.starsGained === null) return null;
  if (daily.starsGained <= 0) return 0;

  const absolute =
    (Math.log10(daily.starsGained + 1) / Math.log10(1001)) * 40;
  const relative =
    (clamp(daily.growthPct ?? 0, 0, 30) / 30) * 35;

  let consistency = 0;
  if (
    weekly?.available &&
    weekly.starsGained !== null &&
    weekly.starsGained > 0
  ) {
    const weeklyDailyAverage = weekly.starsGained / 7;
    const ratio = daily.starsGained / Math.max(weeklyDailyAverage, 0.01);
    consistency = clamp(ratio, 0, 2.5) * 6;
  }

  const freshness =
    daily.intervalHours === null
      ? 0
      : clamp(1 - Math.abs(daily.intervalHours - 24) / 24, 0, 1) * 5;

  return Math.round(clamp(20 + absolute + relative + consistency + freshness, 0, 100));
}

export function computeRepoGrowth(
  rawPoints: RawSnapshotPoint[],
  now = Date.now(),
): RepoGrowth {
  const daily = computeGrowthForWindow(rawPoints, "24h", now);
  const weekly = computeGrowthForWindow(rawPoints, "7d", now);
  const momentum = computeMomentum(daily, weekly);
  daily.momentum = momentum;
  weekly.momentum = weekly.available
    ? computeMomentum(weekly, null)
    : null;
  return { "24h": daily, "7d": weekly };
}

export function isGrowthAvailable(growth: RepoGrowth): boolean {
  return growth["24h"].available || growth["7d"].available;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
