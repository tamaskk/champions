import { DECADES, LEAGUES } from "@champion/shared";

export function GET() {
  return Response.json({ ok: true, leagues: LEAGUES, decades: DECADES });
}
