import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { fetchGitHubRateLimit } from "@/lib/github/client";
import { getRateLimitSnapshot } from "@/lib/github/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await fetchGitHubRateLimit().catch(() => undefined);
    return NextResponse.json(getRateLimitSnapshot(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
