"use client";

import type { SparklineData } from "@/lib/radar/sparkline";
import { cn, formatDate, formatNumber } from "@/lib/utils";

const WIDTH = 100;
const HEIGHT = 28;
const PADDING = 3;

/**
 * Draws only stored snapshot points. It is never generated from stars/day,
 * repository age, or an interpolated baseline.
 */
export function Sparkline({
  data,
  className,
}: {
  data: SparklineData;
  className?: string;
}) {
  if (data.points.length < 2) return null;

  const first = data.points[0];
  const last = data.points[data.points.length - 1];
  const low = Math.min(...data.points);
  const high = Math.max(...data.points);
  const flat = high === low;
  const span = flat ? 1 : high - low;

  const coordinates = data.points
    .map((value, index) => {
      const x = (index / (data.points.length - 1)) * WIDTH;
      const y = flat
        ? HEIGHT / 2
        : HEIGHT - PADDING - ((value - low) / span) * (HEIGHT - PADDING * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const rising = last >= first;
  const label = `Measured star history from ${formatDate(data.firstAt)} to ${formatDate(
    data.lastAt,
  )}: ${formatNumber(first)} to ${formatNumber(last)} stars across ${
    data.totalPoints
  } stored snapshots.`;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        className={cn(
          "h-7 min-w-0 flex-1",
          rising ? "text-primary" : "text-destructive",
        )}
      >
        <title>{label}</title>
        <polyline
          points={coordinates}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        aria-hidden
        className="shrink-0 font-mono text-[10px] text-muted-foreground"
      >
        {data.sampled ? `${data.totalPoints} pts` : `${data.totalPoints} snapshots`}
      </span>
    </div>
  );
}
