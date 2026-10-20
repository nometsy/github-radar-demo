import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiErrorResponse } from "@/lib/api-types";
import { GitHubApiError } from "@/lib/github/errors";
import { getRateLimitSnapshot } from "@/lib/github/rate-limit";
import { StoreConfigurationError } from "@/lib/radar/store-types";

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAt: string | null;

  constructor(
    message: string,
    options: { code: string; status: number; retryAt?: string | null },
  ) {
    super(message);
    this.name = "AppError";
    this.code = options.code;
    this.status = options.status;
    this.retryAt = options.retryAt ?? null;
  }
}

function body(
  code: string,
  message: string,
  status: number,
  extras?: Partial<ApiErrorResponse["error"]>,
): ApiErrorResponse {
  return {
    error: {
      code,
      message,
      status,
      ...extras,
    },
  };
}

export function errorResponse(error: unknown): NextResponse<ApiErrorResponse> {
  if (error instanceof ZodError) {
    return NextResponse.json(
      body("INVALID_REQUEST", "Some request parameters are invalid.", 400, {
        issues: error.issues.slice(0, 8).map((issue) => ({
          path: issue.path.join(".") || "request",
          message: issue.message,
        })),
      }),
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      body(error.code, error.message, error.status, {
        retryAt: error.retryAt,
      }),
      { status: error.status },
    );
  }

  if (error instanceof StoreConfigurationError) {
    return NextResponse.json(
      body(
        "SNAPSHOT_STORAGE_UNAVAILABLE",
        "Snapshot storage is not configured correctly. Check RADAR_STORAGE and DATABASE_URL, then run the Prisma migration.",
        503,
      ),
      { status: 503 },
    );
  }

  if (error instanceof GitHubApiError) {
    switch (error.code) {
      case "NOT_FOUND":
        return NextResponse.json(
          body("GITHUB_NOT_FOUND", "Repository not found on GitHub.", 404),
          { status: 404 },
        );
      case "RATE_LIMITED":
        return NextResponse.json(
          body(
            "GITHUB_RATE_LIMITED",
            "GitHub's API rate limit has been reached. Add GITHUB_TOKEN or try again after the reset.",
            429,
            {
              retryAt: error.retryAt,
              rateLimit: getRateLimitSnapshot(),
            },
          ),
          {
            status: 429,
            headers: error.retryAt
              ? { "Retry-After": String(Math.max(1, Math.ceil((new Date(error.retryAt).getTime() - Date.now()) / 1000))) }
              : undefined,
          },
        );
      case "UNAUTHORIZED":
      case "FORBIDDEN":
        return NextResponse.json(
          body(
            "GITHUB_ACCESS_DENIED",
            "GitHub rejected the request. Check the server token in .env.local.",
            502,
            { rateLimit: getRateLimitSnapshot() },
          ),
          { status: 502 },
        );
      case "TIMEOUT":
      case "NETWORK":
        return NextResponse.json(
          body(
            "GITHUB_UNREACHABLE",
            "GitHub could not be reached. Check your connection and try again.",
            502,
          ),
          { status: 502 },
        );
      default:
        return NextResponse.json(
          body(
            "GITHUB_UPSTREAM_ERROR",
            "GitHub returned an unexpected response. Try again shortly.",
            502,
          ),
          { status: 502 },
        );
    }
  }

  console.error("[github-radar] Unhandled API error:", error);
  return NextResponse.json(
    body("INTERNAL_ERROR", "An unexpected server error occurred.", 500),
    { status: 500 },
  );
}

export function jsonError(
  code: string,
  message: string,
  status: number,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(body(code, message, status), { status });
}
