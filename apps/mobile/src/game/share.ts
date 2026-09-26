import type { SquadResult } from '@champion/shared';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform, Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

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
        return 'shared';
      }
      await nav?.clipboard?.writeText(message);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  try {
    await Share.share({ message });
    return 'shared';
  } catch {
    return 'failed';
  }
}

/** Screenshot of `view` as a PNG in the share sheet (web: downloaded). */
export async function shareImage(view: RefObject<View | null>, title = 'My Champion XI'): Promise<'shared' | 'failed'> {
  try {
    if (Platform.OS === 'web') {
      const uri = await captureRef(view, { format: 'png', result: 'data-uri' });
      const doc = globalThis.document;
      if (!doc) return 'failed';
      const a = doc.createElement('a');
      a.href = uri;
      a.download = 'champion-xi.png';
      a.click();
      return 'shared';
    }
    const uri = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
    if (!(await Sharing.isAvailableAsync())) return 'failed';
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title, UTI: 'public.png' });
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

/** Emoji summary of a squad, e.g. "⚽ Champion XI … 🟩🟩🟩🟩⬛ … 🏆 Serie A 1994/95 · 1st". */
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
  return [
    `⚽ Champion XI${s.username ? ` · @${s.username}` : ''}`,
    `🧩 ${s.formation} · ⭐ OVR ${Math.round(s.overall)} · 🔗 CHEM ${s.chemistry}`,
    '🟩'.repeat(green) + '⬛'.repeat(5 - green),
    s.names.length ? `👟 ${s.names.slice(0, 5).join(', ')}` : '',
    ...s.results.map((r) => `${OUTCOME_EMOJI[r.outcome]} ${r.title} · ${r.detail}`),
    s.link ? `Can your XI beat mine? ${s.link}` : 'Can your XI beat mine?',
  ]
    .filter(Boolean)
    .join('\n');
}
