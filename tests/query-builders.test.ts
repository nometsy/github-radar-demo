import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFreshQuery,
  buildRepoSearchQuery,
  buildSmartSearchQuery,
  buildTrendingQuery,
  getTrendingLane,
  mapSearchSort,
  sanitizeSearchText,
  sanitizeTopic,
  toGitHubDate,
} from "../src/lib/github/query";

const NOW = Date.UTC(2026, 9, 19, 12, 0, 0);

test("builds a safe repository query with all filters", () => {
  const query = buildRepoSearchQuery({
    language: "Jupyter Notebook",
    topic: "Machine Learning!",
    minStars: 50,
    minForks: 5,
    createdAfter: new Date(NOW - 7 * 86_400_000),
    includeForks: false,
  });

  assert.match(query, /language:"Jupyter Notebook"/);
  assert.match(query, /topic:machine-learning/);
  assert.match(query, /stars:>=50/);
  assert.match(query, /forks:>=5/);
  assert.match(query, /created:>=2026-10-12T12:00:00Z/);
  assert.match(query, /fork:false/);
  assert.match(query, /archived:false/);
});

test("strips control characters and whitespace from free text", () => {
  assert.equal(
    sanitizeSearchText("  ai\nagent\u0000  framework  "),
    "ai agent framework",
  );
  assert.equal(sanitizeTopic("AI Agents"), "ai-agents");
});

test("uses a numeric range when both star bounds exist", () => {
  const query = buildRepoSearchQuery({ minStars: 30, maxStars: 2500 });
  assert.match(query, /stars:30\.\.2500/);
});

test("adds in:fields only for plain keyword searches", () => {
  const query = buildSmartSearchQuery({ q: "agent framework", now: NOW });
  assert.match(query, /in:name,description,readme/);

  const qualified = buildSmartSearchQuery({
    q: "agent in:readme",
    now: NOW,
  });
  assert.doesNotMatch(qualified, /in:name,description,readme/);
});

test("fresh query uses a rolling UTC timestamp", () => {
  const query = buildFreshQuery({ hours: 72, minStars: 10, now: NOW });
  assert.match(query, /created:>=2026-10-16T12:00:00Z/);
  assert.match(query, /stars:>=10/);
});

test("fresh query supports hour-level windows", () => {
  const query = buildFreshQuery({ hours: 6, minStars: 0, now: NOW });
  assert.match(query, /created:>=2026-10-19T06:00:00Z/);
});

test("relative windows reuse a five-minute cache bucket", () => {
  const first = buildFreshQuery({ hours: 24, now: NOW });
  const sameBucket = buildFreshQuery({ hours: 24, now: NOW + 4 * 60_000 });
  const nextBucket = buildFreshQuery({ hours: 24, now: NOW + 6 * 60_000 });
  assert.equal(first, sameBucket);
  assert.notEqual(first, nextBucket);
});

test("trending lanes translate relative windows to ISO dates", () => {
  const lane = getTrendingLane("week");
  const query = buildTrendingQuery(lane, NOW);
  assert.match(query, /created:>=2026-07-21T12:00:00Z/);
  assert.match(query, /pushed:>=2026-10-12T12:00:00Z/);
  assert.match(query, /stars:>=100/);
});

test("sort mapping never sends an invalid best-match sort", () => {
  assert.deepEqual(mapSearchSort("best"), { sort: null, order: null });
  assert.deepEqual(mapSearchSort("stars"), {
    sort: "stars",
    order: "desc",
  });
});

test("GitHub timestamps strip milliseconds", () => {
  assert.equal(toGitHubDate(new Date("2026-10-19T12:00:00.123Z")), "2026-10-19T12:00:00Z");
});
