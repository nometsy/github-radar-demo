import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePersistedCache,
  serializePersistedCache,
  type PersistedCacheEntry,
} from "../src/lib/github/persistent-cache";

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);

function entry(overrides: Partial<PersistedCacheEntry> = {}): PersistedCacheEntry {
  return {
    data: { total_count: 2, items: [] },
    fetchedAt: new Date(NOW - 60_000).toISOString(),
    expiresAt: NOW + 60_000,
    staleUntil: NOW + 3_600_000,
    ...overrides,
  };
}

test("cache file round-trips validated entries", () => {
  const raw = serializePersistedCache(new Map([["search:/q", entry()]]), NOW);
  const parsed = parsePersistedCache(raw, NOW);
  assert.equal(parsed.size, 1);
  assert.deepEqual(parsed.get("search:/q")?.data, entry().data);
  assert.equal(parsed.get("search:/q")?.fetchedAt, entry().fetchedAt);
});

test("malformed cache files are ignored instead of crashing requests", () => {
  assert.equal(parsePersistedCache("{not json", NOW).size, 0);
  assert.equal(parsePersistedCache(JSON.stringify({ version: 99 }), NOW).size, 0);
  assert.equal(
    parsePersistedCache(
      JSON.stringify({ version: 1, entries: { key: { data: {} } } }),
      NOW,
    ).size,
    0,
  );
});

test("entries past their stale window are not restored", () => {
  const raw = serializePersistedCache(
    new Map([
      ["fresh", entry()],
      ["stale", entry({ staleUntil: NOW - 1 })],
    ]),
    NOW,
  );
  const parsed = parsePersistedCache(raw, NOW);
  assert.deepEqual([...parsed.keys()], ["fresh"]);
});

test("the persisted cache is bounded", () => {
  const entries = new Map<string, PersistedCacheEntry>();
  for (let index = 0; index < 250; index += 1) {
    entries.set(`key-${index}`, entry({ fetchedAt: new Date(NOW - index * 1000).toISOString() }));
  }
  const parsed = parsePersistedCache(serializePersistedCache(entries, NOW), NOW, 200);
  assert.equal(parsed.size, 200);
  assert.ok(parsed.has("key-0"));
  assert.ok(!parsed.has("key-249"));
});
