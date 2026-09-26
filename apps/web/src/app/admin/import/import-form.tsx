"use client";

import { LEAGUE_ADJECTIVES, parseClubImport, seasonLabel, type ImportParseResult } from "@champion/shared";
import { useActionState, useMemo, useState, type ChangeEvent, type DragEvent } from "react";

import { importClubsAction, type ImportState } from "@/app/admin/actions";
import { AlertIcon, CheckIcon, FileIcon, UploadIcon } from "@/components/admin/icons";
import { buttonClass } from "@/components/admin/ui";

type Preview = { ok: true; result: ImportParseResult } | { ok: false; message: string };

function preview(text: string): Preview | null {
  if (!text.trim()) return null;
  try {
    return { ok: true, result: parseClubImport(JSON.parse(text)) };
  } catch (error) {
    return { ok: false, message: `Invalid JSON: ${(error as Error).message}` };
  }
}

const MAX_LISTED = 12;

export function ImportForm() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importClubsAction, { status: "idle" });

  const parsed = useMemo(() => preview(text), [text]);
  const result = parsed?.ok ? parsed.result : null;
  const canImport = !!result && result.errors.length === 0 && result.rows.length > 0 && !pending;

  const groups = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, { league: string; season: number; clubs: number }>();
    for (const row of result.rows) {
      const key = `${row.league}|${row.season}`;
      const g = map.get(key) ?? { league: row.league, season: row.season, clubs: 0 };
      g.clubs++;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => a.league.localeCompare(b.league) || a.season - b.season);
  }, [result]);

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void loadFile(e.dataTransfer.files[0]);
  };

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="payload" value={text} />
      <input type="hidden" name="fileName" value={fileName ?? ""} />

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? "border-accent bg-accent-soft" : "border-line bg-panel hover:border-accent/40"
        }`}
      >
        <span className="grid size-12 place-items-center rounded-full bg-white text-accent shadow-sm">
          <UploadIcon />
        </span>
        <span className="text-sm text-ink">
          <span className="font-semibold text-accent">Choose a JSON file</span> or drag it here
        </span>
        {fileName && (
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <FileIcon width={16} height={16} />
            {fileName}
          </span>
        )}
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            void loadFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">…or paste JSON</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFileName(null);
          }}
          rows={8}
          spellCheck={false}
          placeholder='{ "version": 1, "seasons": [ … ] }'
          className="rounded-xl border border-line bg-white p-3 font-mono text-xs text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
      </label>

      {parsed && !parsed.ok && (
        <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          <AlertIcon />
          {parsed.message}
        </p>
      )}

      {result && (
        <div className="rounded-2xl border border-line bg-panel p-5">
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <p>
              <span className="text-muted">Club seasons </span>
              <span className="font-semibold text-ink tabular-nums">{result.rows.length}</span>
            </p>
            <p>
              <span className="text-muted">League seasons </span>
              <span className="font-semibold text-ink tabular-nums">{groups.length}</span>
            </p>
            <p>
              <span className="text-muted">Duplicates skipped </span>
              <span className="font-semibold text-ink tabular-nums">{result.duplicates}</span>
            </p>
            <p>
              <span className="text-muted">Errors </span>
              <span className={`font-semibold tabular-nums ${result.errors.length ? "text-rose-600" : "text-ink"}`}>
                {result.errors.length}
              </span>
            </p>
          </div>

          {result.errors.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5 text-sm">
              {result.errors.slice(0, MAX_LISTED).map((err, i) => (
                <li key={i} className="flex gap-2 text-rose-600">
                  <code className="shrink-0 font-mono text-xs leading-5">{err.path}</code>
                  <span>{err.message}</span>
                </li>
              ))}
              {result.errors.length > MAX_LISTED && (
                <li className="text-muted">…and {result.errors.length - MAX_LISTED} more</li>
              )}
            </ul>
          )}

          {groups.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {groups.slice(0, MAX_LISTED * 2).map((g) => (
                <span key={`${g.league}${g.season}`} className="rounded-lg bg-white px-2.5 py-1 text-xs text-ink">
                  {LEAGUE_ADJECTIVES[g.league as keyof typeof LEAGUE_ADJECTIVES]} {seasonLabel(g.season)} ·{" "}
                  <span className="text-muted">{g.clubs} clubs</span>
                </span>
              ))}
              {groups.length > MAX_LISTED * 2 && (
                <span className="px-2.5 py-1 text-xs text-muted">+{groups.length - MAX_LISTED * 2} more</span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button disabled={!canImport} className={buttonClass.primary}>
          <UploadIcon />
          {pending ? "Importing…" : result?.rows.length ? `Import ${result.rows.length} club seasons` : "Import"}
        </button>

        {state.status === "done" && (
          <p className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckIcon />
            Imported: {state.inserted} new, {state.existing} already existed (refreshed).
          </p>
        )}
        {state.status === "error" && (
          <p className="flex items-center gap-2 text-sm text-rose-600">
            <AlertIcon />
            {state.message}
            {state.errors.length > 0 && ` (${state.errors.length} errors)`}
          </p>
        )}
      </div>
    </form>
  );
}
