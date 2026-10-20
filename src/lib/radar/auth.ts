import { timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/api-error";
import { getServerEnv } from "@/lib/env";

function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Snapshot writes are open in local development but locked in production
 * unless CRON_SECRET is configured.
 */
export function requireCollectorAuth(request: Request): void {
  const secret = getServerEnv().cronSecret;
  const production = process.env.NODE_ENV === "production";

  if (!secret) {
    if (production) {
      throw new AppError(
        "Snapshot collection is locked. Set CRON_SECRET in the server environment to enable scheduled captures.",
        { code: "COLLECTOR_LOCKED", status: 503 },
      );
    }
    return;
  }

  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;
  const provided =
    bearer ||
    request.headers.get("x-radar-secret") ||
    new URL(request.url).searchParams.get("secret") ||
    "";

  if (!provided || !safeEqual(provided, secret)) {
    throw new AppError("Collector authentication failed.", {
      code: "UNAUTHORIZED",
      status: 401,
    });
  }
}
