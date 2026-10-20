import assert from "node:assert/strict";
import test from "node:test";
import { isHotGrowth } from "../src/lib/radar/presentation";
import type { GrowthMetrics } from "../src/lib/radar/types";
import {
  computeGrowthForWindow,
  computeMomentum,
  computeRepoGrowth,
} from "../src/lib/radar/growth";

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 19, 12, 0, 0);

const hotMetrics: GrowthMetrics = {
  window: "24h", available: true, reason: null,
  starsGained: 500, growthPct: 20, momentum: 70, intervalHours: 24,
  baselineAt: "2026-10-18T12:00:00Z", latestAt: "2026-10-19T12:00:00Z",
  samples: 2,
};

test("hot accent starts at measured momentum 70 with positive growth", () => {
  assert.equal(isHotGrowth(hotMetrics), true);
  assert.equal(isHotGrowth({ ...hotMetrics, momentum: 100 }), true);
  assert.equal(isHotGrowth({ ...hotMetrics, momentum: 69 }), false);
});

test("missing, flat and negative measurements never receive a hot accent", () => {
  for (const override of [
    { available: false }, { starsGained: 0 }, { starsGained: -50 },
    { starsGained: null }, { momentum: null }, { momentum: Number.NaN },
  ]) {
    assert.equal(isHotGrowth({ ...hotMetrics, ...override }), false);
  }
});

function points(entries: [number, number][]) {
  return entries.map(([hoursAgo, stars]) => ({
    t: NOW - hoursAgo * HOUR,
    stars,
    forks: 0,
  }));
}

test("measures 24h growth from a snapshot near the baseline", () => {
  const metrics = computeGrowthForWindow(
    points([
      [24, 1000],
      [12, 1100],
      [1, 1250],
    ]),
    "24h",
    NOW,
  );

  assert.equal(metrics.available, true);
  assert.equal(metrics.starsGained, 250);
  assert.equal(metrics.growthPct, 25);
  assert.equal(metrics.intervalHours, 23);
});

test("refuses to invent a baseline when history is too short", () => {
  const metrics = computeGrowthForWindow(
    points([
      [4, 1000],
      [1, 1200],
    ]),
    "24h",
    NOW,
  );

  assert.equal(metrics.available, false);
  assert.equal(metrics.reason, "no_baseline");
  assert.equal(metrics.starsGained, null);
});

test("marks stale data instead of reporting old growth as current", () => {
  const metrics = computeGrowthForWindow(
    points([
      [60, 1000],
      [40, 1200],
    ]),
    "24h",
    NOW,
  );

  assert.equal(metrics.available, false);
  assert.equal(metrics.reason, "snapshot_too_old");
});

test("handles star losses honestly", () => {
  const metrics = computeGrowthForWindow(
    points([
      [24, 2000],
      [1, 1900],
    ]),
    "24h",
    NOW,
  );

  assert.equal(metrics.available, true);
  assert.equal(metrics.starsGained, -100);
  assert.equal(metrics.growthPct, -5);
});

test("7d window requires a baseline in the weekly tolerance band", () => {
  const metrics = computeGrowthForWindow(
    points([
      [7 * 24, 500],
      [3 * 24, 650],
      [1, 900],
    ]),
    "7d",
    NOW,
  );

  assert.equal(metrics.available, true);
  assert.equal(metrics.starsGained, 400);
  assert.equal(metrics.intervalHours, 167);
});

test("momentum stays zero for flat or negative growth", () => {
  const daily = computeGrowthForWindow(
    points([
      [24, 1000],
      [1, 900],
    ]),
    "24h",
    NOW,
  );
  assert.equal(computeMomentum(daily, null), 0);
});

test("momentum is heuristic but bounded", () => {
  const daily = computeGrowthForWindow(
    points([
      [24, 1000],
      [1, 1500],
    ]),
    "24h",
    NOW,
  );
  const weekly = computeGrowthForWindow(
    points([
      [168, 600],
      [1, 1500],
    ]),
    "7d",
    NOW,
  );
  const score = computeMomentum(daily, weekly);
  assert.ok(score !== null);
  assert.ok(score >= 0 && score <= 100);
});

test("repo growth returns both windows with shared momentum", () => {
  const growth = computeRepoGrowth(
    points([
      [168, 500],
      [24, 900],
      [1, 1200],
    ]),
    NOW,
  );

  assert.equal(growth["24h"].available, true);
  assert.equal(growth["7d"].available, true);
  assert.equal(
    growth["24h"].momentum,
    computeMomentum(growth["24h"], growth["7d"]),
  );
});
