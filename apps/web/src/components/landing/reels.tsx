const REELS = [
  { label: "Decade", items: ["60s", "70s", "80s", "90s", "00s", "10s", "20s"], duration: 14 },
  { label: "League", items: ["ENG", "ESP", "ITA", "GER", "FRA"], duration: 11 },
  { label: "Pick", items: ["ST", "CAM", "CB", "GK", "LW", "DM", "RB"], duration: 17 },
];
const ROW = 64;

/** The slot machine from the app, spinning slowly (still when reduced motion is on). */
export function Reels() {
  return (
    <div className="relative rounded-[28px] border border-white/10 bg-[#080f18]/80 p-4 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
      <div className="grid grid-cols-3 gap-3">
        {REELS.map((reel) => (
          <div key={reel.label} className="flex flex-col items-center gap-2">
            <div
              className="relative w-full overflow-hidden rounded-2xl border-2 border-[#ffc72c] bg-[#0d141e]"
              style={{ height: ROW * 3 }}
            >
              <div
                className="landing-reel flex flex-col"
                style={{ animationDuration: `${reel.duration}s`, ["--reel-height" as string]: `${reel.items.length * ROW}px` }}
              >
                {[...reel.items, ...reel.items].map((item, i) => (
                  <div
                    key={i}
                    className="grid place-items-center font-[family-name:var(--font-display)] text-2xl font-bold text-[#879489]"
                    style={{ height: ROW }}
                  >
                    {item}
                  </div>
                ))}
              </div>
              {/* Fade at the top and bottom, the gold payline in the middle */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#0d141e] to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0d141e] to-transparent" />
              {/* The payline: a gold copy of the same strip, clipped to the middle row (like the app) */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 overflow-hidden bg-[linear-gradient(rgba(255,199,44,0.09),rgba(255,199,44,0.09)),linear-gradient(#0d141e,#0d141e)]"
                style={{ top: ROW, height: ROW }}
              >
                <div
                  className="landing-reel flex flex-col"
                  style={{
                    marginTop: -ROW,
                    animationDuration: `${reel.duration}s`,
                    ["--reel-height" as string]: `${reel.items.length * ROW}px`,
                  }}
                >
                  {[...reel.items, ...reel.items].map((item, i) => (
                    <div
                      key={i}
                      className="grid place-items-center font-[family-name:var(--font-display)] text-3xl font-bold text-[#ffc72c] [text-shadow:0_0_18px_rgba(255,199,44,0.55)]"
                      style={{ height: ROW }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <span className="text-xs font-semibold tracking-[0.18em] text-[#6ddc9e] uppercase">{reel.label}</span>
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-1 flex justify-between" style={{ top: 16 + ROW * 1.5 - 8 }}>
        <span className="size-0 border-y-8 border-l-[12px] border-y-transparent border-l-[#6ddc9e]" />
        <span className="size-0 border-y-8 border-r-[12px] border-y-transparent border-r-[#6ddc9e]" />
      </div>
    </div>
  );
}
