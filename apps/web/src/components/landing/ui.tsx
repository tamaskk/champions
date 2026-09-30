import type { CSSProperties, ReactNode } from "react";

/** Italic serif accent inside a sans headline ("Spin. Draft. *Go unbeaten.*"). */
export function Accent({ children }: { children: ReactNode }) {
  return <em className="font-[family-name:var(--font-serif)] font-normal italic tracking-normal">{children}</em>;
}

/** Frosted-glass panel. */
export function Glass({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      style={style}
      className={`rounded-[22px] border border-white/[0.09] bg-[linear-gradient(160deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] shadow-[0_20px_60px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

/** Section heading: a plain line, then the serif italic line. */
export function SectionTitle({ plain, accent, text }: { plain: string; accent: string; text?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.05] font-light tracking-tight text-white">
        {plain}
        <br />
        <Accent>{accent}</Accent>
      </h2>
      {text && <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/55">{text}</p>}
    </div>
  );
}

/** A phone: titanium edge, dynamic island, the app's dark screen. */
export function Phone({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative aspect-[9/19.2] w-[260px] rounded-[46px] bg-[linear-gradient(145deg,#6b7480,#1c222a_40%,#3a424d)] p-[7px] shadow-[0_40px_90px_rgba(0,0,0,0.6)] ${className}`}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[40px] bg-[#0d141e]">
        <div className="absolute top-2.5 left-1/2 z-10 h-[22px] w-[82px] -translate-x-1/2 rounded-full bg-black" />
        <div className="flex items-center justify-between px-7 pt-3 text-[11px] font-semibold text-white">
          <span>9:41</span>
          <span className="flex gap-1">
            <span className="h-2 w-3 rounded-[2px] bg-white/90" />
            <span className="h-2 w-4 rounded-[2px] border border-white/80" />
          </span>
        </div>
        <div className="px-4 pt-5">{children}</div>
        {/* The app's pill tab bar */}
        <div className="absolute inset-x-4 bottom-4 flex items-center justify-around rounded-full border border-white/10 bg-[#151c26]/95 py-2.5">
          {["M3 10l9-7 9 7v10H3z", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15 9l-2 4-4 2 2-4z", "M5 20V10M12 20V4M19 20v-7", "M12 8a4 4 0 1 0 0 .01M4 21c0-4 4-6 8-6s8 2 8 6"].map(
            (d, i) => (
              <span key={i} className={`grid size-8 place-items-center rounded-full ${i === 0 ? "bg-[#30a46c] text-[#003920]" : "text-white/55"}`}>
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={d} />
                </svg>
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

/** Small monochrome line icons (24px grid). */
const PATHS: Record<string, string> = {
  reels: "M4 5h4v14H4zM10 5h4v14h-4zM16 5h4v14h-4zM2 12h2M20 12h2",
  squad: "M8 7a3 3 0 1 0 0 .01M16 7a3 3 0 1 0 0 .01M3 20c0-3 2.5-5 5-5s5 2 5 5M13 20c0-3 1.5-5 3-5s5 2 5 5",
  link: "M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1",
  table: "M4 5h16v14H4zM4 10h16M4 15h16M9 5v14",
  live: "M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4.5 4.5a11 11 0 0 0 0 15M19.5 4.5a11 11 0 0 1 0 15",
  fast: "M4 6l7 6-7 6zM13 6l7 6-7 6z",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8",
  share: "M6 12v7h12v-7M12 3v12M8 7l4-4 4 4",
  users: "M9 8a3 3 0 1 0 0 .01M3 20c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M18 15c2 .5 3 2.5 3 5",
};
export function Icon({ name, className = "size-5" }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
