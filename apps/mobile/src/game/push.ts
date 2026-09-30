import { todayKey } from '@champion/shared';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { registerPush } from '@/api/client';

import { loadJSON, saveJSON } from './storage';
import { ensureUser } from './user';

/**
 * Notifications, both off until the player turns them on (Profile, or the offer after a Daily):
 *  - Daily reminder: local, 19:00 device time, only on days whose Daily isn't played yet (at most
 *    one a day). The next week of reminders is rescheduled whenever the app starts or goes to the
 *    background, so a Daily played today cancels today's.
 *  - "Your XI was beaten": sent by the server when someone beats your saved squad in a Challenge or
 *    a head-to-head against it, at most one a day. Needs the Expo push token on the server.
 */

export type PushSettings = {
  dailyReminder: boolean;
  beaten: boolean;
  /** The reminder was offered once (after a Daily); not offered again. */
  offered?: boolean;
};

const REMINDER_HOUR = 19;
const REMINDER_DAYS = 7;
const REMINDER_ID = 'daily-reminder-';
const CHANNEL = 'default';

let settings: PushSettings = loadJSON<PushSettings>('push') ?? { dailyReminder: false, beaten: false };
const listeners = new Set<() => void>();
const update = (patch: Partial<PushSettings>) => {
  settings = { ...settings, ...patch };
  saveJSON('push', settings);
  listeners.forEach((l) => l());
};

export function usePushSettings(): PushSettings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => settings,
  );
}

const supported = Platform.OS !== 'web';

/** Asks for permission if needed; false when the player (or the system) says no. */
async function allowed(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function scheduleReminders() {
  if (!supported) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(REMINDER_ID))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  if (!settings.dailyReminder) return;
  // The Daily store's file (attempts per UTC day), read fresh: it may have changed since.
  const attempts = loadJSON<Record<string, { done: boolean }>>('daily') ?? {};
  const now = new Date();
  for (let d = 0; d < REMINDER_DAYS; d++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, REMINDER_HOUR);
    if (at.getTime() <= now.getTime()) continue;
    // The Daily is per UTC day: the one live at the reminder's moment.
    if (attempts[todayKey(at)]?.done) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `${REMINDER_ID}${d}`,
      content: { title: "Today's Daily is waiting", body: 'Same reels for everyone – spin your XI and keep the streak going.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  }
}

/** Sends this device's push token to the server (null: stop "beaten" pushes). */
async function syncServer() {
  if (!supported) return;
  let token: string | null = null;
  if (settings.beaten) {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  }
  await ensureUser();
  await registerPush({ token, beaten: settings.beaten });
}

/** Turns one kind on or off; turning on asks for permission (false = not allowed). */
export async function setPushSetting(key: 'dailyReminder' | 'beaten', on: boolean): Promise<boolean> {
  if (on && !(await allowed())) return false;
  update({ [key]: on, offered: true });
  try {
    if (key === 'dailyReminder') await scheduleReminders();
    else await syncServer();
  } catch {
    // Simulator / offline: tried again on the next start.
  }
  return true;
}

let started = false;

/** Once per app start: notification display, Android channel, reminders and token refreshed. */
export function startPush() {
  if (started || !supported) return;
  started = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android')
    void Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Game',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  const refresh = () => {
    void scheduleReminders().catch(() => {});
    if (settings.beaten) void syncServer().catch(() => {});
  };
  refresh();
  AppState.addEventListener('change', (state) => {
    if (state === 'background') void scheduleReminders().catch(() => {});
  });
}

/** For screens: whether to offer the Daily reminder (never offered, not on). */
export function useOfferReminder(): boolean {
  const s = usePushSettings();
  return supported && !s.dailyReminder && !s.offered;
}

export function dismissReminderOffer() {
  update({ offered: true });
}
