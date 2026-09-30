import "server-only";

import {
  ANALYTICS_LIMITS,
  EVENT_PROPS,
  FUNNEL_EVENTS,
  isInstallId,
  type AnalyticsEvent,
  type CrashReport,
  type EventsRequest,
} from "@champion/shared";

import { crashes, events, type EventDoc } from "./db";
import { BadRequest } from "./leaderboard-data";

// Own analytics: anonymous events (random install id, event name, a few whitelisted props) and
// JavaScript crash reports from the app. Both expire after ANALYTICS_LIMITS.keepDays.

const DAY_MS = 86_400_000;
const isEvent = (x: unknown): x is AnalyticsEvent => FUNNEL_EVENTS.includes(x as AnalyticsEvent);
const short = (x: unknown, max: number) => (typeof x === "string" && x ? x.slice(0, max) : null);

export async function recordEvents(body: EventsRequest | null): Promise<{ ok: true; stored: number }> {
  if (!body || !isInstallId(body.install) || !Array.isArray(body.events)) throw new BadRequest("events");
  const now = Date.now();
  const docs: EventDoc[] = [];
  for (const e of body.events.slice(0, ANALYTICS_LIMITS.eventsPerRequest)) {
    if (!e || !isEvent(e.event)) continue;
    // Device clocks lie: anything in the future or older than a week counts as now.
    const sent = Date.parse(e.at);
    const at = new Date(Number.isFinite(sent) && sent <= now && sent > now - 7 * DAY_MS ? sent : now);
    const props: Record<string, string> = {};
    for (const key of EVENT_PROPS) {
      const value = short(e.props?.[key], ANALYTICS_LIMITS.propLength);
      if (value) props[key] = value;
    }
    docs.push({ install: body.install, event: e.event, props, at, day: at.toISOString().slice(0, 10), receivedAt: new Date(now) });
  }
  if (docs.length) await (await events()).insertMany(docs, { ordered: false });
  return { ok: true, stored: docs.length };
}

export async function recordCrash(body: CrashReport | null): Promise<{ ok: true }> {
  const message = short(body?.message, ANALYTICS_LIMITS.messageLength);
  if (!body || !isInstallId(body.install) || !message) throw new BadRequest("crash");
  await (await crashes()).insertOne({
    install: body.install,
    message,
    stack: short(body.stack, ANALYTICS_LIMITS.stackLength),
    where: short(body.where, ANALYTICS_LIMITS.stackLength),
    fatal: body.fatal === true,
    platform: short(body.platform, 20),
    version: short(body.version, 20),
    createdAt: new Date(),
  });
  return { ok: true };
}

export type FunnelStep = { event: AnalyticsEvent; installs: number; events: number };

/** Distinct installs per funnel step in the last `days` days, plus daily active installs. */
export async function funnelStats(days: number) {
  const since = new Date(Date.now() - days * DAY_MS);
  const col = await events();
  const [steps, daily, modes] = await Promise.all([
    col
      .aggregate<{ _id: AnalyticsEvent; installs: number; events: number }>([
        { $match: { at: { $gte: since } } },
        { $group: { _id: { event: "$event", install: "$install" }, n: { $sum: 1 } } },
        { $group: { _id: "$_id.event", installs: { $sum: 1 }, events: { $sum: "$n" } } },
      ])
      .toArray(),
    col
      .aggregate<{ _id: string; installs: number }>([
        { $match: { at: { $gte: since }, event: "app_open" } },
        { $group: { _id: { day: "$day", install: "$install" } } },
        { $group: { _id: "$_id.day", installs: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ])
      .toArray(),
    col
      .aggregate<{ _id: string | null; events: number }>([
        { $match: { at: { $gte: since }, event: "tournament_done" } },
        { $group: { _id: "$props.mode", events: { $sum: 1 } } },
        { $sort: { events: -1 } },
      ])
      .toArray(),
  ]);
  const byEvent = new Map(steps.map((s) => [s._id, s]));
  const funnel: FunnelStep[] = FUNNEL_EVENTS.map((event) => ({
    event,
    installs: byEvent.get(event)?.installs ?? 0,
    events: byEvent.get(event)?.events ?? 0,
  }));
  return {
    funnel,
    daily: daily.map((d) => ({ day: d._id, installs: d.installs })),
    modes: modes.map((m) => ({ mode: m._id ?? "–", events: m.events })),
  };
}

/** Crashes of the last `days` days, grouped by message: newest first. */
export async function crashGroups(days: number) {
  const since = new Date(Date.now() - days * DAY_MS);
  return (await crashes())
    .aggregate<{
      _id: string;
      count: number;
      installs: string[];
      fatal: number;
      last: Date;
      stack: string | null;
      where: string | null;
      platforms: (string | null)[];
      versions: (string | null)[];
    }>([
      { $match: { createdAt: { $gte: since } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$message",
          count: { $sum: 1 },
          installs: { $addToSet: "$install" },
          fatal: { $sum: { $cond: ["$fatal", 1, 0] } },
          last: { $first: "$createdAt" },
          stack: { $first: "$stack" },
          where: { $first: "$where" },
          platforms: { $addToSet: "$platform" },
          versions: { $addToSet: "$version" },
        },
      },
      { $sort: { last: -1 } },
      { $limit: 100 },
    ])
    .toArray()
    .then((rows) =>
      rows.map(({ _id, installs, platforms, versions, ...rest }) => ({
        message: _id,
        installs: installs.length,
        platforms: platforms.filter(Boolean).join(", "),
        versions: versions.filter(Boolean).join(", "),
        ...rest,
      })),
    );
}
