import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { getRepoDetails } from "@/lib/github/service";
import { repoParamsSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ owner: string; name: string }> },
) {
  try {
    const rawParams = await context.params;
    const parsed = repoParamsSchema.safeParse(rawParams);
    if (!parsed.success) throw parsed.error;

    const url = new URL(request.url);
    const bypassCache =
      url.searchParams.get("refresh") === "1" ||
      url.searchParams.get("refresh") === "true";

    const data = await getRepoDetails({
      owner: parsed.data.owner,
      name: parsed.data.name,
      bypassCache,
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
