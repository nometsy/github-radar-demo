import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api-error";
import { getDashboardData, getFreshRepositories } from "@/lib/github/service";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const feedQuerySchema = z.object({
  lens: z.enum(["new", "rising", "fresh", "active"]).default("new"),
  window: z.preprocess(
    (value) => (value === undefined || value === "" ? 24 : value),
    z.coerce.number().int().refine((value) =>
      [6, 12, 24, 72, 168, 720].includes(value),
    ),
  ),
});

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const input = feedQuerySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );
    if (!input.success) throw input.error;

    const feed =
      input.data.lens === "new"
        ? await getFreshRepositories({
            hours: input.data.window,
            language: "",
            minStars: 0,
            minForks: 0,
            topic: "",
            sort: "stars",
            page: 1,
            perPage: 20,
          })
        : await getDashboardData({
            lens: input.data.lens,
          }).then((data) => data.feed);

    const origin = url.origin;
    const self = `${origin}/api/radar/feed?lens=${input.data.lens}&window=${input.data.window}`;
    const updated = new Date().toUTCString();

    const items = feed.items
      .map((repo) => {
        const link = `${origin}/repos/${repo.owner.login}/${repo.name}`;
        const description = [
          repo.description ?? "No description provided.",
          `${repo.stars} stars · ${repo.forks} forks · created ${repo.createdAt}`,
        ].join(" — ");
        return `    <item>
      <title>${escapeXml(`${repo.owner.login}/${repo.name}`)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(repo.fullName)}</guid>
      <description>${escapeXml(description)}</description>
      <pubDate>${new Date(repo.createdAt).toUTCString()}</pubDate>
    </item>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(`${APP_NAME} · ${input.data.lens}`)}</title>
    <link>${escapeXml(origin)}</link>
    <description>${escapeXml(APP_DESCRIPTION)}</description>
    <lastBuildDate>${updated}</lastBuildDate>
    <atom:link href="${escapeXml(self)}" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom"/>
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=180, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
