export type GitHubErrorCode =
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "UPSTREAM"
  | "NETWORK"
  | "TIMEOUT"
  | "INVALID_RESPONSE";

export class GitHubApiError extends Error {
  readonly code: GitHubErrorCode;
  readonly status: number;
  readonly retryAt: string | null;

  constructor(
    message: string,
    options: {
      code: GitHubErrorCode;
      status: number;
      retryAt?: string | null;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "GitHubApiError";
    this.code = options.code;
    this.status = options.status;
    this.retryAt = options.retryAt ?? null;
  }
}
