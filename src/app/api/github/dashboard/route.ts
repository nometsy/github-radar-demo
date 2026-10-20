import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { getDashboardData } from "@/lib/github/service";
import { dashboardQuerySchema, parseQuery } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const input = parseQuery(request, dashboardQuerySchema);
    const data = await getDashboardData({
      lens: input.lens,
      bypassCache: input.refresh,
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
