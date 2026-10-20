import type { GrowthMetrics } from "@/lib/radar/types";

/** Visual emphasis only; never estimates or changes growth measurements. */
export function isHotGrowth(metrics: GrowthMetrics): boolean {
  return metrics.available &&
    metrics.starsGained !== null && metrics.starsGained > 0 &&
    metrics.momentum !== null && Number.isFinite(metrics.momentum) &&
    metrics.momentum >= 70;
}
