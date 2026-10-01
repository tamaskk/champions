import { parseLeague } from "@champion/shared";
import type { NextRequest } from "next/server";

import { rateLimitResponse } from "@/server/cors";
import { offlineLeagueSeasons } from "@/server/offline-data";

const HEADERS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };
export const maxDuration = 60;

/** GET /api/offline/seasons?league=ENG – every club season of a league (XI, table, Elo). */
export async function GET(request: NextRequest) {
  const limited = await rateLimitResponse("GET /api/offline", request, null);
  if (limited) return limited;
  const league = parseLeague(request.nextUrl.searchParams.get("league") ?? "");
  if (!league) return Response.json({ error: "Expected ?league=<ENG|ESP|ITA|GER|FRA>" }, { status: 400 });
  try {
    return Response.json(await offlineLeagueSeasons(league), { headers: HEADERS });
  } catch (error) {
    console.error("GET /api/offline/seasons failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
