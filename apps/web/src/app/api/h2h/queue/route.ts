import type { H2HQueueRequest } from "@champion/shared";

import { failed, json, preflight, readJson } from "@/server/cors";
import { h2hQueue } from "@/server/h2h-data";
import { BadRequest } from "@/server/leaderboard-data";

export const OPTIONS = preflight;

/** POST /api/h2h/queue { userId, side } – look for a head-to-head opponent. */
export async function POST(request: Request) {
  try {
    return json(await h2hQueue(await readJson<H2HQueueRequest>(request)));
  } catch (error) {
    if (error instanceof BadRequest) return json({ error: error.message }, 400);
    return failed("POST /api/h2h/queue", error);
  }
}
