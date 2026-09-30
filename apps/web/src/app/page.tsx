import { DISCLAIMER_SHORT } from "@champion/shared";
import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";

import { sans, serif } from "@/components/landing/fonts";
import { DraftScreen, MatchScreen, TableScreen } from "@/components/landing/screens";
import { CountUp, LetterReveal, Reveal } from "@/components/landing/motion";
import { SlotMachine } from "@/components/landing/slot-machine";
import { Accent, Glass, Icon, Phone, SectionTitle } from "@/components/landing/ui";
import { WaitlistForm } from "@/components/landing/waitlist-form";
import { waitlistCount } from "@/server/waitlist-data";

// The waitlist count on the page refreshes every few minutes.
export const revalidate = 300;

/** Footer background loop (external CDN; self-host under /public before launch). */
const FOOTER_VIDEO = "https://cdn.sceneai.art/Hero%20Section%20Video/5a6cf9a9-9f93-4e44-88f3-cf666065daf7.mp4";

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

async function queueSize(): Promise<number | null> {
  try {
    return await waitlistCount();
  } catch {
    return null;
  }
}

/** Launch page: what the game is, and the waitlist. */
export default async function LandingPage() {
  const waiting = await queueSize();
  // Only worth showing once there's a crowd.
  const crowd = waiting !== null && waiting >= 25 ? waiting : null;

  return (
    <div
      className={`${sans.variable} ${serif.variable} relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#1a2531_0%,#0d141e_22%,#0a1017_55%,#131c26_78%,#070b10_100%)] font-[family-name:var(--font-sans)] text-white antialiased`}
    >
      <Nav />
      <main>
        <Hero crowd={crowd} />
        <Features />
        <Steps />
        <Orbit />
        <Stats />
        <FinalCall />
      </main>
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="lp-fade-up relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <a href="#" className="flex items-center gap-2.5" aria-label="Spinvincible">
        <Image src="/logo.png" alt="" width={30} height={30} className="rounded-lg" priority />
        <span className="text-[15px] font-medium tracking-tight">Spinvincible</span>
      </a>
      <nav className="hidden items-center gap-8 text-sm text-white/65 md:flex" aria-label="Sections">
        <a href="#features" className="transition-colors hover:text-white">
          Features
        </a>
        <a href="#how" className="transition-colors hover:text-white">
          How it works
        </a>
        <a href="#modes" className="transition-colors hover:text-white">
          Modes
        </a>
      </nav>
      <a
        href="#join"
        className="lp-shine rounded-full bg-white px-4 py-2 text-sm font-medium text-[#0d141e] transition-colors duration-200 hover:bg-[#ffc72c]"
      >
        Join waitlist
      </a>
    </header>
  );
}

function Hero({ crowd }: { crowd: number | null }) {
  return (
    <section className="relative mx-auto max-w-7xl px-5 pt-8 pb-24 sm:px-8 lg:pt-12">
      {/* Slowly drifting light behind the hero */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-visible">
        <div className="lp-aurora absolute top-10 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-[#3093f8]/[0.13] blur-[110px]" />
        <div className="lp-aurora absolute top-40 left-[30%] size-[380px] rounded-full bg-[#ffc72c]/[0.07] blur-[100px] [animation-delay:-6s]" />
        <div className="lp-aurora absolute top-60 right-[18%] size-[340px] rounded-full bg-[#30a46c]/[0.09] blur-[100px] [animation-delay:-12s]" />
      </div>
      <div className="relative grid items-center gap-12 lg:grid-cols-[1fr_440px_1fr] lg:gap-8">
        {/* Left: headline */}
        <div className="lg:self-start lg:pt-6">
          <h1 className="text-[clamp(2.8rem,5.4vw,4.35rem)] leading-[0.98] font-light tracking-[-0.02em]">
            <span className="lp-line">
              <span style={{ animationDelay: "150ms" }}>Spin. Draft.</span>
            </span>
            <span className="lp-line">
              <span style={{ animationDelay: "320ms" }}>
                <Accent>Go unbeaten.</Accent>
              </span>
            </span>
          </h1>
          <p className="lp-fade-up mt-5 max-w-sm text-[15px] leading-relaxed text-white/60" style={{ animationDelay: "550ms" }}>
            An all-time football XI, built one spin at a time from real squads – 1960 to today.
          </p>
        </div>

        {/* Centre: the phone with floating glass cards (kept inside this column) */}
        <div className="relative mx-auto flex w-full max-w-[440px] justify-center">
          <div className="lp-phone-in" style={{ animationDelay: "250ms" }}>
            <Phone>
              <DraftScreen animate />
            </Phone>
          </div>
          <Glass className="lp-card-left absolute top-16 left-0 hidden w-36 p-3.5 sm:block" style={{ animationDelay: "900ms, 2.2s" }}>
            <p className="text-[11px] text-white/55">Overall</p>
            <CountUp value="85.2" className="block text-4xl font-light" duration={2200} />
            <p className="mt-1 text-[11px] text-[#6ddc9e]">+1.4 this pick</p>
          </Glass>
          <Glass className="lp-card-right absolute top-1/2 right-0 hidden w-40 p-3.5 sm:block" style={{ animationDelay: "1150ms, 2.6s" }}>
            <p className="text-[11px] text-white/55">Last spin</p>
            <div className="mt-1.5 flex justify-between text-lg font-light">
              <span>90s</span>
              <span className="text-white/40">·</span>
              <span>ITA</span>
              <span className="text-white/40">·</span>
              <span className="text-[#ffc72c]">CB</span>
            </div>
          </Glass>
          <Glass className="lp-card-left absolute bottom-12 left-0 hidden w-40 p-3.5 sm:block" style={{ animationDelay: "1350ms, 3s" }}>
            <p className="text-[11px] text-white/55">Chemistry</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[86%] rounded-full bg-[#6ddc9e]" />
            </div>
            <p className="mt-1.5 text-[11px] text-white/70">86 · 4 legend links</p>
          </Glass>
        </div>

        {/* Right: pitch and sign-up */}
        <div className="lp-fade-up lg:self-end lg:pb-6" style={{ animationDelay: "750ms" }}>
          <p className="max-w-sm text-[15px] leading-relaxed text-white/60">
            Spin a decade, a league and a club. Draft a real player from that squad. Eleven picks later – could your XI
            get through a whole season without losing?
          </p>
          <div className="mt-6">
            <WaitlistForm source="hero" />
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-white/50">
            <span className="size-1.5 rounded-full bg-[#6ddc9e]" />
            {crowd ? `${crowd.toLocaleString("en-US")} already waiting` : "Coming soon to iOS & Android"}
          </p>
        </div>
      </div>
    </section>
  );
}

const FEATURES: { title: string; text: string; card: ReactNode }[] = [
  {
    title: "Three reels, one pick",
    text: "Every pick starts with a spin: a decade, one of Europe's big five leagues, and a club that really played there. Then you choose one player from its real squad.",
    card: <SlotMachine />,
  },
  {
    title: "Chemistry that matters",
    text: "Team-mates, club legends and compatriots of the same era link up on the pitch – and lift the whole side. A great XI is more than eleven great names.",
    card: (
      <div className="p-6">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-white/60">Team chemistry</p>
          <CountUp value="86" className="text-5xl font-light" />
        </div>
        <div className="mt-5 space-y-2.5">
          {[
            ["Legends", "5+ seasons at one club", "+4"],
            ["Team-mates", "Same club, same season", "+3"],
            ["Compatriots", "Same nation, same era", "+2"],
          ].map(([k, d, v]) => (
            <div key={k} className="flex items-center justify-between rounded-xl bg-white/[0.05] px-4 py-3">
              <div>
                <p className="text-sm">{k}</p>
                <p className="text-xs text-white/45">{d}</p>
              </div>
              <span className="text-lg font-light text-[#6ddc9e]">{v}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "A season, matchday by matchday",
    text: "Your XI takes the place of a real club and plays all 38 matches. Watch your own game live, fast, or skip straight to the final table – it's saved as you go.",
    card: (
      <div className="flex items-center justify-between gap-6 p-6">
        <div>
          <p className="text-sm text-white/60">Matchday</p>
          <p className="text-5xl font-light">
            24<span className="text-2xl text-white/35"> / 38</span>
          </p>
          <p className="mt-2 text-xs text-[#6ddc9e]">1st · unbeaten</p>
        </div>
        <div className="grid size-28 place-items-center rounded-full border border-white/15 bg-white/[0.04]">
          <div className="text-center">
            <p className="text-2xl font-light">18-4-0</p>
            <p className="text-[10px] text-white/45">W · D · L</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "The Daily Challenge",
    text: "One challenge a day with the same reels for everyone. Compare scores with friends in private mini-leagues and keep your streak alive.",
    card: (
      <div className="p-6">
        <p className="text-sm text-white/60">This week · your league</p>
        <div className="mt-4 space-y-2">
          {[
            ["1", "You", "1,284"],
            ["2", "Friend", "1,190"],
            ["3", "Friend", "1,047"],
          ].map(([r, n, p]) => (
            <div
              key={r}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 ${r === "1" ? "bg-white/[0.09]" : "bg-white/[0.04]"}`}
            >
              <span className="w-4 text-sm text-white/45">{r}</span>
              <span className="flex-1 text-sm">{n}</span>
              <span className="font-light tabular-nums">{p}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

function Features() {
  return (
    <section id="features" className="relative scroll-mt-10 py-24">
      {/* Faint grid under the timeline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(transparent,black_15%,black_85%,transparent)]"
      />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <SectionTitle
            plain="Every pick,"
            accent="carefully weighed"
            text="Real squads, a chemistry system and a match engine fitted on 113,000 real games – all behind a single spin."
          />
        </Reveal>
        <div className="relative mt-20">
          <Reveal variant="draw" className="absolute top-0 bottom-0 left-1/2 hidden w-px bg-gradient-to-b from-white/5 via-white/25 to-white/5 md:block" />
          <div className="space-y-20 md:space-y-28">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="relative grid items-center gap-8 md:grid-cols-2 md:gap-20">
                <span
                  aria-hidden
                  className="lp-pulse absolute top-1/2 left-1/2 hidden size-2.5 -translate-1/2 rounded-full border border-[#6ddc9e]/70 bg-[#0d141e] md:block"
                />
                <Reveal className={i % 2 ? "md:order-2" : "md:text-right"}>
                  <div className={`max-w-sm ${i % 2 ? "" : "md:ml-auto"}`}>
                    <h3 className="text-2xl font-light tracking-tight">{f.title}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-white/55">{f.text}</p>
                  </div>
                </Reveal>
                <Reveal delay={150} className={i % 2 ? "md:order-1" : ""}>
                  <Glass className="transition-transform duration-500 hover:-translate-y-1">{f.card}</Glass>
                </Reveal>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Steps() {
  const steps = [
    { icon: "reels", title: "Spin the reels", text: "A decade, a league and a club land one after the other." },
    { icon: "squad", title: "Draft your player", text: "Pick from that club's real squad and place him where he fits." },
    { icon: "trophy", title: "Chase the perfect season", text: "Take your XI into a league season, a cup run or a single match." },
  ];
  return (
    <section id="how" className="relative scroll-mt-10 py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <SectionTitle
            plain="Spin it once."
            accent="Eleven times over."
            text="A draft takes a few minutes. The arguments about it take longer."
          />
        </Reveal>
        <Reveal delay={100}>
        <Glass className="mt-14 grid overflow-hidden md:grid-cols-[1fr_auto]">
          <div className="divide-y divide-white/[0.08]">
            {steps.map((s) => (
              <div key={s.title} className="flex gap-4 p-6 sm:p-8">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-white/80">
                  <Icon name={s.icon} />
                </span>
                <div>
                  <h3 className="text-lg font-normal">{s.title}</h3>
                  <p className="mt-1 max-w-sm text-sm leading-relaxed text-white/55">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex h-[340px] justify-center overflow-hidden border-t border-white/[0.08] bg-black/20 px-10 pt-10 md:h-auto md:border-t-0 md:border-l">
            <Phone className="w-[230px] translate-y-6">
              <TableScreen />
            </Phone>
          </div>
        </Glass>
        </Reveal>
      </div>
    </section>
  );
}

function OrbitItem({ icon, label, side }: { icon: string; label: string; side: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-3 ${side === "left" ? "md:flex-row-reverse md:text-right" : ""}`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/80">
        <Icon name={icon} className="size-[18px]" />
      </span>
      <span className="text-[15px] text-white/80">{label}</span>
    </div>
  );
}

function Orbit() {
  const left = [
    { icon: "live", label: "Live matches" },
    { icon: "reels", label: "Random or pick a season" },
    { icon: "trophy", label: "Champions-style cup" },
  ];
  const right = [
    { icon: "fast", label: "Fast or instant sim" },
    { icon: "calendar", label: "Daily Challenge" },
    { icon: "share", label: "Share your XI" },
  ];
  return (
    <section id="modes" className="relative scroll-mt-10 py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <SectionTitle
            plain="Every match,"
            accent="your way"
            text="Play a single match, a full league season or a cup run – and watch it however you like."
          />
        </Reveal>
        <div className="relative mt-16 grid items-center gap-10 md:grid-cols-[1fr_auto_1fr]">
          <div className="grid gap-8 md:gap-14">
            {left.map((x, i) => (
              <Reveal key={x.label} delay={i * 150} className={i === 1 ? "md:-mr-10" : ""}>
                <OrbitItem {...x} side="left" />
              </Reveal>
            ))}
          </div>
          <div className="relative mx-auto">
            {/* Rings turning around the phone, each with a dot riding it */}
            <div aria-hidden className="absolute top-1/2 left-1/2 size-[520px] -translate-1/2">
              <div className="lp-spin-slow size-full rounded-full border border-white/[0.06]">
                <span className="absolute top-0 left-1/2 size-2 -translate-1/2 rounded-full bg-[#ffc72c] shadow-[0_0_14px_#ffc72c]" />
              </div>
            </div>
            <div aria-hidden className="absolute top-1/2 left-1/2 size-[400px] -translate-1/2">
              <div className="lp-spin-slower size-full rounded-full border border-white/[0.08] bg-white/[0.015]">
                <span className="absolute bottom-0 left-1/2 size-1.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#6ddc9e] shadow-[0_0_12px_#6ddc9e]" />
              </div>
            </div>
            <Reveal>
              <Phone>
                <MatchScreen />
              </Phone>
            </Reveal>
          </div>
          <div className="grid gap-8 md:gap-14">
            {right.map((x, i) => (
              <Reveal key={x.label} delay={i * 150 + 75} className={i === 1 ? "md:-ml-10" : ""}>
                <OrbitItem {...x} side="right" />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    ["Leagues", "Europe's big five, season by season", "5"],
    ["Decades", "From the 1960s to today", "7"],
    ["Real matches", "Behind the match engine", "113k"],
    ["The perfect season", "Wins and defeats to aim for", "38–0"],
  ];
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <SectionTitle plain="Built on real football." accent="Decided on the pitch." />
        </Reveal>
        <dl className="mt-16 grid grid-cols-2 gap-x-6 gap-y-12 border-t border-white/10 pt-10 md:grid-cols-4">
          {stats.map(([label, text, value], i) => (
            <Reveal key={label} delay={i * 120}>
              <dt className="text-sm text-white/85">{label}</dt>
              <dd className="mt-1 text-xs leading-relaxed text-white/45">{text}</dd>
              <dd className="mt-6 text-5xl font-light tracking-tight">
                <CountUp value={value!} />
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

function FinalCall() {
  return (
    <section id="join" className="scroll-mt-10 px-5 py-16 sm:px-8">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.01))] px-6 pt-16 text-center">
        <Reveal>
          <SectionTitle plain="Spin your draft." accent="Chase the perfect season." />
        </Reveal>
        <Reveal delay={150} className="mt-8">
          <WaitlistForm source="final" align="center" />
        </Reveal>
        <div className="relative mx-auto mt-14 flex h-[330px] max-w-xl justify-center gap-6 overflow-hidden sm:h-[380px]">
          <Reveal delay={200}>
            <Phone className="w-[230px] translate-y-6 rotate-[-6deg]">
              <DraftScreen />
            </Phone>
          </Reveal>
          <Reveal delay={350} className="hidden sm:block">
            <Phone className="w-[230px] translate-y-14 rotate-[5deg]">
              <MatchScreen />
            </Phone>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative isolate overflow-hidden pt-28">
      {/* Background: looping video under a 40% black veil (hidden with reduced motion). */}
      <video
        className="lp-footer-video absolute inset-0 -z-20 h-full w-full object-cover"
        src={FOOTER_VIDEO}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
      />
      <div className="absolute inset-0 -z-10 bg-black/40" />
      {/* Blends the video into the page background above it (no hard edge). */}
      <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-[#121a24] via-[#121a24]/70 to-transparent" />

      <div className="flex justify-center px-5">
        <a
          href="#join"
          className="lp-ring-border inline-flex items-center gap-4 rounded-full py-2.5 pr-2.5 pl-7 text-[15px] font-medium tracking-tight text-white"
        >
          Join the waitlist
          <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-[#ff8a00] to-[#ea580c] text-black">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </a>
      </div>

      {/* The footer itself on a frosted glass panel over the video. */}
      <div className="mx-auto mt-[3.25rem] max-w-7xl px-1.5 sm:px-6">
        <div className="rounded-[32px] border border-white/[0.12] bg-white/[0.05] px-6 py-10 shadow-[0_30px_80px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl sm:px-10">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
            <div>
              <a href="#" className="flex items-center gap-2.5" aria-label="Spinvincible">
                <Image src="/logo.png" alt="" width={28} height={28} className="rounded-lg" />
                <span className="text-[15px] font-medium">Spinvincible</span>
              </a>
              <p className="mt-5 text-2xl leading-snug font-light">
                An all-time XI,
                <br />
                <Accent>one spin at a time.</Accent>
              </p>
              <div className="mt-6">
                <WaitlistForm source="footer" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 text-sm">
              <div>
                <p className="text-white/85">Game</p>
                <ul className="mt-3 space-y-2 text-white/50">
                  <li>
                    <a href="#features" className="hover:text-white">
                      Features
                    </a>
                  </li>
                  <li>
                    <a href="#how" className="hover:text-white">
                      How it works
                    </a>
                  </li>
                  <li>
                    <a href="#modes" className="hover:text-white">
                      Modes
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-white/85">Launch</p>
                <ul className="mt-3 space-y-2 text-white/50">
                  <li>iOS – coming soon</li>
                  <li>Android – coming soon</li>
                  <li>
                    <a href="#join" className="hover:text-white">
                      Join the waitlist
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-white/85">Legal</p>
                <ul className="mt-3 space-y-2 text-white/50">
                  <li>
                    <a href="/privacy" className="hover:text-white">
                      Privacy
                    </a>
                  </li>
                  <li>
                    <a href="/terms" className="hover:text-white">
                      Terms
                    </a>
                  </li>
                  <li>
                    <a href="/support" className="hover:text-white">
                      Support
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-2 border-t border-white/[0.1] pt-6 text-xs text-white/50 sm:flex-row sm:justify-between">
            <p>© {new Date().getFullYear()} Spinvincible</p>
            <p>{DISCLAIMER_SHORT}</p>
          </div>
        </div>
      </div>
      {/* The giant wordmark, cut off by the page edge */}
      <LetterReveal
        text="Spinvincible"
        className="mt-6 -mb-[0.2em] text-center font-[family-name:var(--font-serif)] text-[clamp(4rem,19vw,17rem)] leading-none whitespace-nowrap text-white/90 italic select-none"
      />
    </footer>
  );
}
