import type { ApiErrorResponse } from "@/lib/api-types";
import type { RateLimitSnapshot } from "@/lib/github/types";

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAt: string | null;
  readonly rateLimit?: RateLimitSnapshot;
  readonly issues?: { path: string; message: string }[];

  constructor(
    message: string,
    options: {
      code: string;
      status: number;
      retryAt?: string | null;
      rateLimit?: RateLimitSnapshot;
      issues?: { path: string; message: string }[];
    },
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = options.code;
    this.status = options.status;
    this.retryAt = options.retryAt ?? null;
    this.rateLimit = options.rateLimit;
    this.issues = options.issues;
  }
}

export async function apiFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError("The server returned an invalid response.", {
      code: "INVALID_RESPONSE",
      status: response.status,
    });
  }

  if (!response.ok) {
    const errorBody = payload as Partial<ApiErrorResponse>;
    const detail = errorBody?.error;
    throw new ApiClientError(detail?.message ?? "Request failed.", {
      code: detail?.code ?? "REQUEST_FAILED",
      status: detail?.status ?? response.status,
      retryAt: detail?.retryAt,
      rateLimit: detail?.rateLimit,
      issues: detail?.issues,
    });
  }

  return payload as T;
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "" || value === false) {
      continue;
    }
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}
