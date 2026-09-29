import { connection } from "next/server";

import { DownloadIcon, UsersIcon } from "@/components/admin/icons";
import { Card, DbError, PageHeader, StatCard, buttonClass } from "@/components/admin/ui";
import { waitlistStats } from "@/server/waitlist-data";

/** Launch waitlist from the landing page: counts, latest sign-ups, CSV export. */
export default async function WaitlistPage() {
  await connection();
  let stats: Awaited<ReturnType<typeof waitlistStats>>;
  try {
    stats = await waitlistStats();
  } catch (error) {
    return (
      <>
        <PageHeader title="Waitlist" />
        <DbError error={error} />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Waitlist">
        <a href="/admin/waitlist/export" className={buttonClass.secondary}>
          <DownloadIcon />
          Export CSV
        </a>
      </PageHeader>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Signed up" value={stats.total.toLocaleString("en-US")} icon={UsersIcon} tone="indigo" />
        <StatCard label="Today (UTC)" value={stats.today.toLocaleString("en-US")} icon={UsersIcon} tone="green" />
      </div>
      <Card title={`Latest ${Math.min(stats.latest.length, 200)}`} icon={UsersIcon}>
        {stats.latest.length === 0 ? (
          <p className="text-sm text-muted">Nobody yet – share the landing page.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted uppercase">
                <tr>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Signed up (UTC)</th>
                  <th className="py-2 pr-4 font-medium">Form</th>
                  <th className="py-2 font-medium">Language</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stats.latest.map((w) => (
                  <tr key={w.email}>
                    <td className="py-2 pr-4 font-medium text-ink">{w.email}</td>
                    <td className="py-2 pr-4 text-muted tabular-nums">{w.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                    <td className="py-2 pr-4 text-muted">{w.source}</td>
                    <td className="py-2 text-muted">{w.locale ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
