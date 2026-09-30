"use client";

import { useEffect, useRef, useState } from "react";

import { useFirstView } from "./motion";

// The draft's three reels, in the app's order: decade, then league, then a club of that league.
const DECADES = ["20s", "10s", "00s", "90s", "80s", "70s", "60s"];
const LEAGUES = ["ENG", "ESP", "ITA", "GER", "FRA"] as const;
type LeagueCode = (typeof LEAGUES)[number];
// Clubs that played in their top flight in every decade from the 60s on, so any combination is real.
const CLUBS: Record<LeagueCode, string[]> = {
  ENG: ["Arsenal", "Liverpool", "Manchester United", "Everton", "Tottenham", "Chelsea", "Manchester City", "Aston Villa"],
  ESP: ["Real Madrid", "Barcelona", "Athletic Club", "Valencia", "Atlético Madrid", "Sevilla", "Real Sociedad", "Espanyol"],
  ITA: ["Juventus", "Milan", "Inter", "Roma", "Napoli", "Lazio", "Fiorentina", "Torino"],
  GER: ["Bayern Munich", "Borussia Dortmund", "Hamburg", "Werder Bremen", "Schalke 04", "Stuttgart", "Köln", "Gladbach"],
  FRA: ["Saint-Étienne", "Marseille", "Nantes", "Monaco", "Bordeaux", "Lyon", "Lille", "Nice"],
};
const LABELS = ["Decade", "League", "Club"];
const ROW = 56;
const LOOPS = 40;
/** Decade and league spin together (league stops later); the club reel spins once the league is known. */
const SPIN_MS = [1100, 1500, 1300];

type ReelPos = { row: number; animate: boolean };

/** Row of the strip that sits on the payline for item `index` after `laps` full laps. */
const rowFor = (len: number, index: number, laps: number) => laps * len + index;
/** Travel `extraLaps` further down from the current row, landing on `index` (restarting near the top when the strip runs out). */
const nextRow = (row: number, len: number, index: number, extraLaps: number) => {
  const lap = Math.floor(row / len) > LOOPS - 8 ? 1 : Math.floor(row / len);
  return rowFor(len, index, lap + extraLaps);
};

export function SlotMachine() {
  const [league, setLeague] = useState<LeagueCode>("ITA");
  const [pos, setPos] = useState<ReelPos[]>(() => [
    { row: rowFor(DECADES.length, 3, 1), animate: false },
    { row: rowFor(LEAGUES.length, 2, 1), animate: false },
    { row: rowFor(8, 0, 1), animate: false },
  ]);
  // Which reels are still turning (0 decade, 1 league, 2 club).
  const [turning, setTurning] = useState([false, false, false]);
  const spinning = turning.some(Boolean);
  const [result, setResult] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, f: () => void) => timers.current.push(setTimeout(f, ms));

  const reels = [DECADES, LEAGUES as readonly string[], CLUBS[league]];

  const spin = () => {
    if (spinning) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const d = Math.floor(Math.random() * DECADES.length);
    const l = Math.floor(Math.random() * LEAGUES.length);
    const c = Math.floor(Math.random() * 8);
    const newLeague = LEAGUES[l]!;
    setResult(null);

    if (reduced) {
      setLeague(newLeague);
      setPos((p) => [
        { row: nextRow(p[0]!.row, DECADES.length, d, 1), animate: false },
        { row: nextRow(p[1]!.row, LEAGUES.length, l, 1), animate: false },
        { row: nextRow(p[2]!.row, 8, c, 1), animate: false },
      ]);
      setResult(`Your pick: a player from ${CLUBS[newLeague][c]} in the ${DECADES[d]}.`);
      return;
    }

    // 1. Decade and league spin; the club reel waits for its league.
    setTurning([true, true, true]);
    setPos((p) => [
      { row: nextRow(p[0]!.row, DECADES.length, d, 3), animate: true },
      { row: nextRow(p[1]!.row, LEAGUES.length, l, 4), animate: true },
      p[2]!,
    ]);
    later(SPIN_MS[0]!, () => setTurning((t) => [false, t[1]!, t[2]!]));
    // 2. The league has landed: the club reel now holds that league's clubs and spins.
    later(SPIN_MS[1]!, () => {
      setTurning((t) => [t[0]!, false, t[2]!]);
      setLeague(newLeague);
      setPos((p) => [p[0]!, p[1]!, { row: nextRow(p[2]!.row, 8, c, 4), animate: true }]);
    });
    later(SPIN_MS[1]! + SPIN_MS[2]!, () => {
      setTurning([false, false, false]);
      setResult(`Your pick: a player from ${CLUBS[newLeague][c]} in the ${DECADES[d]}.`);
    });
  };

  // The first time the machine scrolls into view, it spins by itself.
  const [viewRef, inView] = useFirstView<HTMLDivElement>(0.6);
  const autoSpun = useRef(false);
  const spinRef = useRef(spin);
  useEffect(() => {
    spinRef.current = spin;
  });
  useEffect(() => {
    if (!inView || autoSpun.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    autoSpun.current = true;
    const t = setTimeout(() => spinRef.current(), 500);
    return () => clearTimeout(t);
  }, [inView]);

  return (
    <div ref={viewRef} className="p-5">
      <div className="mb-4 flex items-center justify-between text-xs text-white/55">
        <span>Spin 01 / 11</span>
        <span className="flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full ${spinning ? "animate-pulse bg-[#ffc72c]" : "bg-[#6ddc9e]"}`} />
          {spinning ? "Spinning" : "Ready"}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_1fr_1.7fr] gap-2">
        {reels.map((items, i) => (
          <div key={LABELS[i]}>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30" style={{ height: ROW * 3 }}>
              <div
                className="flex flex-col will-change-transform"
                style={{
                  transform: `translateY(${-(pos[i]!.row - 1) * ROW}px)`,
                  transition: pos[i]!.animate ? `transform ${SPIN_MS[i]}ms cubic-bezier(0.12, 0.8, 0.18, 1)` : "none",
                }}
              >
                {Array.from({ length: LOOPS * items.length }, (_, k) => {
                  const on = k === pos[i]!.row && !turning[i];
                  const waiting = i === 2 && turning[1];
                  return (
                    <div
                      key={k}
                      className={`grid place-items-center px-2 text-center leading-tight font-light transition-colors duration-300 ${
                        i === 2 ? "text-[15px] sm:text-base" : "text-[26px] tabular-nums"
                      } ${waiting ? "text-white/10" : on ? "text-white" : "text-white/20"}`}
                      style={{ height: ROW }}
                    >
                      {items[k % items.length]}
                    </div>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute inset-x-0 border-y border-[#ffc72c]/60 bg-[#ffc72c]/[0.06]" style={{ top: ROW, height: ROW }} />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[#121a24] to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#121a24] to-transparent" />
            </div>
            <p className="mt-2 text-center text-[11px] text-white/45">{LABELS[i]}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={spin}
          disabled={spinning}
          className="lp-shine shrink-0 cursor-pointer rounded-full bg-white px-5 py-2.5 text-sm font-medium whitespace-nowrap text-[#0d141e] transition-colors duration-200 hover:bg-[#ffc72c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
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
