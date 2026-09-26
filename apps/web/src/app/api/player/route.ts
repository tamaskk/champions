import { slugify, type PlayerCareer } from "@champion/shared";
import type { NextRequest } from "next/server";

import { playerCareer } from "@/server/squad-data";

// Public, read-only game data. CORS open so the Expo web build can call it too.
const CORS = { "Access-Control-Allow-Origin": "*" };

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tm = Number(params.get("tm"));
  const nameSlug = slugify(params.get("name") ?? "");
  const tmPlayerId = Number.isInteger(tm) && tm > 0 ? tm : undefined;
  if (!tmPlayerId && !nameSlug) {
    return Response.json({ error: "Expected ?tm=<transfermarkt id> or ?name=<player name>" }, { status: 400, headers: CORS });
  }

  try {
    const career = await playerCareer({ tmPlayerId, nameSlug });
    if (!career) return Response.json({ error: "Player not found" }, { status: 404, headers: CORS });
    return Response.json(career satisfies PlayerCareer, { headers: CORS });
  } catch (error) {
    console.error("GET /api/player failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503, headers: CORS });
  }
}
