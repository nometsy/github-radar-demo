import { z } from "zod";
import { AI_CATEGORIES, FEED_LENSES, TRENDING_LANES } from "@/lib/constants";

function queryInt(fallback: number, min: number, max: number) {
  return z.preprocess(
    (value) => (value === undefined || value === "" ? fallback : value),
    z.coerce.number().int().min(min).max(max),
  );
}

const refreshSchema = z.preprocess(
  (value) => value === "1" || value === "true",
  z.boolean(),
);

const languageSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^[A-Za-z0-9+#._ -]*$/, "Language contains unsupported characters.")
  .default("");

const topicSchema = z
  .string()
  .trim()
  .max(50)
  .regex(/^[A-Za-z0-9._-]*$/, "Topic may only contain letters, numbers, dots, dashes and underscores.")
  .default("");

const keywordSchema = z
  .string()
  .trim()
  .max(120)
  .transform((value) =>
    value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " "),
  )
  .default("");

export const feedLensSchema = z.enum(
  FEED_LENSES.map((lens) => lens.id) as [
    (typeof FEED_LENSES)[number]["id"],
    ...(typeof FEED_LENSES)[number]["id"][],
  ],
);

export const dashboardQuerySchema = z.object({
  lens: feedLensSchema.default("rising"),
  refresh: refreshSchema,
});

const FRESH_WINDOW_HOURS = [6, 12, 24, 72, 168, 720] as const;

export const freshQuerySchema = z.object({
  /** Window length in hours. */
  window: z.preprocess(
    (value) => (value === undefined || value === "" ? 24 : value),
    z.coerce.number().int().refine((value) =>
      (FRESH_WINDOW_HOURS as readonly number[]).includes(value),
    ),
  ),
  /** Legacy alias: window length in days. */
  days: z.preprocess(
    (value) => (value === undefined || value === "" ? 0 : value),
    z.coerce.number().int().refine((value) =>
      [0, 1, 3, 7, 30].includes(value),
    ),
  ),
  language: languageSchema,
  minStars: queryInt(10, 0, 5_000_000),
  minForks: queryInt(0, 0, 1_000_000),
  topic: topicSchema,
  sort: z.enum(["stars", "updated"]).default("stars"),
  page: queryInt(1, 1, 40),
  perPage: queryInt(18, 1, 30),
  refresh: refreshSchema,
});

export function resolveFreshWindowHours(input: {
  window: number;
  days: number;
}): number {
  if (input.days > 0) return input.days * 24;
  return input.window;
}

export const trendingQuerySchema = z.object({
  lane: z.enum(
    TRENDING_LANES.map((lane) => lane.id) as [
      (typeof TRENDING_LANES)[number]["id"],
      ...(typeof TRENDING_LANES)[number]["id"][],
    ],
  ).default("week"),
  page: queryInt(1, 1, 40),
  perPage: queryInt(18, 1, 30),
  refresh: refreshSchema,
});

export const aiQuerySchema = z.object({
  category: z
    .enum(
      AI_CATEGORIES.map((category) => category.id) as [
        (typeof AI_CATEGORIES)[number]["id"],
        ...(typeof AI_CATEGORIES)[number]["id"][],
      ],
    )
    .default("artificial-intelligence"),
  q: keywordSchema,
  sort: z.enum(["stars", "updated"]).default("stars"),
  page: queryInt(1, 1, 40),
  perPage: queryInt(18, 1, 30),
  refresh: refreshSchema,
});

export const smartSearchQuerySchema = z.object({
  q: keywordSchema,
  language: languageSchema,
  minStars: queryInt(0, 0, 5_000_000),
  topic: topicSchema,
  createdDays: z.preprocess(
    (value) => (value === undefined || value === "" ? 0 : value),
    z.coerce.number().int().refine((value) =>
      [0, 1, 7, 30, 90, 365].includes(value),
    ),
  ),
  sort: z.enum(["best", "stars", "updated"]).default("best"),
  page: queryInt(1, 1, 50),
  perPage: queryInt(20, 1, 30),
  refresh: refreshSchema,
});

export const repoParamsSchema = z.object({
  owner: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_.-]+$/, "Invalid repository owner."),
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_.-]+$/, "Invalid repository name."),
});

export const batchNamesSchema = z.object({
  names: z
    .string()
    .trim()
    .min(1)
    .max(400)
    .transform((value) =>
      value
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    )
    .refine((names) => names.length >= 1 && names.length <= 8, {
      message: "Provide between 1 and 8 repositories.",
    })
    .refine(
      (names) =>
        names.every((name) =>
          /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name),
        ),
      { message: "Each repository must use the owner/name format." },
    ),
});

export const growthWindowSchema = z
  .string()
  .trim()
  .refine((value) => value === "24h" || value === "7d", {
    message: "Window must be 24h or 7d.",
  })
  .transform((value) => value as "24h" | "7d")
  .default("24h");

export const leaderboardQuerySchema = z.object({
  window: growthWindowSchema,
  limit: queryInt(8, 1, 20),
});

export const snapshotQuerySchema = z.object({
  window: growthWindowSchema,
});

export const snapshotBodySchema = z.object({
  repos: z
    .array(
      z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "Invalid repository."),
    )
    .min(1)
    .max(8),
});

export function getQueryObject(request: Request): Record<string, string> {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    if (!(key in raw)) raw[key] = value;
  });
  return raw;
}

export function parseQuery<T extends z.ZodType>(
  request: Request,
  schema: T,
): z.output<T> {
  const result = schema.safeParse(getQueryObject(request));
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.output<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new z.ZodError([
      {
        code: "custom",
        path: [],
        message: "Request body must be valid JSON.",
      },
    ]);
  }
  const result = schema.safeParse(body);
  if (!result.success) throw result.error;
  return result.data;
}
