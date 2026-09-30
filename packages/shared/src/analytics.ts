/**
 * Own product analytics (no third-party SDK): the app sends anonymous events to POST /api/events,
 * the admin shows the funnel. An event carries a random install id (not the account), the event
 * name and at most a few short, whitelisted properties – never names, emails or free text.
 */

/** The funnel, in order. */
export const FUNNEL_EVENTS = ['app_open', 'draft_start', 'draft_done', 'tournament_done', 'share'] as const;

export type AnalyticsEvent = (typeof FUNNEL_EVENTS)[number];

/** Allowed properties (string values, short). */
export const EVENT_PROPS = ['mode', 'platform', 'version'] as const;
export type EventProps = Partial<Record<(typeof EVENT_PROPS)[number], string>>;

export type TrackedEvent = { event: AnalyticsEvent; at: string; props?: EventProps };

/** POST /api/events */
export type EventsRequest = { install: string; events: TrackedEvent[] };

/** A JavaScript error from the app (POST /api/crashes). */
export type CrashReport = {
  install: string;
  message: string;
  stack?: string;
  /** Screen / component stack, when React gave one. */
  where?: string;
  fatal: boolean;
  platform?: string;
  version?: string;
};

export const ANALYTICS_LIMITS = {
  eventsPerRequest: 50,
  propLength: 40,
  messageLength: 500,
  stackLength: 4000,
  /** Days events and crash reports are kept. */
  keepDays: 180,
} as const;

export const isInstallId = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(x);
