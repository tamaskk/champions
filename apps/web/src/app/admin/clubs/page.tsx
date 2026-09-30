import { DECADES, LEAGUES, LEAGUE_ADJECTIVES, seasonLabel } from "@champion/shared";
import Link from "next/link";

import { deleteClubSeasonAction } from "@/app/admin/actions";
import { SearchIcon, ShieldIcon, TrashIcon, UploadIcon } from "@/components/admin/icons";
import { DeleteButton } from "@/components/admin/delete-button";
import { Pagination } from "@/components/admin/pagination";
import { SortHeader } from "@/components/admin/sort-header";
import { Card, DbError, PageHeader, buttonClass } from "@/components/admin/ui";
import {
  CLUB_PAGE_SIZE,
  listClubSeasons,
  parseClubFilters,
  type ClubSortKey,
} from "@/server/club-data";

const field =
  "rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";

// Numbers read best largest-first; text A–Z.
const FIRST_DIR: Record<ClubSortKey, "asc" | "desc"> = {
  club: "asc",
  league: "asc",
  season: "desc",
  decade: "desc",
  players: "desc",
  source: "asc",
};

export default async function ClubsPage({ searchParams }: PageProps<"/admin/clubs">) {
  const filters = parseClubFilters(await searchParams);

  let result: Awaited<ReturnType<typeof listClubSeasons>>;
  try {
    result = await listClubSeasons(filters);
  } catch (error) {
    return (
      <>
        <PageHeader title="Clubs" />
        <DbError error={error} />
      </>
    );
  }
  const { rows, count, page, pages } = result;
  const sortProps = {
    basePath: "/admin/clubs",
    query: {
      q: filters.q,
      league: filters.league,
      decade: filters.decade?.toString(),
      season: filters.season?.toString(),
    },
    sort: filters.sort,
    dir: filters.dir ?? "asc",
  } as const;
  const first = (page - 1) * CLUB_PAGE_SIZE + 1;
  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <>
      <PageHeader title="Clubs">
        <Link href="/admin/import" className={buttonClass.primary}>
          <UploadIcon />
          Import clubs
        </Link>
      </PageHeader>

      <Card
        title="Club seasons"
        icon={ShieldIcon}
        action={
          <span className="text-sm text-muted tabular-nums">
            {count === 0 ? "0 rows" : `${fmt(first)}–${fmt(first + rows.length - 1)} of ${fmt(count)}`}
          </span>
        }
      >
        <form className="mb-5 flex flex-wrap items-center gap-3">
          <label className="relative min-w-52 flex-1">
            <span className="sr-only">Search club</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input name="q" defaultValue={filters.q} placeholder="Search club" className={`${field} w-full pl-10`} />
          </label>
          <select name="league" defaultValue={filters.league ?? ""} aria-label="League" className={field}>
            <option value="">All leagues</option>
            {LEAGUES.map((l) => (
              <option key={l} value={l}>
                {LEAGUE_ADJECTIVES[l]}
              </option>
            ))}
          </select>
          <select name="decade" defaultValue={filters.decade ?? ""} aria-label="Decade" className={field}>
            <option value="">All decades</option>
            {DECADES.map((d) => (
              <option key={d} value={d}>
                {d}s
              </option>
            ))}
          </select>
          <input
            name="season"
            type="number"
            inputMode="numeric"
            defaultValue={filters.season}
            placeholder="Season"
            aria-label="Season start year"
            className={`${field} w-28`}
          />
          {filters.sort && (
            <>
              <input type="hidden" name="sort" value={filters.sort} />
              <input type="hidden" name="dir" value={filters.dir} />
            </>
          )}
          <button className={buttonClass.primary}>Filter</button>
          {(filters.q || filters.league || filters.decade || filters.season) && (
            <Link href="/admin/clubs" className={buttonClass.secondary}>
              Clear
            </Link>
          )}
        </form>

        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No clubs match. Import some first.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-panel text-left text-muted">
                  <SortHeader column="club" label="Club" {...sortProps} firstDir={FIRST_DIR.club} className="rounded-l-lg" />
                  <SortHeader column="league" label="League" {...sortProps} firstDir={FIRST_DIR.league} />
                  <SortHeader column="season" label="Season" {...sortProps} firstDir={FIRST_DIR.season} />
                  <SortHeader column="decade" label="Decade" {...sortProps} firstDir={FIRST_DIR.decade} />
                  <SortHeader column="players" label="Players" {...sortProps} firstDir={FIRST_DIR.players} align="right" />
                  <SortHeader column="source" label="Source" {...sortProps} firstDir={FIRST_DIR.source} />
                  <th className="rounded-r-lg px-3 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row._id)} className="border-b border-line last:border-0">
                    <td className="px-3 py-3 font-medium text-ink">
                      <Link href={`/admin/clubs/${String(row._id)}`} className="hover:text-accent hover:underline">
                        {row.club}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink">{LEAGUE_ADJECTIVES[row.league]}</td>
                    <td className="px-3 py-3 text-ink tabular-nums">{seasonLabel(row.season)}</td>
                    <td className="px-3 py-3 text-muted tabular-nums">{row.decade}s</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {row.players > 0 ? (
                        <Link
                          href={`/admin/clubs/${String(row._id)}`}
                          className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-100"
                        >
                          {row.players}
                        </Link>
                      ) : (
                        <span className="text-muted/60">–</span>
                      )}
                    </td>
                    <td className="max-w-48 truncate px-3 py-3 text-muted">{row.source ?? "–"}</td>
                    <td className="px-3 py-3 text-right">
                      <form action={deleteClubSeasonAction}>
                        <input type="hidden" name="id" value={String(row._id)} />
                        <DeleteButton
                          label={`Delete ${row.club} ${seasonLabel(row.season)}`}
                          confirmText={`Delete ${row.club} ${seasonLabel(row.season)} and its ${row.players} players?`}
                        >
                          <TrashIcon />
                        </DeleteButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-5">
          <Pagination
            page={page}
            pages={pages}
            basePath="/admin/clubs"
            query={{
              q: filters.q,
              league: filters.league,
              decade: filters.decade?.toString(),
              season: filters.season?.toString(),
              sort: filters.sort,
              dir: filters.sort && filters.dir,
            }}
          />
        </div>
      </Card>
    </>
  );
}
