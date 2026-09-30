import type { SquadResult } from '@champion/shared';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform, Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { track } from '@/game/analytics';

/**
 * Sharing: the system share sheet with text (emoji summaries, links), and a view captured as an
 * image (the squad card).
 */

/** System share sheet with text (web: Web Share API, else the clipboard). */
export async function shareText(message: string): Promise<'shared' | 'copied' | 'failed'> {
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as Navigator | undefined;
    try {
      if (nav?.share) {
        await nav.share({ text: message });
        track('share');
        return 'shared';
      }
      await nav?.clipboard?.writeText(message);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  try {
    const r = await Share.share({ message });
    if (r.action === Share.sharedAction) track('share');
    return 'shared';
  } catch {
    return 'failed';
  }
}

/** Screenshot of `view` as a PNG in the share sheet (web: downloaded). */
export async function shareImage(view: RefObject<View | null>, title = 'My Spinvincible XI'): Promise<'shared' | 'failed'> {
  try {
    if (Platform.OS === 'web') {
      const uri = await captureRef(view, { format: 'png', result: 'data-uri' });
      const doc = globalThis.document;
      if (!doc) return 'failed';
      const a = doc.createElement('a');
      a.href = uri;
      a.download = 'spinvincible-xi.png';
      a.click();
      track('share');
      return 'shared';
    }
    const uri = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
    if (!(await Sharing.isAvailableAsync())) return 'failed';
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title, UTI: 'public.png' });
    track('share');
    return 'shared';
  } catch {
    return 'failed';
  }
}

const OUTCOME_EMOJI: Record<SquadResult['outcome'], string> = {
  champion: '🏆',
  top: '🥈',
  win: '✅',
  draw: '🤝',
  mid: '📊',
  loss: '❌',
  out: '🚪',
};

type Result = Omit<SquadResult, 'at'>;

/** How good an outcome is, for picking the one to headline. */
const OUTCOME_RANK: Record<SquadResult['outcome'], number> = {
  champion: 6,
  top: 5,
  win: 4,
  mid: 3,
  draw: 2,
  loss: 1,
  out: 0,
};
/** Spoiler-free result squares, one per tournament (Wordle-style). */
export const RESULT_SQUARE: Record<SquadResult['outcome'], '🟩' | '🟨' | '🟥'> = {
  champion: '🟩',
  top: '🟩',
  win: '🟩',
  mid: '🟨',
  draw: '🟨',
  loss: '🟥',
  out: '🟥',
};

export type ShareHeadline = {
  /** The big number or phrase: "34-2-2", "CHAMPIONS OF EUROPE", "3–1". */
  big: string;
  /** What it was: "Champions · 108 pts · Premier League 2004/05". */
  sub: string;
  /** The dare under it. */
  dare: string;
  outcome: SquadResult['outcome'];
};

/**
 * The squad's best result as a headline for the share card and the emoji summary. League details
 * look like "1st · 34-2-2 · 108 pts", matches "3–1 (home)", the Daily "3/3 targets".
 */
export function shareHeadline(results: readonly Result[]): ShareHeadline | null {
  const best = [...results].sort(
    (a, b) => OUTCOME_RANK[b.outcome] - OUTCOME_RANK[a.outcome] || Number(b.mode === 'league') - Number(a.mode === 'league'),
  )[0];
  if (!best) return null;
  const dare = (unbeaten = false) =>
    best.outcome === 'champion'
      ? unbeaten
        ? 'Unbeaten champions. Your move.'
        : 'Champions. Beat that.'
      : best.outcome === 'win' || best.outcome === 'top'
        ? 'Can your XI beat mine?'
        : 'Think you can do better? Prove it.';

  if (best.mode === 'league') {
    const m = /^(\d+)(?:st|nd|rd|th) · (\d+)-(\d+)-(\d+) · (\d+) pts$/.exec(best.detail);
    if (m) {
      const [, place, , , lost, pts] = m;
      const unbeaten = lost === '0';
      const label = place === '1' ? (unbeaten ? 'Unbeaten champions' : 'Champions') : `${best.detail.split(' · ')[0]} place`;
      return { big: `${m[2]}-${m[3]}-${m[4]}`, sub: `${label} · ${pts} pts · ${best.title}`, dare: dare(place === '1' && unbeaten), outcome: best.outcome };
    }
  }
  if (best.mode === 'cup') {
    return {
      big: best.outcome === 'champion' ? 'CHAMPIONS OF EUROPE' : best.detail.toUpperCase(),
      sub: best.title,
      dare: dare(),
      outcome: best.outcome,
    };
  }
  const score = /^(\d+)–(\d+)/.exec(best.detail);
  if (score && (best.mode === 'match' || best.mode === 'legend' || best.mode === 'h2h')) {
    const verdict = best.outcome === 'win' ? 'Win' : best.outcome === 'draw' ? 'Draw' : best.outcome === 'loss' ? 'Defeat' : 'Result';
    return { big: `${score[1]}–${score[2]}`, sub: `${verdict} · ${best.title}`, dare: dare(), outcome: best.outcome };
  }
  return { big: best.detail.toUpperCase(), sub: best.title, dare: dare(), outcome: best.outcome };
}

/** Emoji summary of a squad, e.g. "⚽ Spinvincible XI … 🟩🟩🟩🟩⬛ … 🏆 Serie A 1994/95 · 1st". */
export function squadShareText(s: {
  username: string | null;
  formation: string;
  overall: number;
  chemistry: number;
  names: string[];
  results: Omit<SquadResult, 'at'>[];
  link?: string | null;
}): string {
  const green = Math.round(s.chemistry / 20);
  const head = shareHeadline(s.results);
  return [
    `⚽ Spinvincible XI${s.username ? ` · @${s.username}` : ''}`,
    head ? `🏆 ${head.big} · ${head.sub}` : '',
    s.results.length > 1 ? s.results.map((r) => RESULT_SQUARE[r.outcome]).join('') : '',
    `🧩 ${s.formation} · ⭐ OVR ${Math.round(s.overall)} · 🔗 CHEM ${s.chemistry}`,
    '🟩'.repeat(green) + '⬛'.repeat(5 - green),
    s.names.length ? `👟 ${s.names.slice(0, 5).join(', ')}` : '',
    ...s.results.map((r) => `${OUTCOME_EMOJI[r.outcome]} ${r.title} · ${r.detail}`),
    s.link ? `${head?.dare ?? 'Can your XI beat mine?'} ${s.link}` : (head?.dare ?? 'Can your XI beat mine?'),
  ]
    .filter(Boolean)
    .join('\n');
}
