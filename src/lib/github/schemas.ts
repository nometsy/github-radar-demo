import { z } from "zod";

const ownerSchema = z.object({
  login: z.string().min(1),
  avatar_url: z.string().nullable().optional().catch(null),
  html_url: z.string().nullable().optional().catch(null),
});

const licenseSchema = z
  .object({
    key: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    spdx_id: z.string().nullable().optional(),
  })
  .nullable()
  .optional()
  .catch(null);

export const rawRepoBaseSchema = z.object({
  id: z.number().int().catch(0),
  name: z.string().min(1).catch("unknown"),
  full_name: z.string().min(1).catch("unknown/unknown"),
  owner: ownerSchema,
  description: z.string().nullable().optional().catch(null),
  html_url: z.string().nullable().optional().catch(null),
  language: z.string().nullable().optional().catch(null),
  stargazers_count: z.number().int().nonnegative().catch(0),
  forks_count: z.number().int().nonnegative().catch(0),
  open_issues_count: z.number().int().nonnegative().catch(0),
  watchers_count: z.number().int().nonnegative().optional().catch(0),
  created_at: z.string().min(1).catch(""),
  updated_at: z.string().min(1).catch(""),
  pushed_at: z.string().nullable().optional().catch(null),
  topics: z.array(z.string()).optional().catch([]),
  archived: z.boolean().optional().catch(false),
  fork: z.boolean().optional().catch(false),
  license: licenseSchema,
  homepage: z.string().nullable().optional().catch(null),
  default_branch: z.string().optional().catch("main"),
  size: z.number().int().nonnegative().optional().catch(0),
});

export const rawRepoDetailsSchema = rawRepoBaseSchema.extend({
  subscribers_count: z.number().int().nonnegative().nullish().catch(null),
  network_count: z.number().int().nonnegative().nullish().catch(null),
  has_issues: z.boolean().optional().catch(true),
  has_discussions: z.boolean().optional().catch(false),
  has_wiki: z.boolean().optional().catch(true),
  has_pages: z.boolean().optional().catch(false),
  has_projects: z.boolean().optional().catch(true),
});

export const rawSearchResponseSchema = z.object({
  total_count: z.number().int().nonnegative().catch(0),
  incomplete_results: z.boolean().catch(false),
  items: z.array(rawRepoBaseSchema).catch([]),
});

export const rawReleaseSchema = z.object({
  id: z.number().int().catch(0),
  tag_name: z.string().min(1).catch("unknown"),
  name: z.string().nullable().optional().catch(null),
  body: z.string().nullable().optional().catch(null),
  draft: z.boolean().optional().catch(false),
  prerelease: z.boolean().optional().catch(false),
  created_at: z.string().min(1).catch(""),
  published_at: z.string().nullable().optional().catch(null),
  html_url: z.string().nullable().optional().catch(null),
  author: z
    .object({
      login: z.string().optional().catch(""),
      avatar_url: z.string().nullable().optional().catch(null),
    })
    .nullable()
    .optional()
    .catch(null),
});

export const rawReleasesSchema = z.array(rawReleaseSchema).catch([]);

export const rawReadmeSchema = z.object({
  name: z.string().min(1).catch("README.md"),
  path: z.string().min(1).catch("README.md"),
  html_url: z.string().nullable().optional().catch(null),
  content: z.string().nullable().optional().catch(null),
  encoding: z.string().nullable().optional().catch("base64"),
  size: z.number().int().nonnegative().optional().catch(0),
  download_url: z.string().nullable().optional().catch(null),
});

export const rawLanguagesSchema = z
  .record(z.string(), z.number().nonnegative())
  .catch({});

export const rawRateLimitSchema = z.object({
  resources: z.object({
    core: z
      .object({
        limit: z.number().int().nonnegative(),
        remaining: z.number().int().nonnegative(),
        used: z.number().int().nonnegative(),
        reset: z.number().int().nonnegative(),
      })
      .optional(),
    search: z
      .object({
        limit: z.number().int().nonnegative(),
        remaining: z.number().int().nonnegative(),
        used: z.number().int().nonnegative(),
        reset: z.number().int().nonnegative(),
      })
      .optional(),
  }),
});

export const rawGitHubErrorSchema = z.object({
  message: z.string().optional(),
  documentation_url: z.string().optional(),
});

export type RawRepo = z.infer<typeof rawRepoBaseSchema>;
export type RawRepoDetails = z.infer<typeof rawRepoDetailsSchema>;
export type RawSearchResponse = z.infer<typeof rawSearchResponseSchema>;
export type RawRelease = z.infer<typeof rawReleaseSchema>;
export type RawReadme = z.infer<typeof rawReadmeSchema>;
