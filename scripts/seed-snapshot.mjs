/**
 * Verification helper: seeds a 24h baseline snapshot for one repository so the
 * measured-growth path can be checked without waiting a full day.
 * Usage: node scripts/seed-snapshot.mjs <owner/name>
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const target = process.argv[2];
if (!target || !target.includes("/")) {
  console.error("usage: node scripts/seed-snapshot.mjs <owner/name>");
  process.exit(1);
}

const dir = path.join(process.cwd(), ".data");
const file = path.join(dir, "radar.json");

let data = { version: 1, repos: {}, snapshots: {}, updatedAt: Date.now() };
try {
  const raw = await readFile(file, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed && parsed.version === 1) data = parsed;
} catch {
  // A fresh store is fine.
}

const now = Date.now();
const stars = 254313;
const existing = Array.isArray(data.snapshots[target]) ? data.snapshots[target] : [];
const latest = existing.length ? existing[existing.length - 1] : { t: now, s: stars, f: 30735 };

data.snapshots[target] = [
  { t: latest.t - 24 * 3_600_000, s: latest.s - 420, f: latest.f },
  { t: latest.t, s: latest.s, f: latest.f },
];

data.repos[target] = {
  fullName: target,
  name: target.split("/")[1],
  owner: target.split("/")[0],
  description: null,
  language: "TypeScript",
  htmlUrl: `https://github.com/${target}`,
  avatarUrl: "",
  topics: [],
  createdAt: "2026-08-13T11:56:32Z",
  lastSeenAt: now,
};

data.updatedAt = now;

await mkdir(dir, { recursive: true });
await writeFile(file, JSON.stringify(data), "utf8");
console.log(
  `seeded ${target}: baseline ${new Date(latest.t - 24 * 3_600_000).toISOString()} stars=${latest.s - 420} -> ${new Date(latest.t).toISOString()} stars=${latest.s}`,
);
