import { failed, json, preflight, readJson } from "@/server/cors";
import { h2hGhost } from "@/server/h2h-data";

export const OPTIONS = preflight;

/** POST /api/h2h/ticket/:id/ghost { userId } – nobody came: play another player's saved squad. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await readJson<{ userId?: string }>(request);
    const ticket = await h2hGhost((await params).id, body?.userId ?? null);
    return ticket ? json(ticket) : json({ error: "Ticket not found" }, 404);
  } catch (error) {
    return failed("POST /api/h2h/ticket/:id/ghost", error);
  }
}
