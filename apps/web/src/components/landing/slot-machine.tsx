"use client";

import { useEffect, useRef, useState } from "react";

// The draft's three reels. Press SPIN and they land, one after the other, like in the app.
const REELS = [
  { label: "Decade", items: ["60s", "70s", "80s", "90s", "00s", "10s", "20s"] },
  { label: "League", items: ["ENG", "ESP", "ITA", "GER", "FRA"] },
  { label: "Position", items: ["GK", "CB", "FB", "DM", "CM", "AM", "W", "ST"] },
] as const;
const LEAGUE_WORD: Record<string, string> = { ENG: "an English", ESP: "a Spanish", ITA: "an Italian", GER: "a German", FRA: "a French" };
const POSITION_WORD: Record<string, string> = {
  GK: "goalkeeper",
  CB: "centre-back",
  FB: "full-back",
  DM: "holding midfielder",
  CM: "midfielder",
  AM: "playmaker",
  W: "winger",
  ST: "striker",
};
const ROW = 56;
const LOOPS = 40;
const SPIN_MS = [1100, 1500, 1900];

type ReelPos = { row: number; animate: boolean };

/** Row of the strip that sits on the payline for item `index` after `laps` full laps. */
const rowFor = (len: number, index: number, laps: number) => laps * len + index;

export function SlotMachine() {
  const [pos, setPos] = useState<ReelPos[]>(() => REELS.map((r, i) => ({ row: rowFor(r.items.length, [3, 2, 7][i]!, 1), animate: false })));
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const spin = () => {
    if (spinning) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const picks = REELS.map((r) => Math.floor(Math.random() * r.items.length));
    setSpinning(true);
    setResult(null);
    setPos((prev) =>
      prev.map((p, i) => {
        const len = REELS[i]!.items.length;
        // Start from lap 1 again if the strip is running out, then travel 3–5 laps down.
        const lap = Math.floor(p.row / len) > LOOPS - 8 ? 1 : Math.floor(p.row / len);
        return { row: rowFor(len, picks[i]!, lap + 3 + i), animate: !reduced };
      }),
    );
    timer.current = setTimeout(
      () => {
        const [d, l, p] = picks.map((k, i) => REELS[i]!.items[k]!);
        setResult(`Your pick: ${POSITION_WORD[p!]} from ${LEAGUE_WORD[l!]} club of the ${d}.`);
        setSpinning(false);
      },
      reduced ? 0 : SPIN_MS[2]! + 100,
    );
  };

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between text-xs text-white/55">
        <span>Spin 01 / 11</span>
        <span className="flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full ${spinning ? "animate-pulse bg-[#ffc72c]" : "bg-[#6ddc9e]"}`} />
          {spinning ? "Spinning" : "Ready"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {REELS.map((reel, i) => (
          <div key={reel.label}>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30" style={{ height: ROW * 3 }}>
              <div
                className="flex flex-col will-change-transform"
                style={{
                  transform: `translateY(${-(pos[i]!.row - 1) * ROW}px)`,
                  transition: pos[i]!.animate ? `transform ${SPIN_MS[i]}ms cubic-bezier(0.12, 0.8, 0.18, 1)` : "none",
                }}
              >
                {Array.from({ length: LOOPS * reel.items.length }, (_, k) => {
                  const on = k === pos[i]!.row && !spinning;
                  return (
                    <div
                      key={k}
                      className={`grid place-items-center text-[26px] font-light tabular-nums transition-colors duration-300 ${
                        on ? "text-white" : "text-white/20"
                      }`}
                      style={{ height: ROW }}
                    >
                      {reel.items[k % reel.items.length]}
                    </div>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute inset-x-0 border-y border-[#ffc72c]/60 bg-[#ffc72c]/[0.06]" style={{ top: ROW, height: ROW }} />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[#121a24] to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#121a24] to-transparent" />
            </div>
            <p className="mt-2 text-center text-[11px] text-white/45">{reel.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={spin}
          disabled={spinning}
          className="shrink-0 cursor-pointer rounded-full bg-white px-5 py-2.5 text-sm font-medium whitespace-nowrap text-[#0d141e] transition-colors duration-200 hover:bg-[#ffc72c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
        >
          {spinning ? "Spinning…" : "Spin the reels"}
        </button>
        <p aria-live="polite" className="text-xs leading-snug text-white/60">
          {result ?? "Try it – every pick starts here."}
        </p>
      </div>
    </div>
  );
}
