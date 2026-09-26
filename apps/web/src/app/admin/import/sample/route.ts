import { CLUB_IMPORT_SAMPLE } from "@champion/shared";

export function GET() {
  return new Response(JSON.stringify(CLUB_IMPORT_SAMPLE, null, 2) + "\n", {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="club-import-sample.json"',
    },
  });
}
