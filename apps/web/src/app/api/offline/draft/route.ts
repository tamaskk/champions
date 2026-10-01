import { DECADES, parseLeague } from "@champion/shared";
import type { NextRequest } from "next/server";

import { rateLimitResponse } from "@/server/cors";
import { offlineDraftCell } from "@/server/offline-data";

// Public, read-only game data; cached at the edge for a day (the pack changes only with imports).
const HEADERS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };
export const maxDuration = 60;

/** GET /api/offline/draft?league=ENG&decade=1990 – one cell of the offline pack. */
export async function GET(request: NextRequest) {
  const limited = await rateLimitResponse("GET /api/offline", request, null);
  if (limited) return limited;
  const league = parseLeague(request.nextUrl.searchParams.get("league") ?? "");
  const decade = Number(request.nextUrl.searchParams.get("decade"));
  if (!league || !(DECADES as readonly number[]).includes(decade)) {
    return Response.json({ error: "Expected ?league=<ENG|ESP|ITA|GER|FRA>&decade=<1960…2020>" }, { status: 400 });
  }
  try {
    return Response.json(await offlineDraftCell(league, decade), { headers: HEADERS });
  } catch (error) {
    console.error("GET /api/offline/draft failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
