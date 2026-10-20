import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { getSystemStatus } from "@/lib/github/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getSystemStatus();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
