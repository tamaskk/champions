import type { LineInsight, PlayerRole, SquadInsight } from '@champion/shared';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';

const LINE_NAME: Record<PlayerRole, string> = { GK: 'Goalkeeper', DF: 'Defence', MF: 'Midfield', FW: 'Attack' };
/** Below this a line made no real difference (±3 % goals). */
const NOTABLE = 0.03;

const ordinal = (n: number) => {
  const s =
    n % 100 >= 11 && n % 100 <= 13 ? 'th' : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th');
  return `${n}${s}`;
};
const attacking = (role: PlayerRole) => role === 'MF' || role === 'FW';
const pct = (x: number) => `${x > 0 ? '+' : '−'}${Math.round(Math.abs(x) * 100)}%`;

export type InsightStats = {
  goalsFor: number;
  goalsAgainst: number;
  matches: number;
  /** League only: your rank for goals scored (1 = most) and conceded (1 = fewest), of `teams`. */
  ranks?: { scored: number; conceded: number; teams: number };
  /** League only: substitutes on your bench (0 = starters play tired when they need a rest). */
  bench?: number;
  /** Your best player of the tournament (goals + assists). */
  star?: { name: string; goals: number; assists: number } | null;
};

function lineNote(line: LineInsight, stats: InsightStats, good: boolean): string {
  const vs = `${Math.round(line.yours)} vs ${Math.round(line.field)} for the average opponent`;
  const outcome = attacking(line.role)
    ? stats.ranks
      ? `${stats.goalsFor} goals, the ${ordinal(stats.ranks.scored)} most`
      : `${stats.goalsFor} goals in ${stats.matches} matches`
    : stats.ranks
      ? `${stats.goalsAgainst} conceded, the ${ordinal(stats.ranks.conceded)} fewest`
      : `${stats.goalsAgainst} conceded in ${stats.matches} matches`;
  // effect > 0 = more goals scored (attack) or fewer conceded (defence).
  const change = attacking(line.role) ? `${pct(line.effect)} goals` : `${pct(-line.effect)} goals against`;
  return `${LINE_NAME[line.role]} ${good ? 'carried you' : 'cost you'}: ${vs} (${change}) – ${outcome}.`;
}

/** The "why" under a result: which line carried the squad, which one cost it, chemistry, bench, star. */
export function ResultInsight({ insight, stats }: { insight: SquadInsight; stats: InsightStats }) {
  const notes: { icon: 'trending_up' | 'trending_down' | 'check_circle' | 'hub' | 'groups' | 'star'; text: string; color: string }[] =
    [];
  if (insight.best.effect >= NOTABLE)
    notes.push({ icon: 'trending_up', text: lineNote(insight.best, stats, true), color: C.green });
  if (insight.worst.effect <= -NOTABLE)
    notes.push({ icon: 'trending_down', text: lineNote(insight.worst, stats, false), color: C.red });
  else
    notes.push({
      icon: 'check_circle',
      text: `No weak line: your weakest, ${LINE_NAME[insight.worst.role].toLowerCase()}, was ${Math.round(insight.worst.yours)} against ${Math.round(insight.worst.field)} on average.`,
      color: C.green,
    });
  if (Math.abs(insight.chemistry) >= 0.02)
    notes.push({
      icon: 'hub',
      text:
        insight.chemistry > 0
          ? `Chemistry lifted every rating by ${pct(insight.chemistry)}.`
          : `Low chemistry took ${pct(insight.chemistry)} off every rating – link club-mates and compatriots next time.`,
      color: insight.chemistry > 0 ? C.green : C.gold,
    });
  if (stats.bench === 0)
    notes.push({
      icon: 'groups',
      text: 'No bench: starters who needed a rest played tired (−10%) instead of being rotated.',
      color: C.gold,
    });
  if (stats.star && stats.star.goals + stats.star.assists > 0)
    notes.push({
      icon: 'star',
      text: `Star man: ${stats.star.name} – ${stats.star.goals} goal${stats.star.goals === 1 ? '' : 's'}, ${stats.star.assists} assist${stats.star.assists === 1 ? '' : 's'}.`,
      color: C.gold,
    });

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Icon name="insights" size={16} color={C.blueLight} />
        <Txt v="capUpper" color={C.blueLight}>
          WHY THIS RESULT
        </Txt>
      </View>
      {notes.map((n, i) => (
        <View key={i} style={styles.note}>
          <Icon name={n.icon} size={15} color={n.color} style={{ marginTop: 2 }} />
          <Txt v="body" color={C.text} style={styles.flex}>
            {n.text}
          </Txt>
        </View>
      ))}
      <View style={styles.lines}>
        {insight.lines.map((l) => (
          <View key={l.role} style={styles.line}>
            <Txt v="cap" color={C.textMuted}>
              {l.role}
            </Txt>
            <Txt v="h14" color={l.effect >= NOTABLE ? C.green : l.effect <= -NOTABLE ? C.red : C.text}>
              {Math.round(l.yours)}
            </Txt>
            <Txt v="capBody" color={C.textDim}>
              avg {Math.round(l.field)}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 8,
    padding: 12,
    borderRadius: R.md,
    backgroundColor: alpha(C.blue, 0.08),
    borderWidth: 1,
    borderColor: alpha(C.blue, 0.3),
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  flex: { flex: 1 },
  lines: { flexDirection: 'row', gap: 6, marginTop: 2 },
  line: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: R.sm,
    backgroundColor: alpha(C.surface3, 0.6),
  },
});
