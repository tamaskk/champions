"use client";

import {
  FORMATIONS,
  LEGENDS,
  buildDailyPrompt,
  validateDaily,
  type DailyChallenge,
  type DailyTier,
} from "@champion/shared";
import { useActionState, useMemo, useState, useTransition } from "react";

import { askClaudeForDailiesAction, saveDailyAction, type DailySaveState } from "@/app/admin/actions";
import { CheckIcon, FileIcon } from "@/components/admin/icons";
import { buttonClass, Card } from "@/components/admin/ui";

const DECADE_OPTIONS = [1960, 1970, 1980, 1990, 2000, 2010, 2020];
const LEAGUE_OPTIONS = ["ENG", "ESP", "ITA", "GER", "FRA"] as const;
const XP: Record<DailyTier, number> = { SILVER: 400, GOLD: 700, LEGEND: 1200 };
const input = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink";
const label = "flex flex-col gap-1 text-xs font-medium text-muted";

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Create one challenge with a form, or paste / generate a JSON batch; validated before saving. */
export function DailyEditor({ defaultDate, localClaude }: { defaultDate: string; localClaude: boolean }) {
  const [tab, setTab] = useState<"form" | "json">("form");
  const [form, setForm] = useState({
    date: defaultDate,
    title: "",
    description: "",
    tier: "GOLD" as DailyTier,
    formation: "",
    decades: [] as number[],
    leagues: [] as string[],
    targetChemistry: "",
    targetOverall: "",
    opponentLegend: "",
    maxRespins: "",
  });
  const [json, setJson] = useState("");
  const [source, setSource] = useState<"admin" | "claude">("admin");
  const [count, setCount] = useState(7);
  const [claudeError, setClaudeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [asking, startAsking] = useTransition();
  const [state, formAction, saving] = useActionState<DailySaveState, FormData>(saveDailyAction, { status: "idle" });

  const fromForm: DailyChallenge = useMemo(
    () => ({
      id: slug(form.title) || "new-challenge",
      date: form.date,
      title: form.title,
      description: form.description,
      tier: form.tier,
      xp: XP[form.tier],
      rules: {
        ...(form.formation && { formation: form.formation as DailyChallenge["rules"]["formation"] }),
        ...(form.decades.length && { decades: form.decades as never }),
        ...(form.leagues.length && { leagues: form.leagues as never }),
        ...(form.targetChemistry && { targetChemistry: Number(form.targetChemistry) }),
        ...(form.targetOverall && { targetOverall: Number(form.targetOverall) }),
        ...(form.opponentLegend && { opponentLegend: form.opponentLegend }),
        ...(form.maxRespins !== "" && { maxRespins: Number(form.maxRespins) }),
      },
    }),
    [form],
  );
  const payload = tab === "form" ? JSON.stringify(fromForm) : json;
  const problems = useMemo(() => {
    if (tab === "form") return validateDaily(fromForm);
    if (!json.trim()) return [];
    try {
      const raw = JSON.parse(json);
      const list = Array.isArray(raw) ? raw : (raw?.challenges ?? [raw]);
      return (list as unknown[]).flatMap((c, i) => validateDaily(c).map((p) => `#${i + 1}: ${p}`));
    } catch (e) {
      return [`Invalid JSON: ${(e as Error).message}`];
    }
  }, [tab, fromForm, json]);

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(buildDailyPrompt(count, defaultDate));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const askClaude = () =>
    startAsking(async () => {
      setClaudeError(null);
      const result = await askClaudeForDailiesAction(count, defaultDate);
      if (result.ok) {
        setJson(result.json);
        setSource("claude");
        setTab("json");
      } else setClaudeError(result.error);
    });

  return (
    <Card title="New challenge">
      <div className="mb-4 flex gap-2">
        {(["form", "json"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-xl px-3 py-1.5 text-sm ${tab === t ? "bg-ink text-white" : "bg-canvas text-muted"}`}
          >
            {t === "form" ? "Form" : "JSON / import"}
          </button>
        ))}
      </div>

      {tab === "form" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Date
            <input type="date" className={input} value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </label>
          <label className={label}>
            Tier
            <select className={input} value={form.tier} onChange={(e) => set({ tier: e.target.value as DailyTier })}>
              <option>SILVER</option>
              <option>GOLD</option>
              <option>LEGEND</option>
            </select>
          </label>
          <label className={`${label} col-span-2`}>
            Title
            <input
              className={input}
              maxLength={24}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </label>
          <label className={`${label} col-span-2`}>
            Description
            <input className={input} value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </label>
          <label className={label}>
            Formation
            <select className={input} value={form.formation} onChange={(e) => set({ formation: e.target.value })}>
              <option value="">Any (spun)</option>
              {FORMATIONS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            Legend to beat
            <select
              className={input}
              value={form.opponentLegend}
              onChange={(e) => set({ opponentLegend: e.target.value })}
            >
              <option value="">None</option>
              {LEGENDS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.club} {l.season} – {l.nickname}
                </option>
              ))}
            </select>
          </label>
          <div className={`${label} col-span-2`}>
            Decades
            <div className="flex flex-wrap gap-2">
              {DECADE_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set({ decades: toggle(form.decades, d) })}
                  className={`rounded-lg px-2.5 py-1 text-xs ${form.decades.includes(d) ? "bg-accent text-white" : "bg-canvas text-muted"}`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>
          <div className={`${label} col-span-2`}>
            Leagues
            <div className="flex flex-wrap gap-2">
              {LEAGUE_OPTIONS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => set({ leagues: toggle(form.leagues, l) })}
                  className={`rounded-lg px-2.5 py-1 text-xs ${form.leagues.includes(l) ? "bg-accent text-white" : "bg-canvas text-muted"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <label className={label}>
            Target chemistry
            <input
              type="number"
              min={0}
              max={100}
              className={input}
              value={form.targetChemistry}
              onChange={(e) => set({ targetChemistry: e.target.value })}
            />
          </label>
          <label className={label}>
            Target overall
            <input
              type="number"
              min={50}
              max={99}
              className={input}
              value={form.targetOverall}
              onChange={(e) => set({ targetOverall: e.target.value })}
            />
          </label>
          <label className={label}>
            Max re-spins
            <input
              type="number"
              min={0}
              max={10}
              placeholder="unlimited"
              className={input}
              value={form.maxRespins}
              onChange={(e) => set({ maxRespins: e.target.value })}
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <textarea
            className={`${input} h-64 font-mono text-xs`}
            placeholder='One challenge, an array, or {"challenges": [...]} – every item needs a "date".'
            value={json}
            onChange={(e) => setJson(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-canvas p-3 text-sm">
            <span className="text-muted">Prompt for</span>
            <input
              type="number"
              min={1}
              max={30}
              className="w-16 rounded-lg border border-line px-2 py-1"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
            <span className="text-muted">days from {defaultDate}</span>
            {localClaude && (
              <button type="button" onClick={askClaude} disabled={asking} className={buttonClass.secondary}>
                {asking ? "Claude is thinking…" : "Generate with Claude CLI"}
              </button>
            )}
            <button type="button" className={buttonClass.secondary} onClick={copyPrompt}>
              {copied ? <CheckIcon className="text-emerald-600" /> : <FileIcon />}
              {copied ? "Copied" : "Copy prompt"}
            </button>
          </div>
          {claudeError && <p className="text-sm text-rose-500">{claudeError}</p>}
        </div>
      )}

      {problems.length > 0 && (
        <ul className="mt-4 list-disc pl-5 text-sm text-rose-500">
          {problems.slice(0, 8).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <form action={formAction} className="mt-4 flex items-center gap-3">
        <input type="hidden" name="payload" value={payload} />
        <input type="hidden" name="source" value={tab === "json" ? source : "admin"} />
        <button
          className={buttonClass.primary}
          disabled={saving || problems.length > 0 || (tab === "json" && !json.trim())}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {state.status === "done" && <span className="text-sm text-emerald-600">Saved {state.saved}.</span>}
        {state.status === "error" && (
          <span className="text-sm text-rose-500">
            {state.message} {state.problems.slice(0, 3).join(" · ")}
          </span>
        )}
      </form>
    </Card>
  );
}
