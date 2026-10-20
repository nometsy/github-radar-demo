import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { captureSnapshotsForRepos } from "@/lib/github/service";
import { requireCollectorAuth } from "@/lib/radar/auth";
import { parseJsonBody, snapshotBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    requireCollectorAuth(request);
    const input = await parseJsonBody(request, snapshotBodySchema);
    const result = await captureSnapshotsForRepos(input.repos);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
