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
const ROW = 72;
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
    <div className="border-2 border-[#0d141e] bg-[#0d141e] p-4 shadow-[10px_10px_0_#ffc72c] sm:p-5">
      <div className="mb-4 flex items-center justify-between font-[family-name:var(--font-mono)] text-[11px] tracking-[0.2em] text-[#8a94a3] uppercase">
        <span>Draft · spin 01/11</span>
        <span className="flex items-center gap-1.5">
          <span className={`size-1.5 ${spinning ? "animate-pulse bg-[#ffc72c]" : "bg-[#6ddc9e]"}`} />
          {spinning ? "Spinning" : "Ready"}
        </span>
      </div>

      <div className="relative grid grid-cols-3 gap-2">
        {REELS.map((reel, i) => (
          <div key={reel.label}>
            <div className="relative overflow-hidden border border-white/15 bg-[#080f18]" style={{ height: ROW * 3 }}>
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
                      className={`grid place-items-center font-[family-name:var(--font-display)] text-[40px] leading-none font-extrabold transition-colors duration-300 ${
                        on ? "text-[#ffc72c]" : "text-[#3a4454]"
                      }`}
                      style={{ height: ROW }}
                    >
                      {reel.items[k % reel.items.length]}
                    </div>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute inset-x-0 border-y-2 border-[#ffc72c]" style={{ top: ROW, height: ROW }} />
            </div>
            <p className="mt-2 text-center font-[family-name:var(--font-mono)] text-[11px] tracking-[0.2em] text-[#8a94a3] uppercase">
              {reel.label}
            </p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={spin}
        disabled={spinning}
        className="mt-4 w-full cursor-pointer bg-[#ffc72c] py-3.5 font-[family-name:var(--font-display)] text-2xl font-black tracking-wide text-[#0d141e] uppercase transition-colors duration-200 hover:bg-[#ffd75e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffc72c] disabled:cursor-wait disabled:opacity-70"
      >
        {spinning ? "Spinning…" : "Spin"}
      </button>
      <p aria-live="polite" className="mt-3 min-h-[2.75rem] text-sm leading-snug text-[#c9d1dc]">
        {result ?? "Press spin – this is how every pick starts."}
      </p>
    </div>
  );
}
