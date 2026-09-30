import { failed, json, preflight, readAuthedJson } from "@/server/cors";
import { BadRequest } from "@/server/leaderboard-data";
import { secondChance } from "@/server/play-data";

export const OPTIONS = preflight;

/** POST /api/squads/:id/second-chance {userId, requestId} – uses a Second chance: one more tournament for this squad. */
export async function POST(request: Request, { params }: RouteContext<"/api/squads/[id]/second-chance">) {
  try {
    const { body } = await readAuthedJson<never>(request);
    return json(await secondChance((await params).id, body));
  } catch (error) {
    if (error instanceof BadRequest) return json({ error: error.message }, error.status);
    return failed("POST /api/squads/:id/second-chance", error);
  }
}
