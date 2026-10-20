import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { collectRadarSnapshots } from "@/lib/github/service";
import { requireCollectorAuth } from "@/lib/radar/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function collect(request: Request) {
  try {
    requireCollectorAuth(request);
    const result = await collectRadarSnapshots();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST is the normal manual trigger. GET exists for scheduler integrations
// (including Vercel Cron) and is protected by the same secret.
export async function POST(request: Request) {
  return collect(request);
}

export async function GET(request: Request) {
  return collect(request);
}
