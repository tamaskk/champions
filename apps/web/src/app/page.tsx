import { DISCLAIMER_SHORT } from "@champion/shared";
import type { Metadata } from "next";
import Image from "next/image";

import { body, display, mono } from "@/components/landing/fonts";
import { SlotMachine } from "@/components/landing/slot-machine";
import { WaitlistForm } from "@/components/landing/waitlist-form";
import { waitlistCount } from "@/server/waitlist-data";

// The waitlist count on the page refreshes every few minutes.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Spinvincible – spin, draft, go unbeaten",
  description:
    "Spin a decade, a league and a club, draft a real player from that squad and build an all-time XI. Join the waitlist for the launch.",
  openGraph: {
    title: "Spinvincible – spin, draft, go unbeaten",
    description: "Build an all-time football XI from real squads, 1960 to today. Join the waitlist.",
    images: [{ url: "/logo.png", width: 512, height: 512 }],
  },
};

const TICKER = ["60s", "ENG", "70s", "ESP", "80s", "ITA", "90s", "GER", "00s", "FRA", "10s", "20s", "38 matchdays", "0 defeats"];

const SHEET = [
  {
    n: "01",
    title: "Spin",
    text: "Three reels land one after the other: a decade, one of Europe's big five leagues, and a club that really played in it.",
    meta: "3 reels",
  },
  {
    n: "02",
    title: "Draft",
    text: "Pick one player from that club's real squad of the decade and put him where he fits. Chemistry decides how well your XI clicks.",
    meta: "11 picks",
  },
  {
    n: "03",
    title: "Play the season",
    text: "Your XI takes the place of a real club and plays a whole season, matchday by matchday – live, fast, or straight to the table.",
    meta: "38 matchdays",
  },
];

async function queueSize(): Promise<number | null> {
  try {
    return await waitlistCount();
  } catch {
    return null;
  }
}

/** Launch page: a matchday programme for a game that isn't out yet – and the waitlist. */
export default async function LandingPage() {
  const waiting = await queueSize();
  // Only worth showing once there's a crowd.
  const crowd = waiting !== null && waiting >= 25 ? waiting : null;

  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen bg-[#f3efe6] font-[family-name:var(--font-body)] text-[#0d141e] antialiased`}
    >
      {/* Masthead */}
      <header className="border-b-2 border-[#0d141e]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#" className="flex items-center gap-3" aria-label="Spinvincible">
            <Image src="/logo.png" alt="" width={40} height={40} priority />
            <span className="font-[family-name:var(--font-display)] text-2xl font-black tracking-tight uppercase">
              Spinvincible
            </span>
          </a>
          <p className="hidden font-[family-name:var(--font-mono)] text-xs tracking-[0.18em] text-[#4a5361] uppercase sm:block">
            iOS &amp; Android · launching soon
          </p>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-7xl gap-12 px-5 pt-12 pb-16 sm:px-8 lg:grid-cols-12 lg:gap-10 lg:pt-16 lg:pb-24">
          <div className="lg:col-span-7">
            <p className="font-[family-name:var(--font-mono)] text-xs tracking-[0.2em] text-[#1f6b3a] uppercase">
              The all-time draft · 1960 – today
            </p>
            <h1 className="mt-5 font-[family-name:var(--font-display)] text-[clamp(4.5rem,13vw,10.5rem)] leading-[0.82] font-black tracking-[-0.01em] uppercase">
              Spin.
              <br />
              Draft.
              <br />
              <span className="relative inline-block">
                <span className="relative z-10">Unbeaten.</span>
                <span aria-hidden className="absolute inset-x-0 bottom-[0.08em] z-0 h-[0.28em] bg-[#ffc72c]" />
              </span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-[#2c3440] sm:text-xl">
              Spin a decade, a league and a club. Draft a real player from that squad. Eleven picks later you have an
              all-time XI – and one question: could it get through a whole season without losing?
            </p>
            <div className="mt-9 max-w-xl">
              <WaitlistForm source="hero" />
              {crowd && (
                <p className="mt-4 font-[family-name:var(--font-mono)] text-sm text-[#0d141e]">
                  <span className="font-medium">{crowd.toLocaleString("en-US")}</span> already in the queue
                </p>
              )}
            </div>
          </div>
          <div className="lg:col-span-5 lg:pt-10">
            <SlotMachine />
          </div>
        </section>

        {/* Stadium board */}
        <div className="overflow-hidden border-y-2 border-[#0d141e] bg-[#0d141e] py-3" aria-hidden>
          <div className="landing-ticker flex w-max gap-10 font-[family-name:var(--font-mono)] text-sm tracking-[0.2em] text-[#ffc72c] uppercase">
            {[...TICKER, ...TICKER, ...TICKER, ...TICKER].map((t, i) => (
              <span key={i} className="flex items-center gap-10">
                {t}
                <span className="text-[#3a4454]">/</span>
              </span>
            ))}
          </div>
        </div>

        {/* Team sheet */}
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-12">
            <h2 className="font-[family-name:var(--font-display)] text-6xl leading-[0.9] font-black uppercase lg:col-span-4 lg:text-7xl">
              How a
              <br />
              draft
              <br />
              works
            </h2>
            <ol className="border-t-2 border-[#0d141e] lg:col-span-8">
              {SHEET.map((s) => (
                <li key={s.n} className="grid grid-cols-[4.5rem_1fr] gap-x-5 border-b border-[#0d141e]/25 py-7 sm:grid-cols-[6rem_1fr_auto]">
                  <span className="font-[family-name:var(--font-display)] text-6xl leading-none font-black text-[#1f6b3a] sm:text-7xl">
                    {s.n}
                  </span>
                  <div>
                    <h3 className="font-[family-name:var(--font-display)] text-3xl font-extrabold uppercase">{s.title}</h3>
                    <p className="mt-2 max-w-lg leading-relaxed text-[#2c3440]">{s.text}</p>
                  </div>
                  <span className="col-start-2 mt-3 font-[family-name:var(--font-mono)] text-xs tracking-[0.18em] text-[#4a5361] uppercase sm:col-start-3 sm:mt-1.5">
                    {s.meta}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* The perfect season */}
        <section className="relative overflow-hidden bg-[#1f6b3a] text-[#f3efe6]">
          {/* Chalk lines of a pitch */}
          <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.14]" preserveAspectRatio="none" viewBox="0 0 1200 600">
            <g fill="none" stroke="#f3efe6" strokeWidth="3">
              <rect x="30" y="30" width="1140" height="540" />
              <line x1="600" y1="30" x2="600" y2="570" />
              <circle cx="600" cy="300" r="90" />
              <rect x="30" y="160" width="150" height="280" />
              <rect x="1020" y="160" width="150" height="280" />
            </g>
          </svg>
          <div className="relative mx-auto grid max-w-7xl items-end gap-10 px-5 py-20 sm:px-8 lg:grid-cols-12 lg:py-28">
            <p
              className="font-[family-name:var(--font-display)] text-[clamp(8rem,26vw,20rem)] leading-[0.78] font-black tracking-tight lg:col-span-7"
              aria-label="38 wins, 0 defeats"
            >
              38–0
            </p>
            <div className="lg:col-span-5 lg:pb-6">
              <h2 className="font-[family-name:var(--font-display)] text-4xl leading-none font-black uppercase sm:text-5xl">
                The perfect season
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-[#e4efe6]">
                Every match is simulated by an engine fitted on 113,000 real league games. Great squads win titles.
                Winning all 38 is another story – most drafts never get close.
              </p>
              <dl className="mt-8 grid grid-cols-3 border-t border-[#f3efe6]/40 pt-5">
                {[
                  ["5", "leagues"],
                  ["7", "decades"],
                  ["113k", "real matches"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <dt className="sr-only">{l}</dt>
                    <dd className="font-[family-name:var(--font-display)] text-4xl font-black">{v}</dd>
                    <dd className="font-[family-name:var(--font-mono)] text-xs tracking-[0.18em] text-[#cfe3d4] uppercase">{l}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Ticket */}
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="landing-ticket mx-auto grid max-w-4xl bg-[#0d141e] text-[#f3efe6] md:grid-cols-[1fr_auto]">
            <div className="p-8 sm:p-12">
              <p className="font-[family-name:var(--font-mono)] text-xs tracking-[0.2em] text-[#ffc72c] uppercase">
                Admit one · launch day
              </p>
              <h2 className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-[0.9] font-black uppercase sm:text-6xl">
                Get your ticket
                <br />
                to kick-off
              </h2>
              <div className="mt-8">
                <WaitlistForm source="ticket" tone="ink" />
              </div>
            </div>
            <div className="hidden flex-col items-center justify-center gap-4 border-l-2 border-dashed border-[#f3efe6]/30 px-10 md:flex">
              <Image src="/logo.png" alt="" width={96} height={96} />
              <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.2em] text-[#8a94a3] uppercase [writing-mode:vertical-rl]">
                No. {crowd ? (crowd + 1).toLocaleString("en-US") : "0001"}
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-[#0d141e]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 font-[family-name:var(--font-mono)] text-xs text-[#4a5361] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} Spinvincible</p>
          <p className="max-w-xl sm:text-right">{DISCLAIMER_SHORT}</p>
        </div>
      </footer>
    </div>
  );
}
