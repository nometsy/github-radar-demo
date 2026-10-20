import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { getBatchRepositories } from "@/lib/github/service";
import { batchNamesSchema, parseQuery } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const input = parseQuery(request, batchNamesSchema);
    const url = new URL(request.url);
    const data = await getBatchRepositories({
      names: input.names,
      bypassCache:
        url.searchParams.get("refresh") === "1" ||
        url.searchParams.get("refresh") === "true",
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
