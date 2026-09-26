import { lastCompleteSeason, parseLeague, type LeagueTableResponse } from "@champion/shared";
import type { NextRequest } from "next/server";

import { leagueTable, randomLeagueSeason } from "@/server/table-data";

// Public, read-only game data. CORS open so the Expo web build can call it too.
const CORS = { "Access-Control-Allow-Origin": "*" };

/** GET /api/table?league=ENG&season=1975 – final table. ?random=1 – a random completed league season. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  try {
    let league = parseLeague(params.get("league") ?? "");
    let season = Number(params.get("season"));
    if (params.get("random")) {
      const pick = await randomLeagueSeason();
      if (!pick) return Response.json({ error: "No league tables imported" }, { status: 404, headers: CORS });
      ({ league, season } = pick);
    }
    if (!league || !Number.isInteger(season) || season < 1960 || season > lastCompleteSeason()) {
      return Response.json(
        { error: `Expected ?league=<ENG|ESP|ITA|GER|FRA>&season=<1960…${lastCompleteSeason()}> or ?random=1` },
        { status: 400, headers: CORS },
      );
    }
    const rows = await leagueTable(league, season);
    if (rows.length === 0) return Response.json({ error: "No table for this league season" }, { status: 404, headers: CORS });
    return Response.json({ league, season, rows } satisfies LeagueTableResponse, { headers: CORS });
  } catch (error) {
    console.error("GET /api/table failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503, headers: CORS });
  }
}
