import { failed, json, preflight, rateLimitResponse } from "@/server/cors";
import { squadDetail } from "@/server/leaderboard-data";

export const OPTIONS = preflight;

/** GET /api/squads/:id – a saved squad: the XI and what it achieved. */
export async function GET(_request: Request, { params }: RouteContext<"/api/squads/[id]">) {
  const limited = await rateLimitResponse("GET /api/squads/:id", _request, null);
  if (limited) return limited;
  try {
    const squad = await squadDetail((await params).id);
    return squad ? json(squad) : json({ error: "Squad not found" }, 404);
  } catch (error) {
    return failed("GET /api/squads/:id", error);
  }
}
