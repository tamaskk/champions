import { rateLimitResponse } from "@/server/cors";
import { parseLeague, slugify, type OpponentResponse } from "@champion/shared";
import type { NextRequest } from "next/server";

import { opponentXI } from "@/server/match-data";

// Public, read-only game data. CORS open so the Expo web build can call it too.
const CORS = { "Access-Control-Allow-Origin": "*" };

/** GET /api/opponent?league=GER&season=1972&club=bayern-munich – the club season's likely XI. */
export async function GET(request: NextRequest) {
  const limited = await rateLimitResponse("GET /api/opponent", request, null);
  if (limited) return limited;
  const params = request.nextUrl.searchParams;
  const league = parseLeague(params.get("league") ?? "");
  const season = Number(params.get("season"));
  const clubSlug = slugify(params.get("club") ?? "");
  if (!league || !Number.isInteger(season) || !clubSlug) {
    return Response.json(
      { error: "Expected ?league=<ENG|ESP|ITA|GER|FRA>&season=<start year>&club=<club slug>" },
      { status: 400, headers: CORS },
    );
  }
  try {
    const opponent = await opponentXI(league, season, clubSlug);
    if (!opponent || opponent.xi.length === 0) {
      return Response.json({ error: "No squad for this club season" }, { status: 404, headers: CORS });
    }
    return Response.json(opponent satisfies OpponentResponse, { headers: CORS });
  } catch (error) {
    console.error("GET /api/opponent failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503, headers: CORS });
  }
}
