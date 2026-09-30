import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { sans, serif } from "@/components/landing/fonts";
import { LEGAL_UPDATED } from "@/content/operator";

/** Shared frame of /privacy, /terms and /support: readable column, same look as the landing page. */
export function LegalPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div
      className={`${sans.variable} ${serif.variable} min-h-screen bg-[linear-gradient(180deg,#1a2531_0%,#0d141e_30%,#0a1017_100%)] font-[family-name:var(--font-sans)] text-white antialiased`}
    >
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Spinvincible home">
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-lg" />
          <span className="text-[15px] font-medium">Spinvincible</span>
        </Link>
        <nav className="flex gap-5 text-sm text-white/55" aria-label="Legal">
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
          <Link href="/terms" className="hover:text-white">Terms</Link>
          <Link href="/support" className="hover:text-white">Support</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-5 pt-8 pb-24">
        <h1 className="text-[clamp(2.2rem,5vw,3.25rem)] leading-tight font-light tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-white/45">Last updated {LEGAL_UPDATED}</p>
        {intro && <div className="mt-6 text-[16px] leading-relaxed text-white/70">{intro}</div>}
        <div className="legal mt-10 space-y-10">{children}</div>
      </main>
      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-5 py-6 text-xs text-white/40 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Spinvincible</p>
          <p>Unofficial fan game. Not affiliated with or endorsed by any club, league or player.</p>
        </div>
      </footer>
    </div>
  );
}

/** One numbered section. */
export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-xl font-medium tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-white/70 [&_a]:text-white [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-medium [&_strong]:text-white/90">
        {children}
      </div>
    </section>
  );
}
