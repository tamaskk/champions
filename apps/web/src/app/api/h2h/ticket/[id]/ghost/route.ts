import { failed, json, preflight, rateLimitResponse } from "@/server/cors";
import { sessionUserId } from "@/server/session";
import { h2hGhost } from "@/server/h2h-data";

export const OPTIONS = preflight;

/** POST /api/h2h/ticket/:id/ghost (signed in) – nobody came: play another player's saved squad. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimitResponse("POST /api/h2h/ticket/:id/ghost", request, await sessionUserId(request));
  if (limited) return limited;
  try {
    const ticket = await h2hGhost((await params).id, await sessionUserId(request));
    return ticket ? json(ticket) : json({ error: "Ticket not found" }, 404);
  } catch (error) {
    return failed("POST /api/h2h/ticket/:id/ghost", error);
  }
}
