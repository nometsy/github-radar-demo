import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { getFreshRepositories } from "@/lib/github/service";
import {
  freshQuerySchema,
  parseQuery,
  resolveFreshWindowHours,
} from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const input = parseQuery(request, freshQuerySchema);
    const data = await getFreshRepositories({
      hours: resolveFreshWindowHours(input),
      language: input.language,
      minStars: input.minStars,
      minForks: input.minForks,
      topic: input.topic,
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
