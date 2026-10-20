import assert from "node:assert/strict";
import test from "node:test";
import { readLocalValue, writeLocalValue } from "../src/lib/local-storage";

test("reads persisted values and detects changes from another tab", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } },
  });
  try {
    const fallback: string[] = [];
    const key = "persisted-test";
    writeLocalValue(key, ["vercel/next.js"], JSON.stringify);
    assert.equal(values.get(key), '["vercel/next.js"]');
    const first = readLocalValue(key, JSON.parse, fallback);
    assert.strictEqual(readLocalValue(key, JSON.parse, fallback), first);
    values.set(key, '["facebook/react"]');
    assert.deepEqual(readLocalValue(key, JSON.parse, fallback), ["facebook/react"]);
    values.set(key, "invalid JSON");
    assert.strictEqual(readLocalValue(key, JSON.parse, fallback), fallback);
    values.delete(key);
    assert.strictEqual(readLocalValue(key, JSON.parse, fallback), fallback);
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("keeps session changes when localStorage writes are blocked", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: {
      getItem: () => null,
      setItem: () => { throw new Error("QuotaExceededError"); },
    } },
  });
  try {
    const fallback: string[] = [];
    const saved = ["vercel/next.js"];
    writeLocalValue("blocked-test", saved, JSON.stringify);
    assert.strictEqual(readLocalValue("blocked-test", JSON.parse, fallback), saved);
    assert.strictEqual(readLocalValue("blocked-test", JSON.parse, fallback), saved);
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
