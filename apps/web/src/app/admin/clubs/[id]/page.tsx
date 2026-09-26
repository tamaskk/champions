import { LEAGUE_ADJECTIVES, PLAYER_ROLES, buildSquadPrompt, seasonLabel } from "@champion/shared";
import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteSquadPlayerAction } from "@/app/admin/actions";
import { ShieldIcon, TrashIcon } from "@/components/admin/icons";
import { Badge, Card, DbError, PageHeader, buttonClass } from "@/components/admin/ui";
import { LOCAL_CLAUDE_ENABLED } from "@/server/claude-cli";
import { getClubSeason, listSquad } from "@/server/squad-data";

import { SquadPanel } from "./squad-panel";

const ROLE_TONE = { GK: "amber", DF: "indigo", MF: "green", FW: "rose" } as const;

// Per-player stat columns. null (or missing) = no data for that era, shown as "–".
const STAT_COLUMNS = [
  { key: "rating", label: "Rtg", title: "Rating 0–100 for this season (pipeline: rate; Messi 2011/12 = 100)" },
  { key: "decadeRating", label: "Dec", title: "Rating for picking him from this club decade (best + second best season)" },
  { key: "appearances", label: "Apps", title: "League appearances" },
  { key: "goals", label: "Goals", title: "League goals" },
  { key: "assists", label: "Ast", title: "Assists" },
  { key: "minutes", label: "Min", title: "Minutes played (estimated for old seasons)" },
  { key: "inSquad", label: "Sq", title: "Matchday squad call-ups" },
  { key: "subsOn", label: "On", title: "Substituted on" },
  { key: "subsOff", label: "Off", title: "Substituted off" },
  { key: "yellowCards", label: "YC", title: "Yellow cards" },
  { key: "secondYellowCards", label: "2YC", title: "Second yellow cards" },
  { key: "redCards", label: "RC", title: "Red cards" },
  { key: "pointsPerGame", label: "PPG", title: "Team points per game with the player" },
  { key: "cleanSheets", label: "CS", title: "Clean sheets (goalkeepers)" },
  { key: "goalsConceded", label: "GA", title: "Goals conceded (goalkeepers)" },
] as const;

export default async function ClubSeasonPage({ params }: PageProps<"/admin/clubs/[id]">) {
  const { id } = await params;

  let data;
  try {
    const found = await getClubSeason(id);
    data = found && {
      clubSeason: found,
      squad: await listSquad(found.league, found.season, found.clubSlug),
    };
  } catch (error) {
    return (
      <>
        <PageHeader title="Club" />
        <DbError error={error} />
      </>
    );
  }
  if (!data) notFound();
  const { clubSeason, squad } = data;

  const target = {
    league: clubSeason.league,
    season: clubSeason.season,
    clubSlug: clubSeason.clubSlug,
    club: clubSeason.club,
  };
  const counts = PLAYER_ROLES.map((role) => ({ role, n: squad.filter((p) => p.position === role).length }));

  return (
    <>
      <Link href="/admin/clubs" className="mb-3 inline-block text-sm text-muted hover:text-ink">
        ← Clubs
      </Link>
      <PageHeader title={clubSeason.club}>
        <Badge>{LEAGUE_ADJECTIVES[clubSeason.league]}</Badge>
        <Badge tone="amber">{seasonLabel(clubSeason.season)}</Badge>
      </PageHeader>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card
          title="Squad"
          icon={ShieldIcon}
          action={
            <span className="flex gap-2 text-xs text-muted tabular-nums">
              {counts.map(({ role, n }) => (
                <span key={role}>
                  {role} {n}
                </span>
              ))}
            </span>
          }
        >
          {squad.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              No players yet. Use the prompt or ask local Claude, then import the JSON.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-panel text-left text-muted">
                    <th className="rounded-l-lg px-3 py-2.5 font-medium">Pos</th>
                    <th className="px-3 py-2.5 font-medium">Player</th>
                    <th className="px-3 py-2.5 font-medium">Nat</th>
                    <th className="px-3 py-2.5 font-medium" title="Birth year, or age that season">
                      Born / age
                    </th>
                    {STAT_COLUMNS.map((c) => (
                      <th key={c.key} title={c.title} className="px-2 py-2.5 text-right font-medium">
                        {c.label}
                      </th>
                    ))}
                    <th className="rounded-r-lg px-3 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {squad.map((p) => (
                    <tr key={String(p._id)} className="border-b border-line last:border-0">
                      <td className="px-3 py-2.5">
                        <Badge tone={ROLE_TONE[p.position]}>{p.position}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="block font-medium text-ink">{p.name}</span>
                        {(p.positions?.length || p.detailedPosition) && (
                          <span className="block text-xs text-muted">{p.positions?.length ? p.positions.join(" · ") : p.detailedPosition}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted">
                        {p.nationalities?.length ? p.nationalities.join(", ") : (p.nationality ?? "–")}
                      </td>
                      <td className="px-3 py-2.5 text-muted tabular-nums">
                        {p.birthYear ?? (typeof p.age === "number" ? `${p.age} y` : "–")}
                      </td>
                      {STAT_COLUMNS.map((c) => (
                        <td key={c.key} className="px-2 py-2.5 text-right text-ink tabular-nums">
                          {p[c.key] ?? "–"}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right">
                        <form action={deleteSquadPlayerAction}>
                          <input type="hidden" name="id" value={String(p._id)} />
                          <button
                            aria-label={`Delete ${p.name}`}
                            className="rounded-lg p-1.5 text-muted hover:bg-rose-50 hover:text-rose-500"
                          >
                            <TrashIcon width={16} height={16} />
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <SquadPanel
          clubSeasonId={id}
          target={target}
          prompt={buildSquadPrompt(target)}
          localClaude={LOCAL_CLAUDE_ENABLED}
        />
      </div>

      <p className="mt-5 text-sm text-muted">
        <Link href={`/admin/clubs?league=${clubSeason.league}&season=${clubSeason.season}`} className={buttonClass.secondary}>
          Other {LEAGUE_ADJECTIVES[clubSeason.league]} clubs in {seasonLabel(clubSeason.season)}
        </Link>
      </p>
    </>
  );
}
