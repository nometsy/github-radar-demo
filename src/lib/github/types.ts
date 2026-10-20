export type SortDirection = "asc" | "desc";

export interface RepoOwner {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
}

export interface RepoLicense {
  key: string | null;
  name: string;
  spdxId: string | null;
}

export interface RepoSummary {
  id: number;
  name: string;
  fullName: string;
  owner: RepoOwner;
  description: string | null;
  htmlUrl: string;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number | null;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
  topics: string[];
  archived: boolean;
  fork: boolean;
  license: RepoLicense | null;
  homepage: string | null;
  defaultBranch: string;
  sizeKb: number | null;
}

export interface RepoDetails extends RepoSummary {
  subscribersCount: number | null;
  networkCount: number | null;
  hasIssues: boolean;
  hasDiscussions: boolean;
  hasWiki: boolean;
  hasPages: boolean;
  hasProjects: boolean;
}

export interface ReleaseSummary {
  id: number;
  tagName: string;
  name: string;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  createdAt: string;
  publishedAt: string | null;
  htmlUrl: string;
  authorLogin: string;
  authorAvatarUrl: string;
}

export interface ReadmePayload {
  name: string;
  path: string;
  htmlUrl: string | null;
  markdown: string;
  truncated: boolean;
}

export interface RateLimitBucket {
  resource: "core" | "search";
  limit: number;
  remaining: number;
  used: number;
  resetAt: number | null;
  updatedAt: string;
}

export interface RateLimitSnapshot {
  core: RateLimitBucket | null;
  search: RateLimitBucket | null;
  tokenConfigured: boolean;
}
