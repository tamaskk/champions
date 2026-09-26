import type { LegendsAvailability } from "@champion/shared";

import { failed, json, preflight } from "@/server/cors";
import { availableLegends } from "@/server/legends-data";

export const OPTIONS = preflight;

/** GET /api/legends – ids of the legends that can be played (their squad is in the database). */
export async function GET() {
  try {
    return json({ available: await availableLegends() } satisfies LegendsAvailability);
  } catch (error) {
    return failed("GET /api/legends", error);
  }
}
