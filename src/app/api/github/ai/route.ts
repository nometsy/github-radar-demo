import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { getAiRepositories } from "@/lib/github/service";
import { aiQuerySchema, parseQuery } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const input = parseQuery(request, aiQuerySchema);
    const data = await getAiRepositories({
      category: input.category,
      q: input.q,
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
