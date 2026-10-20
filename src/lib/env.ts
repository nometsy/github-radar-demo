export type StorageDriver = "file" | "postgres";

export interface ServerEnv {
  githubToken: string | null;
  cronSecret: string | null;
  storageDriver: StorageDriver;
  databaseUrl: string | null;
}

function normalizeStorage(value: string | undefined): StorageDriver {
  if (value === "postgres") return "postgres";
  if (value === "file") return "file";
  // Zero-config default. PostgreSQL is always an explicit opt-in.
  return "file";
}

export function getServerEnv(): ServerEnv {
  return {
    githubToken: process.env.GITHUB_TOKEN?.trim() || null,
    cronSecret: process.env.CRON_SECRET?.trim() || null,
    storageDriver: normalizeStorage(process.env.RADAR_STORAGE),
    databaseUrl: process.env.DATABASE_URL?.trim() || null,
  };
}

export function isGitHubTokenConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN?.trim());
}
