import { getServerEnv } from "@/lib/env";
import { FileSnapshotStore } from "@/lib/radar/file-store";
import type { SnapshotStore } from "@/lib/radar/store-types";
import { StoreConfigurationError } from "@/lib/radar/store-types";

interface StoreGlobal {
  __githubRadarSnapshotStore?: Promise<SnapshotStore>;
}

const globalStore = globalThis as typeof globalThis & StoreGlobal;

async function createStore(): Promise<SnapshotStore> {
  const env = getServerEnv();

  // Vercel's filesystem is ephemeral and mostly read-only. A file store would
  // silently lose every snapshot between invocations, so fail with a clear
  // instruction instead of showing an empty growth history later.
  if (process.env.VERCEL && env.storageDriver === "file") {
    throw new StoreConfigurationError(
      "RADAR_STORAGE=file cannot persist snapshots on Vercel. Set RADAR_STORAGE=postgres and DATABASE_URL, then run the Prisma migration.",
    );
  }

  if (env.storageDriver === "postgres") {
    if (!env.databaseUrl) {
      throw new StoreConfigurationError(
        "RADAR_STORAGE=postgres requires DATABASE_URL in the server environment.",
      );
    }
    const { PrismaSnapshotStore } = await import(
      "@/lib/radar/prisma-store"
    );
    return new PrismaSnapshotStore();
  }
  return new FileSnapshotStore();
}

export function getSnapshotStore(): Promise<SnapshotStore> {
  if (!globalStore.__githubRadarSnapshotStore) {
    globalStore.__githubRadarSnapshotStore = createStore();
  }
  return globalStore.__githubRadarSnapshotStore;
}

export function resetSnapshotStore(): void {
  globalStore.__githubRadarSnapshotStore = undefined;
}

export type { SnapshotStore } from "@/lib/radar/store-types";
export { StoreConfigurationError } from "@/lib/radar/store-types";
