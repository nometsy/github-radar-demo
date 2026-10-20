import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { getLeaderboardData } from "@/lib/github/service";
import { leaderboardQuerySchema, parseQuery } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const input = parseQuery(request, leaderboardQuerySchema);
    const data = await getLeaderboardData({
      window: input.window,
      limit: input.limit,
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
