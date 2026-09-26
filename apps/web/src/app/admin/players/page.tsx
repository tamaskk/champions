import {
  DECADES,
  LEAGUES,
  LEAGUE_ADJECTIVES,
  PLAYER_ROLES,
  POSITION_CODES,
  seasonLabel,
} from "@champion/shared";
import Link from "next/link";

import { SearchIcon, UsersIcon } from "@/components/admin/icons";
import { Pagination } from "@/components/admin/pagination";
import { SortHeader } from "@/components/admin/sort-header";
import { Badge, Card, DbError, PageHeader, buttonClass } from "@/components/admin/ui";
import { PLAYER_PAGE_SIZE, listPlayers, parsePlayerFilters, type PlayerSortKey } from "@/server/player-data";

const field =
  "rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";

const ROLE_TONE = { GK: "amber", DF: "indigo", MF: "green", FW: "rose" } as const;

// Ratings and counts read best largest-first; text A–Z.
const FIRST_DIR: Record<PlayerSortKey, "asc" | "desc"> = {
  rating: "desc",
  decadeRating: "desc",
  name: "asc",
  clubSlug: "asc",
  league: "asc",
  season: "desc",
  position: "asc",
  appearances: "desc",
  goals: "desc",
};

function ratingTone(r: number) {
  if (r >= 85) return "bg-accent text-white";
  if (r >= 70) return "bg-emerald-500 text-white";
  if (r >= 55) return "bg-amber-400 text-ink";
  return "bg-canvas text-muted";
}

function Rating({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-muted/60">–</span>;
  return (
    <span className={`inline-block min-w-10 rounded-lg px-2 py-1 text-center text-xs font-semibold ${ratingTone(value)}`}>
      {Math.round(value)}
    </span>
  );
}

export default async function PlayersPage({ searchParams }: PageProps<"/admin/players">) {
  const filters = parsePlayerFilters(await searchParams);

  let result: Awaited<ReturnType<typeof listPlayers>>;
  try {
    result = await listPlayers(filters);
  } catch (error) {
    return (
      <>
        <PageHeader title="Players" />
        <DbError error={error} />
      </>
    );
  }
  const { rows, count, page, pages } = result;
  const first = (page - 1) * PLAYER_PAGE_SIZE + 1;
  const fmt = (n: number) => n.toLocaleString("en-US");

  const filterQuery = {
    q: filters.q,
    club: filters.club,
    league: filters.league,
    decade: filters.decade?.toString(),
    season: filters.season?.toString(),
    role: filters.role,
    code: filters.code,
    nat: filters.nat,
  };
  const sortProps = { basePath: "/admin/players", query: filterQuery, sort: filters.sort, dir: filters.dir } as const;
  const header = (column: PlayerSortKey, label: string, extra: { align?: "right"; className?: string } = {}) => (
    <SortHeader column={column} label={label} firstDir={FIRST_DIR[column]} {...sortProps} {...extra} />
  );
  const filtered = Object.values(filterQuery).some(Boolean);

  return (
    <>
      <PageHeader title="Players" />

      <Card
        title="Player seasons"
        icon={UsersIcon}
        action={
          <span className="text-sm text-muted tabular-nums">
            {count === 0 ? "0 rows" : `${fmt(first)}–${fmt(first + rows.length - 1)} of ${fmt(count)}`}
          </span>
        }
      >
        <form className="mb-5 flex flex-wrap items-center gap-3">
          <label className="relative min-w-48 flex-1">
            <span className="sr-only">Search player</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input name="q" defaultValue={filters.q} placeholder="Search player" className={`${field} w-full pl-10`} />
          </label>
          <input name="club" defaultValue={filters.club} placeholder="Club" aria-label="Club" className={`${field} w-40`} />
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
          <select name="role" defaultValue={filters.role ?? ""} aria-label="Role" className={field}>
            <option value="">All roles</option>
            {[...PLAYER_ROLES].reverse().map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select name="code" defaultValue={filters.code ?? ""} aria-label="Position" className={field}>
            <option value="">Any position</option>
            {POSITION_CODES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            name="nat"
            defaultValue={filters.nat}
            placeholder="Nat (ENG)"
            aria-label="Nationality code"
            maxLength={3}
            className={`${field} w-28 uppercase`}
          />
          {filters.sort !== "rating" || filters.dir !== "desc" ? (
            <>
              <input type="hidden" name="sort" value={filters.sort} />
              <input type="hidden" name="dir" value={filters.dir} />
            </>
          ) : null}
          <button className={buttonClass.primary}>Filter</button>
          {filtered && (
            <Link href="/admin/players" className={buttonClass.secondary}>
              Clear
            </Link>
          )}
        </form>

        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No players match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-panel text-left text-muted">
                  {header("rating", "Rtg", { className: "rounded-l-lg" })}
                  {header("decadeRating", "Decade Rtg")}
                  {header("name", "Player")}
                  {header("position", "Pos")}
                  {header("clubSlug", "Club")}
                  {header("league", "League")}
                  {header("season", "Season")}
                  <th className="px-3 py-2.5 font-medium">Nat</th>
                  {header("appearances", "Apps", { align: "right" })}
                  {header("goals", "Goals", { align: "right", className: "rounded-r-lg" })}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={String(p._id)} className="border-b border-line last:border-0">
                    <td className="px-3 py-2.5">
                      <Rating value={p.rating} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Rating value={p.decadeRating} />
                    </td>
                    <td className="px-3 py-2.5 font-medium text-ink">{p.name}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Badge tone={ROLE_TONE[p.position]}>{p.position}</Badge>
                      {p.positions?.length ? (
                        <span className="ml-2 text-xs text-muted">{p.positions.join(" · ")}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-ink">
                      {p.clubSeasonId ? (
                        <Link href={`/admin/clubs/${String(p.clubSeasonId)}`} className="hover:text-accent hover:underline">
                          {p.club}
                        </Link>
                      ) : (
                        <span className="text-muted">{p.clubSlug}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-ink">{LEAGUE_ADJECTIVES[p.league]}</td>
                    <td className="px-3 py-2.5 text-ink tabular-nums">{seasonLabel(p.season)}</td>
                    <td className="px-3 py-2.5 text-muted">{p.nationality ?? "–"}</td>
                    <td className="px-3 py-2.5 text-right text-ink tabular-nums">{p.appearances ?? "–"}</td>
                    <td className="px-3 py-2.5 text-right text-ink tabular-nums">{p.goals ?? "–"}</td>
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
            basePath="/admin/players"
            query={{
              ...filterQuery,
              ...(filters.sort !== "rating" || filters.dir !== "desc" ? { sort: filters.sort, dir: filters.dir } : {}),
            }}
          />
        </div>
      </Card>
    </>
  );
}
