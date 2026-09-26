import { useSyncExternalStore } from 'react';

import {
  FIRST_WIN_XP_MULTIPLIER,
  MAX_LEVEL,
  STORE_CRESTS,
  STORE_KITS,
  seasonOf,
  streakMultiplier,
} from '@champion/shared';

import type { IconName } from '@/design/icon';

import { addNotice } from './notifications';
import { loadJSON, saveJSON } from './storage';

/**
 * Long-term progress on this device: XP and level, achievements, lifetime stats and the cosmetic
 * rewards (kit colour, crest). Game modules report events here (a finished draft, a match, a
 * season, a cup, a legend, a daily challenge); everything is saved on the device at once.
 */

// ---------------------------------------------------------------------------------------------
// XP and levels

export const XP = {
  draft: 100,
  match: { win: 150, draw: 60, loss: 25 },
  seasonPerPoint: 5,
  title: 500,
  unbeaten: 400,
  perfect: 1200,
  cup: { champion: 800, top: 300, mid: 150, out: 50 },
  legend: { win: 400, loss: 50 },
  daily: { win: 300, loss: 60 },
  achievement: 250,
} as const;

/** XP needed to go from `level` to `level + 1`: 500, 750, 1000, … */
export const xpForNextLevel = (level: number) => 250 + level * 250;

export function levelFor(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let rest = xp;
  while (rest >= xpForNextLevel(level)) {
    rest -= xpForNextLevel(level);
    level++;
  }
  return { level, into: rest, needed: xpForNextLevel(level) };
}

// ---------------------------------------------------------------------------------------------
// Cosmetic rewards, unlocked by level

export type Kit = { id: string; name: string; color: string; level: number };
export const KITS: Kit[] = [
  { id: 'classic', name: 'Classic', color: '#2e3540', level: 1 },
  { id: 'royal', name: 'Royal Blue', color: '#1f4fa8', level: 2 },
  { id: 'crimson', name: 'Crimson', color: '#9b1c2c', level: 3 },
  { id: 'forest', name: 'Forest', color: '#1e6b3a', level: 5 },
  { id: 'sky', name: 'Sky', color: '#2b7fb8', level: 7 },
  { id: 'claret', name: 'Claret', color: '#6b1f3f', level: 9 },
  { id: 'gold', name: 'Gold', color: '#8a6a00', level: 12 },
  { id: 'midnight', name: 'Midnight', color: '#101a3a', level: 15 },
];

export type Crest = { id: string; name: string; icon: IconName; level: number };
export const CRESTS: Crest[] = [
  { id: 'shield', name: 'Shield', icon: 'shield', level: 1 },
  { id: 'star', name: 'Star', icon: 'star', level: 4 },
  { id: 'fire', name: 'Fire', icon: 'local_fire_department', level: 6 },
  { id: 'bolt', name: 'Bolt', icon: 'bolt', level: 8 },
  { id: 'crown', name: 'Crown', icon: 'crown', level: 11 },
  { id: 'laurel', name: 'Laurel', icon: 'workspace_premium', level: 14 },
];

// ---------------------------------------------------------------------------------------------
// Achievements

export type DraftEvent = {
  formation: string;
  overall: number;
  chemistry: number;
  /** Bonus ids from the chemistry result, e.g. 'dynasty'. */
  bonuses: string[];
  players: { name: string; league: string; club: string; decade: string }[];
};

export type Stats = {
  drafts: number;
  matches: { won: number; drawn: number; lost: number };
  seasons: { played: number; titles: number; unbeaten: number; perfect: number };
  cups: { played: number; won: number };
  legends: { played: number; won: number; beatenIds: string[] };
  daily: { played: number; won: number };
  formations: Record<string, number>;
  /** Times each player was drafted (by name). */
  players: Record<string, number>;
  peakOverall: number;
  maxChemistry: number;
};

type AchievementDef = {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  /** Checked after every event, against the updated stats and the event that triggered it. */
  test: (s: Stats, event: ProgressEvent) => boolean;
};

export type ProgressEvent =
  | { kind: 'draft'; draft: DraftEvent }
  | { kind: 'match'; outcome: 'win' | 'draw' | 'loss' }
  | { kind: 'season'; won: number; drawn: number; lost: number; points: number; position: number }
  | { kind: 'cup'; outcome: 'champion' | 'top' | 'mid' | 'out' }
  | { kind: 'legend'; won: boolean }
  /** First win against a legend: remembered for the collection achievements, no XP of its own. */
  | { kind: 'legend-beaten'; legendId: string }
  | { kind: 'daily'; won: boolean; /** Won dailies in a row, today included. */ streak?: number };

const clubCounts = (d: DraftEvent) => {
  const counts = new Map<string, number>();
  for (const p of d.players) counts.set(`${p.league}|${p.club}`, (counts.get(`${p.league}|${p.club}`) ?? 0) + 1);
  return Math.max(0, ...counts.values());
};

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-draft',
    title: 'Kick-off',
    description: 'Finish your first draft',
    icon: 'sports_soccer',
    test: (s) => s.drafts >= 1,
  },
  {
    id: 'drafts-25',
    title: 'Scout',
    description: 'Finish 25 drafts',
    icon: 'search',
    test: (s) => s.drafts >= 25,
  },
  {
    id: 'first-win',
    title: 'Off the mark',
    description: 'Win a match',
    icon: 'check_circle',
    test: (s) => s.matches.won >= 1,
  },
  {
    id: 'title',
    title: 'Champions',
    description: 'Win a league season',
    icon: 'emoji_events',
    test: (s) => s.seasons.titles >= 1,
  },
  {
    id: 'unbeaten',
    title: 'Invincibles',
    description: 'Go a whole league season unbeaten',
    icon: 'shield',
    test: (s) => s.seasons.unbeaten >= 1,
  },
  {
    id: 'perfect',
    title: 'First 38-0',
    description: 'Win every match of a league season',
    icon: 'crown',
    test: (s) => s.seasons.perfect >= 1,
  },
  {
    id: 'cup',
    title: 'Big-ear cup',
    description: 'Win a cup',
    icon: 'workspace_premium',
    test: (s) => s.cups.won >= 1,
  },
  {
    id: 'chemistry-100',
    title: 'Perfect harmony',
    description: 'Draft an XI with 100 chemistry',
    icon: 'hub',
    test: (s) => s.maxChemistry >= 100,
  },
  {
    id: 'dynasty-5',
    title: 'Dynasty',
    description: 'Draft 5 players from the same club',
    icon: 'groups',
    test: (_, e) => e.kind === 'draft' && clubCounts(e.draft) >= 5,
  },
  {
    id: 'sixties-only',
    title: 'Swinging Sixties',
    description: 'Draft an XI made only of 1960s players',
    icon: 'hourglass_empty',
    test: (_, e) =>
      e.kind === 'draft' && e.draft.players.length >= 11 && e.draft.players.every((p) => p.decade === '60'),
  },
  {
    id: 'beat-milan-88',
    title: 'Sacchi slayer',
    description: "Beat Milan 1988/89",
    icon: 'swords',
    test: (s) => s.legends.beatenIds.includes('milan-1988'),
  },
  {
    id: 'legends-5',
    title: 'Legend hunter',
    description: 'Beat 5 different legendary teams',
    icon: 'military_tech',
    test: (s) => s.legends.beatenIds.length >= 5,
  },
  {
    id: 'daily-7',
    title: 'Every day',
    description: 'Win 7 daily challenges',
    icon: 'calendar_month',
    test: (s) => s.daily.won >= 7,
  },
  {
    id: 'overall-90',
    title: 'World class',
    description: 'Draft an XI rated 90 overall',
    icon: 'stars',
    test: (s) => s.peakOverall >= 90,
  },
];

// ---------------------------------------------------------------------------------------------
// Store

export type Toast = {
  id: number;
  icon: IconName;
  title: string;
  detail: string;
  tone: 'xp' | 'achievement' | 'level' | 'coin';
};

export type Progress = {
  version: 1;
  xp: number;
  stats: Stats;
  /** Achievement id → ISO date unlocked. */
  achievements: Record<string, string>;
  /** Kit (primary colour) id, from KITS. */
  kit: string;
  /** Crest emblem id, from CRESTS. */
  crest: string;
  /** Your club: its name replaces "Your XI"; the crest is drawn from shape, colours and emblem. */
  team: TeamIdentity;
  /** Season Pass progress: XP earned in the current calendar month. */
  season: { id: string; xp: number };
  /** Times the player went back from MAX_LEVEL to level 1. */
  prestige: number;
  /** UTC date of the last won match (the day's first win earns double XP). */
  firstWinDate: string | null;
  /** Equipped cosmetics beyond kit and crest (ids of owned store items, or null). */
  equipped: { frame: string | null; pitch: string | null; reel: string | null; celebration: string | null };
  /** Draft settings (the tune button on the draft screen). */
  /** dramaticReels: full-length spins (fast ones are the default since "Fast spins" was replaced). */
  settings: { dramaticReels: boolean; showLinks: boolean };
};

export const CREST_SHAPES = ['shield', 'circle', 'diamond', 'square'] as const;
export type CrestShape = (typeof CREST_SHAPES)[number];

/** Second crest colour (trim), free to choose. */
export const TRIMS = ['#ffc72c', '#ffffff', '#6ddc9e', '#a4c9ff', '#ffb4ab', '#0d141e'] as const;

export type TeamIdentity = {
  name: string;
  shape: CrestShape;
  trim: string;
  /** Show the club's initials instead of the emblem. */
  initials: boolean;
};

export const DEFAULT_TEAM_NAME = 'Your XI';
export const MAX_TEAM_NAME = 24;

const EMPTY: Progress = {
  version: 1,
  xp: 0,
  stats: {
    drafts: 0,
    matches: { won: 0, drawn: 0, lost: 0 },
    seasons: { played: 0, titles: 0, unbeaten: 0, perfect: 0 },
    cups: { played: 0, won: 0 },
    legends: { played: 0, won: 0, beatenIds: [] },
    daily: { played: 0, won: 0 },
    formations: {},
    players: {},
    peakOverall: 0,
    maxChemistry: 0,
  },
  achievements: {},
  kit: 'classic',
  crest: 'shield',
  team: { name: DEFAULT_TEAM_NAME, shape: 'shield', trim: TRIMS[0], initials: false },
  season: { id: seasonOf(), xp: 0 },
  prestige: 0,
  firstWinDate: null,
  equipped: { frame: null, pitch: null, reel: null, celebration: null },
  settings: { dramaticReels: false, showLinks: true },
};

function load(): Progress {
  const saved = loadJSON<Progress>('progress');
  // Merge onto the empty shape so fields added in later versions get defaults.
  return saved
    ? {
        ...EMPTY,
        ...saved,
        stats: { ...EMPTY.stats, ...saved.stats },
        team: { ...EMPTY.team, ...saved.team },
        equipped: { ...EMPTY.equipped, ...saved.equipped },
        // The old "fastReels" flag is dropped: fast spins are now the default for everyone.
        settings: { dramaticReels: saved.settings?.dramaticReels ?? false, showLinks: saved.settings?.showLinks ?? true },
      }
    : EMPTY;
}

let progress: Progress = load();
let toasts: Toast[] = [];
let toastId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, () => progress);
}

/** Pending "+XP" / "Achievement unlocked" / "Level up" notices, oldest first. */
export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, () => toasts);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function xpFor(e: ProgressEvent): { xp: number; label: string } {
  switch (e.kind) {
    case 'draft':
      return { xp: XP.draft, label: 'Draft complete' };
    case 'match':
      return { xp: XP.match[e.outcome], label: `Match ${e.outcome}` };
    case 'season': {
      let xp = e.points * XP.seasonPerPoint;
      if (e.position === 1) xp += XP.title;
      if (e.lost === 0) xp += XP.unbeaten;
      if (e.lost === 0 && e.drawn === 0) xp += XP.perfect;
      return { xp, label: `Season ${e.won}-${e.drawn}-${e.lost}` };
    }
    case 'cup':
      return { xp: XP.cup[e.outcome], label: e.outcome === 'champion' ? 'Cup winner' : 'Cup run' };
    case 'legend':
      return { xp: e.won ? XP.legend.win : XP.legend.loss, label: e.won ? 'Legend beaten' : 'Legend match' };
    case 'legend-beaten':
      return { xp: 0, label: '' };
    case 'daily':
      return { xp: e.won ? XP.daily.win : XP.daily.loss, label: e.won ? 'Daily won' : 'Daily played' };
  }
}

function applyStats(s: Stats, e: ProgressEvent): Stats {
  switch (e.kind) {
    case 'draft': {
      const players = { ...s.players };
      for (const p of e.draft.players) players[p.name] = (players[p.name] ?? 0) + 1;
      return {
        ...s,
        drafts: s.drafts + 1,
        formations: { ...s.formations, [e.draft.formation]: (s.formations[e.draft.formation] ?? 0) + 1 },
        players,
        peakOverall: Math.max(s.peakOverall, e.draft.overall),
        maxChemistry: Math.max(s.maxChemistry, e.draft.chemistry),
      };
    }
    case 'match': {
      const key = e.outcome === 'win' ? 'won' : e.outcome === 'draw' ? 'drawn' : 'lost';
      return { ...s, matches: { ...s.matches, [key]: s.matches[key] + 1 } };
    }
    case 'season':
      return {
        ...s,
        seasons: {
          played: s.seasons.played + 1,
          titles: s.seasons.titles + (e.position === 1 ? 1 : 0),
          unbeaten: s.seasons.unbeaten + (e.lost === 0 ? 1 : 0),
          perfect: s.seasons.perfect + (e.lost === 0 && e.drawn === 0 ? 1 : 0),
        },
      };
    case 'cup':
      return { ...s, cups: { played: s.cups.played + 1, won: s.cups.won + (e.outcome === 'champion' ? 1 : 0) } };
    case 'legend':
      return { ...s, legends: { ...s.legends, played: s.legends.played + 1, won: s.legends.won + (e.won ? 1 : 0) } };
    case 'legend-beaten':
      return s.legends.beatenIds.includes(e.legendId)
        ? s
        : { ...s, legends: { ...s.legends, beatenIds: [...s.legends.beatenIds, e.legendId] } };
    case 'daily':
      return { ...s, daily: { played: s.daily.played + 1, won: s.daily.won + (e.won ? 1 : 0) } };
  }
}

/** Records one game event: stats, XP, newly unlocked achievements, level-ups, notices. */
export function recordProgress(e: ProgressEvent) {
  const before = levelFor(progress.xp).level;
  const stats = applyStats(progress.stats, e);
  const gained = xpFor(e);
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // The day's first won match: double XP. Daily Challenge streaks multiply the daily's XP.
  let firstWinDate = progress.firstWinDate;
  if (e.kind === 'match' && e.outcome === 'win' && firstWinDate !== today) {
    gained.xp *= FIRST_WIN_XP_MULTIPLIER;
    gained.label = `${gained.label} · first win today ×${FIRST_WIN_XP_MULTIPLIER}`;
    firstWinDate = today;
  }
  if (e.kind === 'daily' && e.won && e.streak && streakMultiplier(e.streak) > 1) {
    gained.xp = Math.round(gained.xp * streakMultiplier(e.streak));
    gained.label = `${gained.label} · ${e.streak}-day streak ×${streakMultiplier(e.streak)}`;
  }

  const unlocked = ACHIEVEMENTS.filter((a) => !progress.achievements[a.id] && a.test(stats, e));
  const achievements = { ...progress.achievements };
  for (const a of unlocked) achievements[a.id] = now;
  const earned = gained.xp + unlocked.length * XP.achievement;
  const xp = progress.xp + earned;
  // Season Pass XP starts again every calendar month.
  const seasonId = seasonOf();
  const season = { id: seasonId, xp: (progress.season.id === seasonId ? progress.season.xp : 0) + earned };

  progress = { ...progress, xp, stats, achievements, season, firstWinDate };
  saveJSON('progress', progress);

  const notices: Toast[] = [];
  if (gained.xp > 0) {
    notices.push({ id: toastId++, icon: 'bolt', title: `+${gained.xp.toLocaleString('en-US')} XP`, detail: gained.label, tone: 'xp' });
  }
  for (const a of unlocked) {
    notices.push({ id: toastId++, icon: a.icon, title: 'Achievement unlocked', detail: `${a.title} · +${XP.achievement} XP`, tone: 'achievement' });
  }
  const after = levelFor(xp).level;
  if (after > before) {
    const rewards = [...KITS, ...CRESTS].filter((r) => r.level > before && r.level <= after).map((r) => r.name);
    notices.push({
      id: toastId++,
      icon: 'military_tech',
      title: `Level ${after}`,
      detail: rewards.length ? `Unlocked: ${rewards.join(', ')}` : 'Level up!',
      tone: 'level',
    });
  }
  toasts = [...toasts, ...notices];
  emit();
  for (const n of notices) keepInInbox(n);

  const levels = Array.from({ length: Math.max(0, after - before) }, (_, i) => before + 1 + i);
  if (levels.length || unlocked.length) {
    rewardListeners.forEach((l) => l({ levels, achievements: unlocked.map((a) => a.id) }));
  }
}

// Coins for level-ups and achievements are paid by the server wallet (game/wallet.ts listens).
type RewardEvent = { levels: number[]; achievements: string[] };
const rewardListeners = new Set<(e: RewardEvent) => void>();
export function onRewards(listener: (e: RewardEvent) => void) {
  rewardListeners.add(listener);
  return () => rewardListeners.delete(listener);
}

/** Adds a notice (e.g. "+50 coins") to the queue shown at the top of the screen. */
export function pushToast(t: Omit<Toast, 'id'>) {
  toasts = [...toasts, { ...t, id: toastId++ }];
  emit();
  keepInInbox(t);
}

/** Achievements, level-ups and coins also go to the bell's inbox (XP-only notices don't). */
function keepInInbox(t: Omit<Toast, 'id'>) {
  // XP ticks would bury the rest; 'info' notices are momentary feedback (e.g. "Not enough coins").
  if (t.tone === 'xp' || t.icon === 'info') return;
  addNotice({ icon: t.icon, title: t.title, detail: t.detail, tone: t.tone });
}

/** Prestige: from MAX_LEVEL back to level 1; the count (and the prestige frame) stay forever. */
export function doPrestige(): boolean {
  if (levelFor(progress.xp).level < MAX_LEVEL) return false;
  progress = { ...progress, xp: 0, prestige: progress.prestige + 1 };
  saveJSON('progress', progress);
  pushToast({ icon: 'workspace_premium', title: `Prestige ${progress.prestige}`, detail: 'Back to level 1 · Prestige frame unlocked', tone: 'level' });
  return true;
}

/** Equips a frame / pitch skin / reel skin (an owned store item id) or removes it (null). */
export function equipCosmetic(slot: 'frame' | 'pitch' | 'reel' | 'celebration', id: string | null) {
  progress = { ...progress, equipped: { ...progress.equipped, [slot]: id } };
  saveJSON('progress', progress);
  emit();
}

/** Picks a kit or crest: unlocked by level, or bought in the store (`owned`, from the wallet). */
export function equip(kind: 'kit' | 'crest', id: string, owned: readonly string[] = []) {
  const level = levelFor(progress.xp).level;
  const item = (kind === 'kit' ? KITS : CRESTS).find((r) => r.id === id);
  if (!(item ? item.level <= level : owned.includes(id))) return;
  progress = { ...progress, [kind]: id };
  saveJSON('progress', progress);
  emit();
}

export const kitColor = (p: Progress) =>
  (KITS.find((k) => k.id === p.kit) ?? STORE_KITS.find((k) => k.id === p.kit) ?? KITS[0]).color;

/** Crest emblem icon: a level crest or a store crest. */
export const crestIcon = (p: Progress): IconName =>
  ((CRESTS.find((c) => c.id === p.crest) ?? STORE_CRESTS.find((c) => c.id === p.crest))?.icon ?? 'shield') as IconName;

/** Level shown (capped); XP beyond MAX_LEVEL waits for a prestige. */
export const displayLevel = (xp: number) => Math.min(MAX_LEVEL, levelFor(xp).level);

function save(next: Progress) {
  progress = next;
  saveJSON('progress', progress);
  emit();
}

/** Your club's name (shown instead of "Your XI" in matches and tournaments). */
export const teamName = () => progress.team.name.trim() || DEFAULT_TEAM_NAME;

export function setTeam(patch: Partial<TeamIdentity>) {
  const team = { ...progress.team, ...patch };
  if (patch.name !== undefined) team.name = patch.name.slice(0, MAX_TEAM_NAME);
  save({ ...progress, team });
}

const pickOne = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/** Crest generator: a random shape, trim, unlocked kit colour and unlocked emblem (or initials). */
export function generateCrest() {
  const level = levelFor(progress.xp).level;
  save({
    ...progress,
    kit: pickOne(KITS.filter((k) => k.level <= level)).id,
    crest: pickOne(CRESTS.filter((c) => c.level <= level)).id,
    team: {
      ...progress.team,
      shape: pickOne(CREST_SHAPES),
      trim: pickOne(TRIMS),
      initials: Math.random() < 0.4,
    },
  });
}

/** "Real Madrid" → "RM", "Arsenal" → "ARS". */
export function teamInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.slice(0, 3).map((w) => w[0]!.toUpperCase()).join('');
  return (words[0] ?? 'XI').slice(0, 3).toUpperCase();
}

export function setSetting<K extends keyof Progress['settings']>(key: K, value: Progress['settings'][K]) {
  progress = { ...progress, settings: { ...progress.settings, [key]: value } };
  saveJSON('progress', progress);
  emit();
}
