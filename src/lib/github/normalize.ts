import type {
  ReadmePayload,
  ReleaseSummary,
  RepoDetails,
  RepoLicense,
  RepoSummary,
} from "@/lib/github/types";
import type {
  RawReadme,
  RawRelease,
  RawRepo,
  RawRepoDetails,
} from "@/lib/github/schemas";
import { isRecord, safeHttpUrl, truncate } from "@/lib/utils";

const MAX_DESCRIPTION = 600;
const MAX_RELEASE_BODY = 8_000;
const MAX_README_CHARS = 160_000;

function sanitizeText(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  if (!cleaned) return null;
  return truncate(cleaned, max);
}

function normalizeTopics(topics: string[] | undefined): string[] {
  if (!topics) return [];
  const unique = new Set<string>();
  for (const topic of topics) {
    if (typeof topic !== "string") continue;
    const cleaned = topic.trim().replace(/[^A-Za-z0-9._-]/g, "");
    if (cleaned) unique.add(cleaned.slice(0, 50));
    if (unique.size >= 12) break;
  }
  return [...unique];
}

function normalizeLicense(raw: RawRepo["license"]): RepoLicense | null {
  if (!raw) return null;
  const name = raw.name?.trim();
  const spdxId = raw.spdx_id?.trim();
  if (!name && !spdxId) return null;
  return {
    key: raw.key ?? null,
    name: name || spdxId || "Unknown license",
    spdxId: spdxId && spdxId !== "NOASSERTION" ? spdxId : null,
  };
}

function fallbackFullName(repo: RawRepo): string {
  return repo.full_name.includes("/")
    ? repo.full_name
    : `${repo.owner.login}/${repo.name}`;
}

export function normalizeRepo(raw: RawRepo): RepoSummary {
  const fullName = fallbackFullName(raw);
  const [fallbackOwner, fallbackRepo] = fullName.split("/");

  return {
    id: raw.id,
    name: raw.name || fallbackRepo || fullName,
    fullName,
    owner: {
      login: raw.owner.login || fallbackOwner || "unknown",
      avatarUrl:
        safeHttpUrl(raw.owner.avatar_url) ||
        `https://github.com/${encodeURIComponent(raw.owner.login)}.png?size=96`,
      htmlUrl:
        safeHttpUrl(raw.owner.html_url) ||
        `https://github.com/${encodeURIComponent(raw.owner.login)}`,
    },
    description: sanitizeText(raw.description, MAX_DESCRIPTION),
    htmlUrl:
      safeHttpUrl(raw.html_url) ||
      `https://github.com/${fullName}`,
    language: raw.language?.trim() || null,
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    openIssues: raw.open_issues_count,
    watchers: raw.watchers_count ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    pushedAt: raw.pushed_at || null,
    topics: normalizeTopics(raw.topics),
    archived: raw.archived ?? false,
    fork: raw.fork ?? false,
    license: normalizeLicense(raw.license),
    homepage: safeHttpUrl(raw.homepage),
    defaultBranch: raw.default_branch?.trim() || "main",
    sizeKb: raw.size ?? null,
  };
}

export function normalizeRepoDetails(raw: RawRepoDetails): RepoDetails {
  const base = normalizeRepo(raw);
  return {
    ...base,
    subscribersCount: raw.subscribers_count ?? null,
    networkCount: raw.network_count ?? null,
    hasIssues: raw.has_issues ?? true,
    hasDiscussions: raw.has_discussions ?? false,
    hasWiki: raw.has_wiki ?? true,
    hasPages: raw.has_pages ?? false,
    hasProjects: raw.has_projects ?? true,
  };
}

export function normalizeRelease(raw: RawRelease): ReleaseSummary {
  return {
    id: raw.id,
    tagName: raw.tag_name,
    name: raw.name?.trim() || raw.tag_name,
    body: sanitizeText(raw.body, MAX_RELEASE_BODY),
    draft: raw.draft ?? false,
    prerelease: raw.prerelease ?? false,
    createdAt: raw.created_at,
    publishedAt: raw.published_at || null,
    htmlUrl:
      safeHttpUrl(raw.html_url) ||
      `https://github.com/releases/tag/${encodeURIComponent(raw.tag_name)}`,
    authorLogin: raw.author?.login || "unknown",
    authorAvatarUrl: safeHttpUrl(raw.author?.avatar_url) || "",
  };
}

export function normalizeLanguages(raw: Record<string, number>): Record<string, number> {
  const entries = Object.entries(raw)
    .filter(([name, bytes]) => name.trim() && Number.isFinite(bytes) && bytes > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20);
  return Object.fromEntries(entries);
}

export async function normalizeReadme(
  raw: RawReadme,
  rawBaseUrl: string,
): Promise<ReadmePayload> {
  let markdown = "";
  let truncated = false;
  let contentBytes = raw.size ?? 0;

  if (raw.content && (!raw.encoding || raw.encoding === "base64")) {
    try {
      markdown = Buffer.from(raw.content, "base64").toString("utf8");
    } catch {
      markdown = "";
    }
  }

  if (!markdown && raw.download_url) {
    const safeDownloadUrl = safeHttpUrl(raw.download_url);
    if (safeDownloadUrl && contentBytes <= 2_000_000) {
      try {
        const response = await fetch(safeDownloadUrl, {
          headers: { "User-Agent": "GitHub-Radar/1.0" },
          signal: AbortSignal.timeout(12_000),
          cache: "no-store",
        });
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          contentBytes = buffer.byteLength;
          markdown = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
        }
      } catch {
        // A missing README body is non-fatal; the page will show a fallback.
      }
    }
  }

  if (markdown.length > MAX_README_CHARS) {
    markdown = markdown.slice(0, MAX_README_CHARS);
    truncated = true;
  }

  return {
    name: raw.name,
    path: raw.path,
    htmlUrl: safeHttpUrl(raw.html_url) || rawBaseUrl,
    markdown,
    truncated,
  };
}

export function isLikelyRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}
