import type { Metadata } from "next";
import { DISCLAIMER } from "@champion/shared";
import Link from "next/link";
import { notFound } from "next/navigation";

import { STORE_LINKS } from "@/content/stores";
import { squadDetail } from "@/server/leaderboard-data";

type Props = { params: Promise<{ id: string }> };

const OUTCOME_EMOJI = { champion: "🏆", top: "🥈", win: "✅", draw: "🤝", mid: "📊", loss: "❌", out: "🚪" } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const squad = await squadDetail((await params).id).catch(() => null);
  if (!squad) return { title: "Spinvincible" };
  return {
    title: `@${squad.username}'s XI · OVR ${Math.round(squad.overall)} · Spinvincible`,
    description: `${squad.formation} · CHEM ${squad.chemistry} – can your XI beat it?`,
  };
}

/** Public page of a shared squad: the XI, what it achieved, and links into the app to challenge it. */
export default async function SharedSquadPage({ params }: Props) {
  const { id } = await params;
  const squad = await squadDetail(id).catch(() => null);
  if (!squad) notFound();
  const stores = (
    [
      ["App Store", STORE_LINKS.appStore],
      ["Google Play", STORE_LINKS.playStore],
    ] satisfies [string, string | null][]
  ).flatMap(([label, href]) => (href ? [[label, href] as const] : []));

  return (
    <main className="min-h-screen bg-[#0d141e] px-4 py-10 text-[#dce3f1]">
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <header className="rounded-2xl bg-[#151c26] p-6 text-center">
          <p className="text-xs font-semibold tracking-widest text-[#6ddc9e] uppercase">Spinvincible · shared XI</p>
          <h1 className="mt-2 text-2xl font-bold">@{squad.username}</h1>
          <p className="mt-1 text-sm text-[#bdcabe]">{squad.formation} formation</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              ["Overall", Math.round(squad.overall), "#ffc72c"],
              ["Rating", squad.rating.toFixed(1), "#a4c9ff"],
              ["Chem", squad.chemistry, "#6ddc9e"],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-xl bg-[#232a35] py-3">
                <p className="text-[10px] font-semibold tracking-widest text-[#bdcabe] uppercase">{label}</p>
                <p className="text-2xl font-bold" style={{ color: String(color) }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </header>

        <section className="rounded-2xl bg-[#151c26] p-4">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-[#bdcabe] uppercase">What it achieved</h2>
          {squad.results.length === 0 ? (
            <p className="text-sm text-[#bdcabe]">Not played yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {[...squad.results].reverse().map((r, i) => (
                <li key={i} className="rounded-xl bg-[#19202a] px-3 py-2">
                  {OUTCOME_EMOJI[r.outcome]} <span className="font-semibold">{r.title}</span> · {r.detail}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-[#151c26] p-4">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-[#bdcabe] uppercase">Starting XI</h2>
          <ul className="flex flex-col gap-2">
            {squad.players.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex items-center gap-3 rounded-xl bg-[#19202a] px-3 py-2">
                <span className="w-9 text-xs font-bold text-[#a4c9ff]">{p.spot}</span>
                <span className="flex-1">
                  <span className="block font-semibold">{p.name}</span>
                  <span className="text-xs text-[#bdcabe]">
                    {p.club} · {p.decade}s
                  </span>
                </span>
                <span className="font-bold text-[#ffc72c]">{p.rating ?? "–"}</span>
              </li>
            ))}
          </ul>
        </section>

        {stores.length > 0 ? (
          <section className="flex flex-col gap-2">
            <p className="text-center text-sm font-semibold">Get Spinvincible and challenge this XI</p>
            <div className="grid grid-cols-2 gap-2">
              {stores.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  className="rounded-2xl bg-[#3093f8] py-3 text-center font-bold text-[#002b52]"
                >
                  {label}
                </a>
              ))}
            </div>
          </section>
        ) : (
          <Link href="/#join" className="rounded-2xl bg-[#3093f8] py-4 text-center font-bold text-[#002b52]">
            Not in the stores yet – join the waitlist
          </Link>
        )}
        {/* Custom-scheme links only work with the app installed: offered as the secondary path. */}
        <div className="rounded-2xl bg-[#151c26] p-4 text-center">
          <p className="text-xs text-[#bdcabe]">Already have the app?</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <a
              href={`spinvincible://ranks?challenge=${squad.id}`}
              className="rounded-xl bg-[#232a35] py-2.5 font-semibold"
            >
              Challenge this XI
            </a>
            <a href={`spinvincible://ranks?squad=${squad.id}`} className="rounded-xl bg-[#232a35] py-2.5 font-semibold">
              Open in app
            </a>
          </div>
        </div>
        <p className="text-center text-xs text-[#879489]">
          Draft your own XI from 60 years of European football – then play against this one.
        </p>
        <p className="text-center text-[11px] leading-relaxed text-[#5f6b62]">{DISCLAIMER}</p>
      </div>
    </main>
  );
}
