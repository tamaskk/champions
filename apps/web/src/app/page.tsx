import { DISCLAIMER_SHORT } from "@champion/shared";
import type { Metadata } from "next";
import Image from "next/image";

import { body, display } from "@/components/landing/fonts";
import { Reels } from "@/components/landing/reels";
import { WaitlistForm } from "@/components/landing/waitlist-form";

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

const STEPS = [
  {
    n: "01",
    title: "Spin",
    text: "Three reels: a decade, one of Europe's top five leagues, and a club that really played there.",
  },
  {
    n: "02",
    title: "Draft",
    text: "Pick one player from that club's real squad of the decade. Spot by spot, until your XI is complete.",
  },
  {
    n: "03",
    title: "Go unbeaten",
    text: "Play a real season, matchday by matchday. A match engine fitted on 113,000 real matches decides.",
  },
];

const FEATURES = [
  { title: "Real squads, 1960 – today", text: "The top flights of England, Spain, Italy, Germany and France, season by season." },
  { title: "Chemistry that matters", text: "Team-mates, club legends and compatriots link up – and lift the whole side." },
  { title: "A Daily Challenge", text: "Same reels for everyone, every day. Compare with friends in private leagues." },
  { title: "Every match, your way", text: "Watch a match live, fast, or skip straight to the final table." },
];

/** Launch page: what the game is, and the waitlist sign-up. */
export default function LandingPage() {
  return (
    <div
      className={`${display.variable} ${body.variable} relative min-h-screen overflow-hidden bg-[#0d141e] font-[family-name:var(--font-body)] text-[#dce3f1]`}
    >
      {/* Soft pitch-green and gold light behind the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(60%_50%_at_20%_10%,rgba(48,164,108,0.18),transparent_70%),radial-gradient(45%_40%_at_85%_25%,rgba(255,199,44,0.10),transparent_70%)]"
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <a href="#" className="flex items-center gap-3" aria-label="Spinvincible home">
          <Image src="/logo.png" alt="" width={36} height={36} className="rounded-xl" priority />
          <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">Spinvincible</span>
        </a>
        <a
          href="#join"
          className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-[#dce3f1] transition hover:border-white/30 hover:bg-white/5"
        >
          Join the waitlist
        </a>
      </header>

      <main className="relative">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pt-10 pb-20 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-28">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#6ddc9e]/25 bg-[#6ddc9e]/10 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-[#6ddc9e] uppercase">
              <span className="size-1.5 rounded-full bg-[#6ddc9e]" aria-hidden />
              Coming soon to iOS &amp; Android
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[1.02] font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              Spin. Draft.
              <br />
              <span className="text-[#ffc72c]">Go unbeaten.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#bdcabe] text-pretty">
              Spin a decade, a league and a club. Draft a real player from that squad. Build an all-time XI – then find
              out if it could win the league without losing a game.
            </p>
            <div className="mt-9">
              <WaitlistForm source="hero" />
            </div>
          </div>
          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <Reels />
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-white/[0.06] bg-[#080f18]/60">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="rounded-3xl border border-white/[0.07] bg-[#151c26] p-7">
                  <span className="font-[family-name:var(--font-display)] text-sm font-bold text-[#ffc72c]">{s.n}</span>
                  <h3 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-[#bdcabe]">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-[#6ddc9e]" aria-hidden />
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-xl font-bold">{f.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-[#bdcabe]">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Final call */}
        <section id="join" className="mx-auto max-w-6xl scroll-mt-10 px-5 pb-24 sm:px-8">
          <div className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#151c26] px-6 py-14 text-center sm:px-12">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(255,199,44,0.12),transparent_70%)]"
            />
            <div className="relative">
              <Image src="/logo.png" alt="" width={72} height={72} className="mx-auto rounded-2xl" />
              <h2 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Be first on the pitch
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-[#bdcabe]">
                Join the waitlist and we&apos;ll tell you the moment Spinvincible launches.
              </p>
              <div className="mt-8">
                <WaitlistForm source="footer" align="center" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-[#879489] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} Spinvincible</p>
          <p className="max-w-xl sm:text-right">{DISCLAIMER_SHORT}</p>
        </div>
      </footer>
    </div>
  );
}
