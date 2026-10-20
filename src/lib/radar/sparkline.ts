import type { SnapshotPoint } from "@/lib/radar/types";

/** Number of days of stored points used for the compact card sparkline. */
export const SPARKLINE_LOOKBACK_DAYS = 10;
export const SPARKLINE_MAX_POINTS = 32;

export interface SparklineData {
  /** Measured star counts, oldest first. Never interpolated values. */
  points: number[];
  firstAt: string;
  lastAt: string;
  totalPoints: number;
  sampled: boolean;
}

/**
 * Converts stored snapshot points into a compact series. Fewer than two measured
 * points return null: a single dot is not a trend and must not be drawn as one.
 */
export function buildSparkline(
  points: SnapshotPoint[],
  maxPoints = SPARKLINE_MAX_POINTS,
): SparklineData | null {
  if (maxPoints < 2) return null;
  const valid = points.filter(
    (point) => Number.isFinite(point.stars) && !Number.isNaN(Date.parse(point.capturedAt)),
  );
  if (valid.length < 2) return null;

  const first = valid[0];
  const last = valid[valid.length - 1];
  const sampled = valid.length > maxPoints;
  const selected = sampled
    ? Array.from({ length: maxPoints }, (_, index) => {
        const position = Math.round((index * (valid.length - 1)) / (maxPoints - 1));
        return valid[position];
      })
    : valid;

  return {
    points: selected.map((point) => point.stars),
    firstAt: first.capturedAt,
    lastAt: last.capturedAt,
    totalPoints: valid.length,
    sampled,
  };
}
