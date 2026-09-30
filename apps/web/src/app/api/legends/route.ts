import type { LegendsAvailability } from "@champion/shared";

import { failed, json, preflight, rateLimitResponse } from "@/server/cors";
import { availableLegends } from "@/server/legends-data";

export const OPTIONS = preflight;

/** GET /api/legends – ids of the legends that can be played (their squad is in the database). */
export async function GET(request: Request) {
  const limited = await rateLimitResponse("GET /api/legends", request, null);
  if (limited) return limited;
  try {
    return json({ available: await availableLegends() } satisfies LegendsAvailability);
  } catch (error) {
    return failed("GET /api/legends", error);
  }
}
