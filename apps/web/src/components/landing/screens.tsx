// App screens recreated for the phone mock-ups (the app's own dark design: navy, gold, green).

const GOLD = "#ffc72c";
const GREEN = "#6ddc9e";

/** Draft screen: a 4-3-3 on the pitch with ratings, chemistry and overall. */
export function DraftScreen() {
  const rows = [
    [["LW", 84], ["ST", 91], ["RW", 86]],
    [["CM", 83], ["CM", 88], ["CM", 82]],
    [["LB", 80], ["CB", 87], ["CB", 85], ["RB", 81]],
    [["GK", 86]],
  ] as const;
  return (
    <div className="text-white">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-[#6ddc9e] uppercase">Your draft</p>
      <p className="mt-1 text-lg font-semibold">4-3-3 · all-time XI</p>
      <div className="relative mt-3 flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-[linear-gradient(#1b5e2a,#206e31)] px-2 py-4">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/25" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 size-14 -translate-1/2 rounded-full border border-white/25" />
        {rows.map((row, i) => (
          <div key={i} className="relative flex justify-around">
            {row.map(([pos, r], k) => (
              <div key={k} className="flex flex-col items-center gap-0.5">
                <span className="grid size-8 place-items-center rounded-full border border-white/30 bg-[#0d141e] text-[10px] font-bold" style={{ color: r >= 88 ? GOLD : "#fff" }}>
                  {r}
                </span>
                <span className="text-[8px] font-semibold text-white/80">{pos}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/[0.06] p-2.5">
          <p className="text-[9px] text-white/50 uppercase">Overall</p>
          <p className="text-xl font-semibold" style={{ color: GOLD }}>85.2</p>
        </div>
        <div className="rounded-xl bg-white/[0.06] p-2.5">
          <p className="text-[9px] text-white/50 uppercase">Chemistry</p>
          <p className="text-xl font-semibold" style={{ color: GREEN }}>86</p>
        </div>
      </div>
    </div>
  );
}

/** Live match: clock, score, goal timeline. */
export function MatchScreen() {
  return (
    <div className="text-white">
      <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-[#6ddc9e]/15 px-3 py-1 text-[10px] font-semibold text-[#6ddc9e]">
        <span className="size-1.5 animate-pulse rounded-full bg-[#6ddc9e]" />
        LIVE 67&apos;
      </div>
      <div className="mt-4 flex items-center justify-between px-1">
        <div className="text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-[#3093f8]/25 text-[11px] font-bold text-[#a4c9ff]">XI</div>
          <p className="mt-1 text-[10px] text-white/70">Your XI</p>
        </div>
        <p className="text-4xl font-semibold tabular-nums">2 – 1</p>
        <div className="text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-white/70">A</div>
          <p className="mt-1 text-[10px] text-white/70">Away side</p>
        </div>
      </div>
      <div className="mt-5 space-y-2">
        {[
          ["12'", "Goal · ST", "1 – 0", true],
          ["38'", "Yellow card · CB", "", true],
          ["51'", "Goal · Away side", "1 – 1", false],
          ["64'", "Goal · AM", "2 – 1", true],
        ].map(([m, t, s, yours], i) => (
          <div key={i} className="flex items-center justify-between rounded-xl bg-white/[0.06] px-3 py-2 text-[11px]">
            <span className={yours ? "text-[#a4c9ff]" : "text-white/60"}>{m}</span>
            <span className="flex-1 px-2 text-white/85">{t}</span>
            <span className="text-white/60 tabular-nums">{s}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-1.5 text-center text-[10px] font-semibold">
        <span className="rounded-lg bg-white/[0.06] py-2 text-white/70">Result</span>
        <span className="rounded-lg bg-[#3093f8]/25 py-2 text-[#a4c9ff]">Fast</span>
        <span className="rounded-lg bg-white/[0.06] py-2 text-white/70">Live</span>
      </div>
    </div>
  );
}

/** League table after a matchday, your XI on top. */
export function TableScreen() {
  const rows = [
    ["1", "Your XI", "24", "58", true],
    ["2", "Northern side", "24", "51", false],
    ["3", "River club", "24", "47", false],
    ["4", "Capital club", "24", "45", false],
    ["5", "Harbour club", "24", "41", false],
  ] as const;
  return (
    <div className="text-white">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-[#6ddc9e] uppercase">Matchday 24 / 38</p>
      <p className="mt-1 text-lg font-semibold">Season in progress</p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-[63%] bg-[#6ddc9e]" />
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        {rows.map(([p, n, pl, pts, you]) => (
          <div key={p} className={`flex items-center gap-2 px-3 py-2 text-[11px] ${you ? "bg-[#3093f8]/15" : "odd:bg-white/[0.03]"}`}>
            <span className="w-3 text-white/50">{p}</span>
            <span className={`flex-1 ${you ? "font-semibold text-[#a4c9ff]" : "text-white/80"}`}>{n}</span>
            <span className="w-5 text-right text-white/50">{pl}</span>
            <span className="w-6 text-right font-semibold" style={{ color: you ? GOLD : "#fff" }}>{pts}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[10px] text-white/50">Unbeaten · 18 W · 4 D · 0 L</p>
    </div>
  );
}
