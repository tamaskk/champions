import { DECADES, parseLeague, type ClubsResponse } from "@champion/shared";
import type { NextRequest } from "next/server";

import { clubsInDecade } from "@/server/club-data";

// Public, read-only game data. CORS open so the Expo web build can call it too.
const CORS = { "Access-Control-Allow-Origin": "*" };

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const league = parseLeague(params.get("league") ?? "");
  const decade = Number(params.get("decade"));

  if (!league || !(DECADES as readonly number[]).includes(decade)) {
    return Response.json(
      { error: `Expected ?league=<${"ENG|ESP|ITA|GER|FRA"}>&decade=<${DECADES.join("|")}>` },
      { status: 400, headers: CORS },
    );
  }

  try {
    const clubs = await clubsInDecade(league, decade);
    return Response.json({ league, decade, clubs } satisfies ClubsResponse, { headers: CORS });
  } catch (error) {
    console.error("GET /api/clubs failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503, headers: CORS });
  }
}
