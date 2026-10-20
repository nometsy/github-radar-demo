import os from "node:os";
import path from "node:path";

/**
 * Runtime directory for JSON state: snapshot data and the GitHub response cache.
 *
 * RADAR_DATA_DIR lets a host mount a persistent volume (for example /var/data
 * on Render or Railway). Vercel's project filesystem is read-only, so the
 * disposable cache falls back to /tmp there; snapshots must use PostgreSQL on
 * Vercel (enforced in src/lib/radar/store.ts).
 */
export function getDataDir(): string {
  const configured = process.env.RADAR_DATA_DIR?.trim();
  if (configured) return path.resolve(configured);
  if (process.env.VERCEL) return path.join(os.tmpdir(), "github-radar");
  return path.join(process.cwd(), ".data");
}
