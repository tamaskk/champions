"use server";

import {
  DAILY_IMPORT_SCHEMA,
  DAILY_POOL,
  SQUAD_IMPORT_SCHEMA,
  buildDailyPrompt,
  validateDaily,
  type DailyChallenge,
  buildSquadPrompt,
  parseClubImport,
  parseSquadImport,
  type ImportError,
  type SquadImportError,
} from "@champion/shared";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { ADMIN_COOKIE, verifyAdminSession } from "@/server/admin-auth";
import { LOCAL_CLAUDE_ENABLED, askClaude } from "@/server/claude-cli";
import { deleteClubSeason, saveClubSeasons } from "@/server/club-data";
import { deleteDaily, saveDailies } from "@/server/daily-data";
import { deleteSquadPlayer, getClubSeason, saveSquad } from "@/server/squad-data";

async function assertAdmin() {
  if (!(await verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value))) {
    throw new Error("Unauthorized");
  }
}

export type ImportState =
  | { status: "idle" }
  | { status: "error"; message: string; errors: ImportError[] }
  | { status: "done"; rows: number; inserted: number; existing: number };

export async function importClubsAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await assertAdmin();

  const payload = formData.get("payload");
  const fileName = formData.get("fileName");
  if (typeof payload !== "string" || !payload.trim()) {
    return { status: "error", message: "Nothing to import.", errors: [] };
  }

  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch (error) {
    return { status: "error", message: `Invalid JSON: ${(error as Error).message}`, errors: [] };
  }

  // Re-validate on the server; the client preview is only a convenience.
  const { rows, errors } = parseClubImport(json);
  if (errors.length > 0) {
    return { status: "error", message: "The file has errors. Nothing was imported.", errors };
  }
  if (rows.length === 0) {
    return { status: "error", message: "The file contains no clubs.", errors: [] };
  }

  try {
    const summary = await saveClubSeasons(rows, typeof fileName === "string" && fileName ? fileName : null);
    revalidatePath("/admin", "layout");
    return { status: "done", ...summary };
  } catch (error) {
    return { status: "error", message: `Database error: ${(error as Error).message}`, errors: [] };
  }
}

export async function deleteClubSeasonAction(formData: FormData) {
  await assertAdmin();
  const id = formData.get("id");
  if (typeof id === "string") await deleteClubSeason(id);
  revalidatePath("/admin", "layout");
}

async function squadTarget(clubSeasonId: unknown) {
  const cs = typeof clubSeasonId === "string" ? await getClubSeason(clubSeasonId) : null;
  return cs && { league: cs.league, season: cs.season, clubSlug: cs.clubSlug, club: cs.club };
}

export type SquadImportState =
  | { status: "idle" }
  | { status: "error"; message: string; errors: SquadImportError[] }
  | { status: "done"; inserted: number; existing: number };

export async function importSquadAction(_prev: SquadImportState, formData: FormData): Promise<SquadImportState> {
  await assertAdmin();
  const target = await squadTarget(formData.get("clubSeasonId"));
  if (!target) return { status: "error", message: "Club season not found.", errors: [] };

  let json: unknown;
  try {
    json = JSON.parse(String(formData.get("payload") ?? ""));
  } catch (error) {
    return { status: "error", message: `Invalid JSON: ${(error as Error).message}`, errors: [] };
  }

  const { players, errors } = parseSquadImport(json, target);
  if (errors.length > 0) return { status: "error", message: "The JSON has errors. Nothing was imported.", errors };
  if (players.length === 0) return { status: "error", message: "No players in the JSON.", errors: [] };

  try {
    const summary = await saveSquad(players);
    revalidatePath("/admin", "layout");
    return { status: "done", ...summary };
  } catch (error) {
    return { status: "error", message: `Database error: ${(error as Error).message}`, errors: [] };
  }
}

export type AskClaudeResult = { ok: true; json: string } | { ok: false; error: string };

/** Asks the local Claude CLI for the squad; the result only fills the form, it is not saved. */
export async function askClaudeForSquadAction(clubSeasonId: string): Promise<AskClaudeResult> {
  await assertAdmin();
  if (!LOCAL_CLAUDE_ENABLED) return { ok: false, error: "Local Claude is only available in development." };
  const target = await squadTarget(clubSeasonId);
  if (!target) return { ok: false, error: "Club season not found." };

  const result = await askClaude(buildSquadPrompt(target), SQUAD_IMPORT_SCHEMA);
  return result.ok ? { ok: true, json: JSON.stringify(result.data, null, 2) } : result;
}

export async function deleteSquadPlayerAction(formData: FormData) {
  await assertAdmin();
  const id = formData.get("id");
  if (typeof id === "string") await deleteSquadPlayer(id);
  revalidatePath("/admin", "layout");
}

// ---- Daily challenges

export type DailySaveState =
  { status: "idle" } | { status: "error"; message: string; problems: string[] } | { status: "done"; saved: number };

/** Saves one challenge or an array of them (JSON), each needs a date. Validated on the server. */
export async function saveDailyAction(_prev: DailySaveState, formData: FormData): Promise<DailySaveState> {
  await assertAdmin();
  let json: unknown;
  try {
    json = JSON.parse(String(formData.get("payload") ?? ""));
  } catch (error) {
    return { status: "error", message: `Invalid JSON: ${(error as Error).message}`, problems: [] };
  }
  const raw =
    json && typeof json === "object" && "challenges" in json ? (json as { challenges: unknown }).challenges : json;
  const list = (Array.isArray(raw) ? raw : [raw]) as DailyChallenge[];
  const problems = list.flatMap((c, i) => [
    ...validateDaily(c).map((p) => `#${i + 1} ${(c as Partial<DailyChallenge>)?.id ?? ""}: ${p}`),
    ...(!c?.date ? [`#${i + 1}: date missing`] : []),
  ]);
  if (problems.length) return { status: "error", message: "Nothing was saved.", problems };
  const source = formData.get("source") === "claude" ? "claude" : list.length > 1 ? "import" : "admin";
  try {
    const saved = await saveDailies(list, source);
    revalidatePath("/admin/daily");
    return { status: "done", saved };
  } catch (error) {
    return { status: "error", message: `Database error: ${(error as Error).message}`, problems: [] };
  }
}

export async function deleteDailyAction(formData: FormData) {
  await assertAdmin();
  const date = formData.get("date");
  if (typeof date === "string") await deleteDaily(date);
  revalidatePath("/admin/daily");
}

/** Asks the local Claude CLI for `count` new challenges from `startDate`; fills the form, not saved. */
export async function askClaudeForDailiesAction(count: number, startDate: string): Promise<AskClaudeResult> {
  await assertAdmin();
  if (!LOCAL_CLAUDE_ENABLED) return { ok: false, error: "Local Claude is only available in development." };
  const n = Math.min(30, Math.max(1, Math.round(count)));
  const result = await askClaude(
    `${buildDailyPrompt(n, startDate)}\n\nReturn them as {"challenges": [...]}. Don't reuse these ids: ${DAILY_POOL.map((c) => c.id).join(", ")}.`,
    DAILY_IMPORT_SCHEMA,
  );
  return result.ok ? { ok: true, json: JSON.stringify(result.data, null, 2) } : result;
}
