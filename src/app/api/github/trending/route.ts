import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { getTrendingRepositories } from "@/lib/github/service";
import { parseQuery, trendingQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const input = parseQuery(request, trendingQuerySchema);
    const data = await getTrendingRepositories({
      lane: input.lane,
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
