"use client";

import { DECADES, LEAGUES, LEAGUE_ADJECTIVES, buildDecadeClubsPrompt, type League } from "@champion/shared";
import { useState } from "react";

import { CheckIcon, FileIcon } from "@/components/admin/icons";
import { Card, buttonClass } from "@/components/admin/ui";

const field =
  "rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";

export function DecadePrompt() {
  const [decade, setDecade] = useState<number>(DECADES[0]);
  const [league, setLeague] = useState<League | "ALL">(LEAGUES[0]);
  const [copied, setCopied] = useState(false);

  const prompt = buildDecadeClubsPrompt(decade, league === "ALL" ? LEAGUES : [league]);

  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card title="Generate with AI" icon={FileIcon}>
      <p className="-mt-2 mb-4 text-sm text-muted">
        Copy a prompt that asks an AI chat for every club of a decade, then paste its JSON answer into Upload.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={decade}
          onChange={(e) => setDecade(Number(e.target.value))}
          aria-label="Decade"
          className={field}
        >
          {DECADES.map((d) => (
            <option key={d} value={d}>
              {d}s
            </option>
          ))}
        </select>
        <select
          value={league}
          onChange={(e) => setLeague(e.target.value as League | "ALL")}
          aria-label="League"
          className={field}
        >
          {LEAGUES.map((l) => (
            <option key={l} value={l}>
              {LEAGUE_ADJECTIVES[l]}
            </option>
          ))}
          <option value="ALL">All 5 leagues</option>
        </select>
        <button type="button" onClick={copy} className={buttonClass.primary}>
          {copied ? <CheckIcon /> : <FileIcon />}
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </div>
      {league === "ALL" && (
        <p className="mt-3 text-sm text-amber-600">
          All leagues at once is ~1,000 club names; many AI chats cut the answer off. One league at a time is
          more reliable.
        </p>
      )}
      <details className="mt-4 rounded-xl border border-line">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-ink">Show prompt</summary>
        <pre className="max-h-72 overflow-auto border-t border-line p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink">
          {prompt}
        </pre>
      </details>
    </Card>
  );
}
