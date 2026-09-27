import { connection } from "next/server";

import { SearchIcon, UsersIcon, ClockIcon } from "@/components/admin/icons";
import { Badge, Card, DbError, PageHeader, buttonClass } from "@/components/admin/ui";
import { ADMIN_GRANT_LIMIT, adminFindPlayers, adminRecentGrants } from "@/server/wallet-data";

import { GrantForm } from "./grant-form";

/** Coins: find a player by username or email and credit (or correct) coins; recent admin changes. */
export default async function CoinsPage({ searchParams }: PageProps<"/admin/coins">) {
  await connection();
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw : "";
  let players: Awaited<ReturnType<typeof adminFindPlayers>>;
  let recent: Awaited<ReturnType<typeof adminRecentGrants>>;
  try {
    [players, recent] = await Promise.all([adminFindPlayers(q), adminRecentGrants()]);
  } catch (error) {
    return (
      <>
        <PageHeader title="Coins" />
        <DbError error={error} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Coins" />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card title={q ? `Players matching “${q}”` : "Newest players"} icon={UsersIcon}>
          <form className="mb-5 flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Username or email"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink"
            />
            <button className={buttonClass.secondary}>
              <SearchIcon />
              Search
            </button>
          </form>
          <p className="mb-4 text-xs text-muted">
            A positive amount credits coins, a negative one corrects (never below 0). Up to {ADMIN_GRANT_LIMIT.toLocaleString("en-US")} at
            once. Every change is written to the coin ledger as “admin” with your note; the player sees the new balance the next
            time the app loads the wallet.
          </p>
          {players.length === 0 ? (
            <p className="text-sm text-muted">No players found.</p>
          ) : (
            <div className="flex flex-col divide-y divide-line">
              {players.map((p) => (
                <div key={p.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-ink">
                      @{p.username}
                      {p.registered ? <Badge tone="green">account</Badge> : <Badge tone="amber">guest</Badge>}
                    </p>
                    <p className="text-xs text-muted">
                      {p.email ?? "no email"} · joined {p.createdAt.toISOString().slice(0, 10)} ·{" "}
                      <span className="font-semibold text-ink tabular-nums">{p.balance.toLocaleString("en-US")} coins</span>
                    </p>
                  </div>
                  <GrantForm userId={p.userId} username={p.username} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent admin changes" icon={ClockIcon}>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">None yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-line">
              {recent.map((r, i) => (
                <div key={i} className="py-2.5 text-sm">
                  <p className="flex items-center justify-between gap-3">
                    <span className="font-medium text-ink">@{r.username}</span>
                    <span className={`font-semibold tabular-nums ${r.amount > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                      {r.amount > 0 ? "+" : ""}
                      {r.amount}
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {r.createdAt.toISOString().slice(0, 16).replace("T", " ")} · balance {r.balanceAfter}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
