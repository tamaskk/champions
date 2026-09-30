import type { NextRequest } from "next/server";

import { failed, json, preflight, rateLimitResponse } from "@/server/cors";
import { h2hTicket } from "@/server/h2h-data";
import { sessionUserId } from "@/server/session";

export const OPTIONS = preflight;

/** GET /api/h2h/ticket/:id (signed in) – still waiting, expired, or the match once an opponent came. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimitResponse("GET /api/h2h/ticket/:id", request, await sessionUserId(request));
  if (limited) return limited;
  try {
    const ticket = await h2hTicket((await params).id, await sessionUserId(request));
    return ticket ? json(ticket) : json({ error: "Ticket not found" }, 404);
  } catch (error) {
    return failed("GET /api/h2h/ticket/:id", error);
  }
}
