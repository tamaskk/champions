import { rateLimitResponse } from "@/server/cors";
import { lastCompleteSeason, type CupFieldResponse } from "@champion/shared";
import type { NextRequest } from "next/server";

import { cupField } from "@/server/match-data";

// Public, read-only game data. CORS open so the Expo web build can call it too.
const CORS = { "Access-Control-Allow-Origin": "*" };

/** GET /api/cl-field?season=2008 – the Champions League field of a season (31 clubs + your XI). */
export async function GET(request: NextRequest) {
  const limited = await rateLimitResponse("GET /api/cl-field", request, null);
  if (limited) return limited;
  const season = Number(request.nextUrl.searchParams.get("season"));
  if (!Number.isInteger(season) || season < 1960 || season > lastCompleteSeason()) {
    return Response.json({ error: `Expected ?season=<1960…${lastCompleteSeason()}>` }, { status: 400, headers: CORS });
  }
  try {
    const data = await cupField(season);
    if (!data) return Response.json({ error: "Not enough clubs for this season" }, { status: 404, headers: CORS });
    return Response.json(data satisfies CupFieldResponse, { headers: CORS });
  } catch (error) {
    console.error("GET /api/cl-field failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503, headers: CORS });
  }
}
