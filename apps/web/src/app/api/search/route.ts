import type { NextRequest } from "next/server";

import { failed, json, preflight, rateLimitResponse } from "@/server/cors";
import { search } from "@/server/squad-data";

export const OPTIONS = preflight;

/** GET /api/search?q=mbappe – players and clubs by name (accents ignored, at least 2 letters). */
export async function GET(request: NextRequest) {
  const limited = await rateLimitResponse("GET /api/search", request, null);
  if (limited) return limited;
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 60);
  try {
    return json(await search(q));
  } catch (error) {
    return failed("GET /api/search", error);
  }
}
