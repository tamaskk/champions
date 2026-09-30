import { rateLimitResponse } from "@/server/cors";
import { DECADES, parseLeague, slugify, type SquadResponse } from "@champion/shared";
import type { NextRequest } from "next/server";

import { squadInDecade } from "@/server/squad-data";

// Public, read-only game data. CORS open so the Expo web build can call it too.
const CORS = { "Access-Control-Allow-Origin": "*" };

export async function GET(request: NextRequest) {
  const limited = await rateLimitResponse("GET /api/squad", request, null);
  if (limited) return limited;
  const params = request.nextUrl.searchParams;
  const league = parseLeague(params.get("league") ?? "");
  const decade = Number(params.get("decade"));
  const clubSlug = slugify(params.get("club") ?? "");

  if (!league || !(DECADES as readonly number[]).includes(decade) || !clubSlug) {
    return Response.json(
      { error: "Expected ?league=<ENG|ESP|ITA|GER|FRA>&decade=<1960…2020>&club=<club slug or name>" },
      { status: 400, headers: CORS },
    );
  }

  try {
    const players = await squadInDecade(league, decade, clubSlug);
    return Response.json({ league, decade, clubSlug, players } satisfies SquadResponse, { headers: CORS });
  } catch (error) {
    console.error("GET /api/squad failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503, headers: CORS });
  }
}
