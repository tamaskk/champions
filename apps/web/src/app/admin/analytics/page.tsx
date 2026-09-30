import { connection } from "next/server";

import { GridIcon, UsersIcon } from "@/components/admin/icons";
import { Card, DbError, PageHeader, StatCard } from "@/components/admin/ui";
import { funnelStats } from "@/server/analytics-data";

import { DaysFilter, daysParam } from "../days-filter";

const STEP_LABEL = {
  app_open: "Opened the app",
  draft_start: "Started a draft",
  draft_done: "Completed a squad",
  tournament_done: "Finished a tournament",
  share: "Shared",
} as const;

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

/** Funnel from the app's anonymous events: distinct installs per step. */
export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await connection();
  const days = daysParam((await searchParams).days);
  let stats: Awaited<ReturnType<typeof funnelStats>>;
  try {
    stats = await funnelStats(days);
  } catch (error) {
    return (
      <>
        <PageHeader title="Analytics" />
        <DbError error={error} />
      </>
    );
  }
  const top = stats.funnel[0]!.installs;
  const today = stats.daily[0];
  return (
    <>
      <PageHeader title="Analytics">
        <DaysFilter path="/admin/analytics" days={days} />
      </PageHeader>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Installs active" value={top.toLocaleString("en-US")} icon={UsersIcon} tone="indigo" />
        <StatCard label={`Active on ${today?.day ?? "–"}`} value={(today?.installs ?? 0).toLocaleString("en-US")} icon={UsersIcon} tone="green" />
        <StatCard label="Open → tournament" value={pct(stats.funnel[3]!.installs, top)} icon={GridIcon} tone="amber" />
      </div>
      <Card title="Funnel (distinct installs)" icon={GridIcon} className="mb-6">
        <ul className="flex flex-col gap-3">
          {stats.funnel.map((step, i) => {
            const prev = i ? stats.funnel[i - 1]!.installs : step.installs;
            return (
              <li key={step.event}>
                <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-medium text-ink">
                    {STEP_LABEL[step.event]} <span className="font-mono text-xs text-muted">{step.event}</span>
                  </span>
                  <span className="text-muted tabular-nums">
                    <span className="font-semibold text-ink">{step.installs.toLocaleString("en-US")}</span> ·{" "}
                    {pct(step.installs, top)} of opens{i > 0 && ` · ${pct(step.installs, prev)} of previous`} · {step.events} events
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-canvas">
                  <div className="h-2.5 rounded-full bg-accent" style={{ width: top ? `${(step.installs / top) * 100}%` : 0 }} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-muted">
          Each step counts installs that did it at least once in the period, so a step can be reached without the one before it
          (a squad drafted yesterday, played today).
        </p>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Daily active installs" icon={UsersIcon}>
          {stats.daily.length === 0 ? (
            <p className="text-sm text-muted">No events yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-line">
                {stats.daily.map((d) => (
                  <tr key={d.day}>
                    <td className="py-2 text-muted tabular-nums">{d.day}</td>
                    <td className="py-2 text-right font-medium text-ink tabular-nums">{d.installs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Tournaments by mode" icon={GridIcon}>
          {stats.modes.length === 0 ? (
            <p className="text-sm text-muted">No tournaments yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-line">
                {stats.modes.map((m) => (
                  <tr key={m.mode}>
                    <td className="py-2 text-ink">{m.mode}</td>
                    <td className="py-2 text-right font-medium text-ink tabular-nums">{m.events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
