import { DECADES, LEAGUES, LEAGUE_ADJECTIVES, seasonLabel, type League } from "@champion/shared";
import Link from "next/link";
import { connection } from "next/server";

import { CalendarIcon, ClockIcon, GlobeIcon, LayersIcon, ShieldIcon, TrophyIcon, UploadIcon } from "@/components/admin/icons";
import { Badge, Card, DbError, PageHeader, StatCard, buttonClass } from "@/components/admin/ui";
import { getDashboardData } from "@/server/club-data";

const LEAGUE_COLORS: Record<League, string> = {
  ENG: "#5b5bd6",
  ESP: "#f5b73b",
  ITA: "#8b5cf6",
  GER: "#ec4899",
  FRA: "#22b8a6",
};

const fmt = (n: number) => n.toLocaleString("en-US");

export default async function DashboardPage() {
  await connection();

  let data: Awaited<ReturnType<typeof getDashboardData>>;
  try {
    data = await getDashboardData();
  } catch (error) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <DbError error={error} />
      </>
    );
  }

  const currentYear = new Date().getFullYear();
  const seasonsInDecade = (decade: number) => Math.max(1, Math.min(10, currentYear - decade + 1));
  const cell = (league: League, decade: number) =>
    data.cells.find((c) => c.league === league && c.decade === decade);

  let angle = 0;
  const donut = data.total
    ? data.byLeague
        .map(({ league, count }) => {
          const from = angle;
          angle += (count / data.total) * 360;
          return `${LEAGUE_COLORS[league]} ${from}deg ${angle}deg`;
        })
        .join(", ")
    : "#eceef2 0deg 360deg";

  return (
    <>
      <PageHeader title="Dashboard">
        <Link href="/admin/import" className={buttonClass.primary}>
          <UploadIcon />
          Import clubs
        </Link>
      </PageHeader>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Club seasons" value={fmt(data.total)} icon={LayersIcon} tone="indigo" />
        <StatCard label="Clubs" value={fmt(data.clubs)} icon={ShieldIcon} tone="green" />
        <StatCard label="Seasons" value={fmt(data.seasons)} icon={CalendarIcon} tone="amber" />
        <StatCard label="Leagues" value={`${data.leaguesCovered} / ${LEAGUES.length}`} icon={GlobeIcon} tone="rose" />
      </div>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Coverage" icon={LayersIcon}>
          <p className="-mt-3 mb-5 text-sm text-muted">Clubs per league and decade. Shade = share of seasons imported.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-1.5 text-sm">
              <thead>
                <tr>
                  <th />
                  {DECADES.map((d) => (
                    <th key={d} className="pb-1 font-medium text-muted">
                      {d}s
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LEAGUES.map((league) => (
                  <tr key={league}>
                    <th className="pr-3 text-left font-medium whitespace-nowrap text-ink">
                      <span className="mr-2 inline-block size-2 rounded-full" style={{ background: LEAGUE_COLORS[league] }} />
                      {LEAGUE_ADJECTIVES[league]}
                    </th>
                    {DECADES.map((decade) => {
                      const c = cell(league, decade);
                      const share = c ? c.seasons / seasonsInDecade(decade) : 0;
                      return (
                        <td
                          key={decade}
                          title={c ? `${c.clubs} clubs · ${c.seasons}/${seasonsInDecade(decade)} seasons` : "No data"}
                          className="h-14 rounded-xl text-center tabular-nums"
                          style={{
                            background: c ? `rgba(91, 91, 214, ${0.12 + share * 0.78})` : "#f4f5f8",
                            color: share > 0.5 ? "#fff" : "#111827",
                          }}
                        >
                          {c ? (
                            <Link
                              href={`/admin/clubs?league=${league}&decade=${decade}`}
                              className="flex h-full flex-col items-center justify-center"
                            >
                              <span className="font-semibold">{c.clubs}</span>
                              <span className="text-[11px] opacity-75">
                                {c.seasons}/{seasonsInDecade(decade)}
                              </span>
                            </Link>
                          ) : (
                            <span className="text-muted/60">–</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="By league" icon={TrophyIcon}>
          <div className="relative mx-auto my-2 size-44 rounded-full" style={{ background: `conic-gradient(${donut})` }}>
            <div className="absolute inset-5 grid place-items-center rounded-full bg-white text-center">
              <div>
                <p className="text-xs text-muted">Club seasons</p>
                <p className="text-xl font-semibold text-ink tabular-nums">{fmt(data.total)}</p>
              </div>
            </div>
          </div>
          <ul className="mt-6 flex flex-col gap-3 text-sm">
            {data.byLeague.map(({ league, count }) => (
              <li key={league} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-ink">
                  <span className="size-2 rounded-full" style={{ background: LEAGUE_COLORS[league] }} />
                  {LEAGUE_ADJECTIVES[league]}
                </span>
                <span className="flex gap-4 tabular-nums">
                  <span className="text-muted">{fmt(count)}</span>
                  <span className="w-10 text-right font-semibold text-ink">
                    {data.total ? Math.round((count / data.total) * 100) : 0}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card title="Recent imports" icon={ClockIcon}>
          {data.recentImports.length === 0 ? (
            <p className="text-sm text-muted">No imports yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.recentImports.map((log) => (
                <li key={String(log._id)} className="flex items-center gap-4 rounded-xl border border-line p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                    <UploadIcon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{log.fileName ?? "Pasted JSON"}</p>
                    <p className="text-sm text-muted">
                      {log.leagues.join(", ")} · {log.seasonFrom === log.seasonTo ? log.seasonFrom : `${log.seasonFrom}–${log.seasonTo}`} ·{" "}
                      {log.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                    </p>
                  </div>
                  <Badge tone={log.inserted > 0 ? "green" : "indigo"}>
                    {log.inserted ? `+${fmt(log.inserted)} new` : "no new"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Latest club seasons"
          icon={ShieldIcon}
          action={
            <Link href="/admin/clubs" className={buttonClass.secondary}>
              See all
            </Link>
          }
        >
          {data.latest.length === 0 ? (
            <p className="text-sm text-muted">Nothing imported yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-panel text-left text-muted">
                    <th className="rounded-l-lg px-3 py-2.5 font-medium">Club</th>
                    <th className="px-3 py-2.5 font-medium">League</th>
                    <th className="px-3 py-2.5 font-medium">Season</th>
                    <th className="rounded-r-lg px-3 py-2.5 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {data.latest.map((row) => (
                    <tr key={String(row._id)} className="border-b border-line last:border-0">
                      <td className="px-3 py-3.5 font-medium text-ink">{row.club}</td>
                      <td className="px-3 py-3.5 text-ink">{LEAGUE_ADJECTIVES[row.league]}</td>
                      <td className="px-3 py-3.5 text-ink tabular-nums">{seasonLabel(row.season)}</td>
                      <td className="max-w-40 truncate px-3 py-3.5 text-muted">{row.source ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
