import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { getSmartSearchResults } from "@/lib/github/service";
import { parseQuery, smartSearchQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const input = parseQuery(request, smartSearchQuerySchema);
    const data = await getSmartSearchResults({
      q: input.q,
      language: input.language,
      minStars: input.minStars,
      topic: input.topic,
      createdDays: input.createdDays,
      sort: input.sort,
      page: input.page,
      perPage: input.perPage,
      bypassCache: input.refresh,
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
