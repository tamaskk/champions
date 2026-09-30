import { ANALYTICS_LIMITS, type AnalyticsEvent, type CrashReport, type EventProps, type TrackedEvent } from '@champion/shared';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

import { sendCrash, sendEvents } from '@/api/client';
import { loadJSON, saveJSON } from '@/game/storage';

/**
 * Own analytics and crash reports (see @champion/shared analytics): a random install id, never the
 * account. Events are batched and sent a few seconds later (or when the app goes to the
 * background); unsent ones wait on the device for the next try. JavaScript errors are sent right
 * away; a fatal one is also kept on disk and sent on the next start, in case the app died first.
 */

const FLUSH_MS = 4000;
const MAX_QUEUED = 200;
const VERSION = Constants.expoConfig?.version ?? 'dev';

let installId: string | null = null;
function install(): string {
  if (installId) return installId;
  const saved = loadJSON<string>('install');
  if (saved) return (installId = saved);
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  installId = Array.from({ length: 32 }, hex).join('');
  saveJSON('install', installId);
  return installId;
}

let queue: TrackedEvent[] = loadJSON<TrackedEvent[]>('events-pending') ?? [];
let timer: ReturnType<typeof setTimeout> | null = null;
let sending = false;

async function flush() {
  timer = null;
  if (sending || queue.length === 0) return;
  sending = true;
  const batch = queue.slice(0, ANALYTICS_LIMITS.eventsPerRequest);
  try {
    await sendEvents({ install: install(), events: batch });
    queue = queue.slice(batch.length);
  } catch {
    // Offline: kept for the next flush.
  } finally {
    sending = false;
    saveJSON('events-pending', queue);
    if (queue.length) schedule();
  }
}

function schedule() {
  timer ??= setTimeout(() => void flush(), FLUSH_MS);
}

/** Records one funnel event (`mode` only for tournaments). */
export function track(event: AnalyticsEvent, props: Omit<EventProps, 'platform' | 'version'> = {}) {
  if (__DEV__) return;
  queue = [...queue, { event, at: new Date().toISOString(), props: { ...props, platform: Platform.OS, version: VERSION } }].slice(
    -MAX_QUEUED,
  );
  saveJSON('events-pending', queue);
  schedule();
}

function report(error: unknown, fatal: boolean, where?: string) {
  if (__DEV__) return;
  const e = error instanceof Error ? error : new Error(String(error));
  const crash: CrashReport = {
    install: install(),
    message: `${e.name}: ${e.message}`.slice(0, ANALYTICS_LIMITS.messageLength),
    stack: e.stack?.slice(0, ANALYTICS_LIMITS.stackLength),
    where: where?.slice(0, ANALYTICS_LIMITS.stackLength),
    fatal,
    platform: Platform.OS,
    version: VERSION,
  };
  if (fatal) saveJSON('crash-pending', crash);
  sendCrash(crash)
    .then(() => fatal && saveJSON('crash-pending', null))
    .catch(() => {});
}

/** A render error caught by an error boundary. */
export const reportRenderError = (error: unknown, componentStack?: string) => report(error, false, componentStack);

let started = false;

/** Once per app start: crash handler, the last fatal crash, pending events, `app_open`. */
export function startAnalytics() {
  if (started) return;
  started = true;
  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    report(error, !!isFatal);
    previous(error, isFatal);
  });
  const lastCrash = loadJSON<CrashReport>('crash-pending');
  if (lastCrash && !__DEV__) {
    sendCrash(lastCrash)
      .then(() => saveJSON('crash-pending', null))
      .catch(() => {});
  }
  AppState.addEventListener('change', (state) => {
    if (state === 'background') void flush();
  });
  track('app_open');
}
