"use client";

import { PLAYER_ROLES, parseSquadImport, type SquadParseResult, type SquadTarget } from "@champion/shared";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";

import {
  askClaudeForSquadAction,
  importSquadAction,
  type SquadImportState,
} from "@/app/admin/actions";
import { AlertIcon, CheckIcon, ClockIcon, FileIcon, UploadIcon } from "@/components/admin/icons";
import { Card, buttonClass } from "@/components/admin/ui";

type Preview = { ok: true; result: SquadParseResult } | { ok: false; message: string };

const MAX_ERRORS = 10;

export function SquadPanel({
  clubSeasonId,
  target,
  prompt,
  localClaude,
}: {
  clubSeasonId: string;
  target: SquadTarget;
  prompt: string;
  localClaude: boolean;
}) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [claudeError, setClaudeError] = useState<string | null>(null);
  const [asking, startAsking] = useTransition();
  const [seconds, setSeconds] = useState(0);
  const [state, formAction, importing] = useActionState<SquadImportState, FormData>(importSquadAction, {
    status: "idle",
  });

  // Elapsed-time counter while the CLI works; a search takes a few minutes.
  useEffect(() => {
    if (!asking) return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [asking]);

  const preview = useMemo<Preview | null>(() => {
    if (!text.trim()) return null;
    try {
      return { ok: true, result: parseSquadImport(JSON.parse(text), target) };
    } catch (error) {
      return { ok: false, message: `Invalid JSON: ${(error as Error).message}` };
    }
  }, [text, target]);
  const result = preview?.ok ? preview.result : null;
  const canImport = !!result && result.errors.length === 0 && result.players.length > 0 && !importing;

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const askClaude = () => {
    setClaudeError(null);
    setSeconds(0);
    startAsking(async () => {
      const res = await askClaudeForSquadAction(clubSeasonId);
      if (res.ok) setText(res.json);
      else setClaudeError(res.error);
    });
  };

  return (
    <Card title="Get players" icon={FileIcon}>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={copyPrompt} className={buttonClass.secondary}>
          {copied ? <CheckIcon className="text-emerald-600" /> : <FileIcon />}
          {copied ? "Copied" : "Copy prompt"}
        </button>
        {localClaude && (
          <button type="button" onClick={askClaude} disabled={asking} className={buttonClass.primary}>
            <ClockIcon />
            {asking ? `Claude is searching… ${seconds}s` : "Ask local Claude"}
          </button>
        )}
      </div>
      <p className="mt-3 text-sm text-muted">
        Paste the prompt into any AI chat and paste its JSON answer below
        {localClaude && ", or let the local Claude CLI search the web (uses your Claude subscription, takes a few minutes)"}.
      </p>
      {claudeError && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          <AlertIcon className="mt-0.5 shrink-0" />
          {claudeError}
        </p>
      )}

      <details className="mt-4 rounded-xl border border-line">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-ink">Show prompt</summary>
        <pre className="max-h-72 overflow-auto border-t border-line p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink">
          {prompt}
        </pre>
      </details>

      <form action={formAction} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="clubSeasonId" value={clubSeasonId} />
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">Players JSON</span>
          <textarea
            name="payload"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            spellCheck={false}
            placeholder='{ "version": 1, "players": [ … ] }'
            className="rounded-xl border border-line bg-white p-3 font-mono text-xs text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>

        {preview && !preview.ok && (
          <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            <AlertIcon />
            {preview.message}
          </p>
        )}

        {result && (
          <div className="rounded-2xl border border-line bg-panel p-4 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <p>
                <span className="text-muted">Players </span>
                <span className="font-semibold text-ink tabular-nums">{result.players.length}</span>
              </p>
              {PLAYER_ROLES.map((role) => (
                <p key={role}>
                  <span className="text-muted">{role} </span>
                  <span className="font-semibold text-ink tabular-nums">
                    {result.players.filter((p) => p.position === role).length}
                  </span>
                </p>
              ))}
              <p>
                <span className="text-muted">Duplicates </span>
                <span className="font-semibold text-ink tabular-nums">{result.duplicates}</span>
              </p>
            </div>
            {result.errors.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 text-rose-600">
                {result.errors.slice(0, MAX_ERRORS).map((err, i) => (
                  <li key={i} className="flex gap-2">
                    <code className="shrink-0 font-mono text-xs leading-5">{err.path}</code>
                    <span>{err.message}</span>
                  </li>
                ))}
                {result.errors.length > MAX_ERRORS && (
                  <li className="text-muted">…and {result.errors.length - MAX_ERRORS} more</li>
                )}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button disabled={!canImport} className={buttonClass.primary}>
            <UploadIcon />
            {importing ? "Importing…" : result?.players.length ? `Import ${result.players.length} players` : "Import"}
          </button>
          {state.status === "done" && (
            <p className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckIcon />
              {state.inserted} new, {state.existing} already existed (refreshed).
            </p>
          )}
          {state.status === "error" && (
            <p className="flex items-center gap-2 text-sm text-rose-600">
              <AlertIcon />
              {state.message}
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}
