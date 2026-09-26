/**
 * Player positions from Transfermarkt's own JSON API (the one its website loads player data
 * from): main position + up to two other positions per player, 100 players per request,
 * free (no Apify). These are career positions as Transfermarkt shows them on the profile
 * ("Main position" / "Other position"), not per season.
 */
const API = "https://tmapi-alpha.transfermarkt.technology/players";

export type TmPositions = {
  /** e.g. "Centre-Forward" */
  main: string | null;
  /** e.g. ["Left Winger", "Right Winger"] */
  other: string[];
  /** Short codes, main first: ["CF", "LW", "RW"] */
  codes: string[];
};

type ApiPosition = { id: number; name: string; shortName: string } | undefined;
type ApiPlayer = {
  id: string;
  attributes?: { position?: ApiPosition; firstSidePosition?: ApiPosition; secondSidePosition?: ApiPosition };
};

export function parsePositions(player: ApiPlayer): TmPositions {
  const a = player.attributes ?? {};
  const main = a.position?.id ? a.position : undefined;
  const other = [a.firstSidePosition, a.secondSidePosition].filter((p): p is NonNullable<ApiPosition> => Boolean(p?.id));
  return {
    main: main?.name ?? null,
    other: other.map((p) => p.name),
    codes: [main, ...other].filter((p): p is NonNullable<ApiPosition> => Boolean(p)).map((p) => p.shortName),
  };
}

/** Positions of up to 100 players. Missing ids (unknown to Transfermarkt) are left out. */
export async function fetchPositions(ids: number[]): Promise<Map<number, TmPositions>> {
  const url = `${API}?${ids.map((id) => `ids[]=${id}`).join("&")}`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          accept: "application/json",
          origin: "https://www.transfermarkt.com",
          referer: "https://www.transfermarkt.com/",
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { fatal: true });
      const body = (await res.json()) as { data?: ApiPlayer[] };
      return new Map((body.data ?? []).map((p) => [Number(p.id), parsePositions(p)]));
    } catch (error) {
      if ((error as { fatal?: boolean }).fatal) throw error;
      lastError = error;
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  throw new Error(`Transfermarkt API failed: ${(lastError as Error).message}`);
}
