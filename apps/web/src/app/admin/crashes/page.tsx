import { connection } from "next/server";

import { AlertIcon } from "@/components/admin/icons";
import { Badge, Card, DbError, PageHeader, StatCard } from "@/components/admin/ui";
import { crashGroups } from "@/server/analytics-data";

import { DaysFilter, daysParam } from "../days-filter";

/** JavaScript errors reported by the app, grouped by message. */
export default async function CrashesPage({ searchParams }: PageProps<"/admin/crashes">) {
  await connection();
  const days = daysParam((await searchParams).days);
  let groups: Awaited<ReturnType<typeof crashGroups>>;
  try {
    groups = await crashGroups(days);
  } catch (error) {
    return (
      <>
        <PageHeader title="Crashes" />
        <DbError error={error} />
      </>
    );
  }
  const total = groups.reduce((n, g) => n + g.count, 0);
  const fatal = groups.reduce((n, g) => n + g.fatal, 0);
  return (
    <>
      <PageHeader title="Crashes">
        <DaysFilter path="/admin/crashes" days={days} />
      </PageHeader>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Reports" value={total} icon={AlertIcon} tone="amber" />
        <StatCard label="Fatal (app restarted)" value={fatal} icon={AlertIcon} tone="rose" />
        <StatCard label="Distinct errors" value={groups.length} icon={AlertIcon} tone="indigo" />
      </div>
      <Card title="Errors, newest first" icon={AlertIcon}>
        {groups.length === 0 ? (
          <p className="text-sm text-muted">No crashes reported in this period.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {groups.map((g) => (
              <li key={g.message} className="py-3">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                    {g.fatal > 0 && <Badge tone="rose">fatal ×{g.fatal}</Badge>}
                    <span className="font-medium break-all text-ink">{g.message}</span>
                    <span className="ml-auto text-xs text-muted tabular-nums">
                      {g.count}× · {g.installs} installs · last {g.last.toISOString().slice(0, 16).replace("T", " ")}
                    </span>
                  </summary>
                  <p className="mt-2 text-xs text-muted">
                    {g.platforms || "–"} · versions {g.versions || "–"}
                  </p>
                  {g.stack && <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-canvas p-3 text-[11px] leading-relaxed">{g.stack}</pre>}
                  {g.where && (
                    <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-canvas p-3 text-[11px] leading-relaxed">{g.where}</pre>
                  )}
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
