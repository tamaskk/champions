import { lastCompleteSeason, parseLeague, type SeasonXIsResponse } from "@champion/shared";
import type { NextRequest } from "next/server";

import { seasonXIs } from "@/server/match-data";

// Public, read-only game data. CORS open so the Expo web build can call it too.
const CORS = { "Access-Control-Allow-Origin": "*" };

/** GET /api/season-xis?league=ENG&season=1975 – every club's likely XI that season (League simulation). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const league = parseLeague(params.get("league") ?? "");
  const season = Number(params.get("season"));
  if (!league || !Number.isInteger(season) || season < 1960 || season > lastCompleteSeason()) {
    return Response.json(
      { error: `Expected ?league=<ENG|ESP|ITA|GER|FRA>&season=<1960…${lastCompleteSeason()}>` },
      { status: 400, headers: CORS },
    );
  }
  try {
    const data = await seasonXIs(league, season);
    if (!data) return Response.json({ error: "No table for this league season" }, { status: 404, headers: CORS });
    return Response.json(data satisfies SeasonXIsResponse, { headers: CORS });
  } catch (error) {
    console.error("GET /api/season-xis failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503, headers: CORS });
  }
}
