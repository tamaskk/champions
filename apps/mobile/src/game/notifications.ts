import { useSyncExternalStore } from 'react';

import type { IconName } from '@/design/icon';

import { loadJSON, saveJSON } from './storage';

/**
 * Notification inbox behind the header bell: achievements, level-ups and coins (the same events
 * that pop up as short toasts), kept on the device so they can be read later. XP-only notices are
 * left out – every match gives some, they would bury the rest.
 */

export type NoticeTone = 'achievement' | 'level' | 'coin' | 'info';

export type Notice = {
  id: string;
  icon: IconName;
  title: string;
  detail: string;
  tone: NoticeTone;
  /** ISO time. */
  at: string;
  read: boolean;
};

const MAX_NOTICES = 50;

let notices: Notice[] = loadJSON<Notice[]>('notifications') ?? [];
const listeners = new Set<() => void>();
const set = (next: Notice[]) => {
  notices = next.slice(0, MAX_NOTICES);
  saveJSON('notifications', notices);
  listeners.forEach((l) => l());
};

export function useNotices(): Notice[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => notices,
  );
}

export function addNotice(n: Omit<Notice, 'id' | 'at' | 'read'>) {
  const now = new Date();
  set([{ ...n, id: `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, at: now.toISOString(), read: false }, ...notices]);
}

export function markAllRead() {
  if (notices.some((n) => !n.read)) set(notices.map((n) => (n.read ? n : { ...n, read: true })));
}

export function clearNotices() {
  set([]);
}

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86_400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
