import type { NextRequest } from "next/server";

import { failed, json, preflight, rateLimitResponse } from "@/server/cors";
import { legendXI } from "@/server/legends-data";

export const OPTIONS = preflight;

/** GET /api/legend?id=milan-1988 – a legendary club season's likely XI. */
export async function GET(request: NextRequest) {
  const limited = await rateLimitResponse("GET /api/legend", request, null);
  if (limited) return limited;
  const id = request.nextUrl.searchParams.get("id") ?? "";
  try {
    const legend = await legendXI(id);
    return legend ? json(legend) : json({ error: "No squad for this legend yet" }, 404);
  } catch (error) {
    return failed("GET /api/legend", error);
  }
}
