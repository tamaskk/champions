import { sessionUserId } from "@/server/session";
import type { H2HQueueRequest } from "@champion/shared";

import { failed, json, preflight, readAuthedJson, rateLimitResponse } from "@/server/cors";
import { h2hQueue } from "@/server/h2h-data";
import { BadRequest } from "@/server/leaderboard-data";

export const OPTIONS = preflight;

/** POST /api/h2h/queue { squadId } (signed in) – look for a head-to-head opponent. */
export async function POST(request: Request) {
  const limited = await rateLimitResponse("POST /api/h2h/queue", request, await sessionUserId(request));
  if (limited) return limited;
  try {
    const { body } = await readAuthedJson<H2HQueueRequest>(request);
    return json(await h2hQueue(body));
  } catch (error) {
    if (error instanceof BadRequest) return json({ error: error.message }, error.status);
    return failed("POST /api/h2h/queue", error);
  }
}
