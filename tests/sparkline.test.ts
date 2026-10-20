import assert from "node:assert/strict";
import test from "node:test";
import { buildSparkline } from "../src/lib/radar/sparkline";

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);

function points(stars: number[]) {
  return stars.map((value, index) => ({
    capturedAt: new Date(NOW - (stars.length - index) * HOUR).toISOString(),
    stars: value,
    forks: 0,
  }));
}

test("a single snapshot does not invent a trend line", () => {
  assert.equal(buildSparkline(points([100])), null);
  assert.equal(buildSparkline([]), null);
  assert.equal(buildSparkline(points([Number.NaN, 120])), null);
});

test("sparkline keeps measured endpoints and coverage", () => {
  const data = buildSparkline(points([100, 130, 160]));
  assert.ok(data);
  assert.deepEqual(data.points, [100, 130, 160]);
  assert.equal(data.totalPoints, 3);
  assert.equal(data.sampled, false);
  assert.equal(data.firstAt, points([100, 130, 160])[0].capturedAt);
  assert.equal(data.lastAt, points([100, 130, 160])[2].capturedAt);
});

test("long histories are evenly downsampled without losing endpoints", () => {
  const stars = Array.from({ length: 120 }, (_, index) => 100 + index * 5);
  const data = buildSparkline(points(stars), 32);
  assert.ok(data);
  assert.equal(data.points.length, 32);
  assert.equal(data.totalPoints, 120);
  assert.equal(data.points[0], 100);
  assert.equal(data.points.at(-1), 695);
  assert.equal(data.sampled, true);
});
