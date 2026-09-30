import { DAILY_POOL, dailyForDate, dailyRulesLine, todayKey, type DailyChallenge } from "@champion/shared";
import { connection } from "next/server";

import { deleteDailyAction } from "@/app/admin/actions";
import { DeleteButton } from "@/components/admin/delete-button";
import { CalendarIcon, TrashIcon } from "@/components/admin/icons";
import { Badge, Card, DbError, PageHeader } from "@/components/admin/ui";
import { LOCAL_CLAUDE_ENABLED } from "@/server/claude-cli";
import { scheduledDailies } from "@/server/daily-data";

import { DailyEditor } from "./daily-editor";

const DAYS = 14;
const TIER_TONE = { SILVER: "indigo", GOLD: "amber", LEGEND: "rose" } as const;

const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Daily challenges: the next two weeks (scheduled or from the built-in pool), editor, Claude. */
export default async function DailyPage() {
  await connection();
  const today = todayKey();
  let scheduled: DailyChallenge[];
  try {
    scheduled = await scheduledDailies(today);
  } catch (error) {
    return (
      <>
        <PageHeader title="Daily challenges" />
        <DbError error={error} />
      </>
    );
  }
  const upcoming = Array.from({ length: DAYS }, (_, i) => dailyForDate(addDays(today, i), scheduled));
  const later = scheduled.filter((s) => s.date! >= addDays(today, DAYS));
  const firstFree = upcoming.find((d) => !d.scheduled)?.date ?? addDays(today, DAYS);

  return (
    <>
      <PageHeader title="Daily challenges" />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card title="Next 14 days" icon={CalendarIcon}>
          <div className="flex flex-col divide-y divide-line">
            {upcoming.map(({ date, challenge, scheduled: fixed }) => (
              <div key={date} className="flex items-start gap-4 py-3">
                <div className="w-24 shrink-0 text-sm">
                  <p className="font-semibold text-ink tabular-nums">{date.slice(5)}</p>
                  <p className="text-xs text-muted">
                    {date === today ? "Today" : new Date(`${date}T00:00:00Z`).toUTCString().slice(0, 3)}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                    {challenge.title}
                    <Badge tone={TIER_TONE[challenge.tier]}>{challenge.tier}</Badge>
                    {fixed ? <Badge tone="green">scheduled</Badge> : <span className="text-xs text-muted">pool</span>}
                  </p>
                  <p className="text-sm text-muted">{challenge.description}</p>
                  <p className="mt-1 font-mono text-xs text-muted">{dailyRulesLine(challenge)}</p>
                </div>
                {fixed && (
                  <form action={deleteDailyAction}>
                    <input type="hidden" name="date" value={date} />
                    <DeleteButton
                      label={`Remove the ${date} challenge`}
                      title="Back to the pool"
                      confirmText={`Remove "${challenge.title}" from ${date}? That day goes back to the pool.`}
                    >
                      <TrashIcon />
                    </DeleteButton>
                  </form>
                )}
              </div>
            ))}
          </div>
          {later.length > 0 && (
            <p className="mt-4 text-sm text-muted">
              {later.length} more scheduled after that (last: {later.at(-1)!.date}).
            </p>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <DailyEditor defaultDate={firstFree} localClaude={LOCAL_CLAUDE_ENABLED} />
          <Card title={`Built-in pool (${DAILY_POOL.length})`}>
            <p className="mb-3 text-sm text-muted">
              Days without a scheduled challenge take the pool in turn – everyone gets the same one and the same reel
              draws.
            </p>
            <details>
              <summary className="cursor-pointer text-sm font-medium text-ink">Show all</summary>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {DAILY_POOL.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium text-ink">{c.title}</span>{" "}
                    <Badge tone={TIER_TONE[c.tier]}>{c.tier}</Badge>
                    <span className="block font-mono text-xs text-muted">{dailyRulesLine(c)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        </div>
      </div>
    </>
  );
}
