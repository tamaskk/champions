import { LEAGUE_ADJECTIVES, seasonLabel, type PlayerCareer } from '@champion/shared';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchPlayerCareer } from '@/api/client';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { SHADOW_LG, ratingTint } from '@/design/ui';
import type { DraftPlayer } from '@/mocks/players';

export type CardTarget = { kind: 'xi' | 'bench'; index: number };

export type CardLink = { name: string; label: string; value: number; target: CardTarget };

type Props = {
  player: DraftPlayer;
  /** Where he was drafted from, e.g. { club: 'Milan', decade: '80', league: 'Italian' }. */
  drafted?: { club: string; decade: string; league: string };
  role: string;
  captain?: boolean;
  /** His chemistry links to the other drafted players, strongest first. */
  links: CardLink[];
  onOpen: (target: CardTarget) => void;
  onClose: () => void;
};

type Load = { status: 'loading' } | { status: 'ready'; career: PlayerCareer } | { status: 'none' | 'error' };

const LINK_TINT = [C.textDim, C.textMuted, C.blueLight, C.green, C.gold];

/** Consecutive seasons at the same club, merged: "Milan 1986/87–1996/97 · 312 apps · 27 goals". */
function stints(career: PlayerCareer) {
  const out: { club: string; league: string; from: number; to: number; apps: number; goals: number }[] = [];
  for (const s of career.seasons) {
    const last = out[out.length - 1];
    if (last && last.club === s.club && last.league === s.league && s.season <= last.to + 1) {
      last.to = s.season;
      last.apps += s.appearances ?? 0;
      last.goals += s.goals ?? 0;
    } else {
      out.push({ club: s.club, league: s.league, from: s.season, to: s.season, apps: s.appearances ?? 0, goals: s.goals ?? 0 });
    }
  }
  return out;
}

/** Player card: career by club, rating per season, and links to the rest of your squad. */
export function PlayerCard({ player, drafted, role, captain, links, onOpen, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const real = player.rating !== undefined;
  const [load, setLoad] = useState<Load>(real ? { status: 'loading' } : { status: 'none' });

  useEffect(() => {
    if (!real) return;
    let live = true;
    fetchPlayerCareer(player)
      .then((career) => live && setLoad({ status: 'ready', career }))
      .catch(() => live && setLoad({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [player, real]);

  const career = load.status === 'ready' ? load.career : null;
  const rated = career?.seasons.filter((s) => s.rating !== null) ?? [];
  const totals = career
    ? {
        seasons: career.seasons.length,
        apps: career.seasons.reduce((a, s) => a + (s.appearances ?? 0), 0),
        goals: career.seasons.reduce((a, s) => a + (s.goals ?? 0), 0),
        peak: Math.max(0, ...rated.map((s) => s.rating!)),
      }
    : null;

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={[styles.sheet, { marginTop: insets.top + 24, marginBottom: insets.bottom + 16 }]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.flex}>
              <View style={styles.row6}>
                <Txt v="capUpper" color={C.green}>
                  {role}
                  {player.positions?.length ? ` · ${player.positions.join(' / ')}` : ''}
                </Txt>
                {captain && (
                  <View style={styles.captain}>
                    <Txt v="tinyBold" color={C.onGoldDark}>
                      CAPTAIN
                    </Txt>
                  </View>
                )}
              </View>
              <Txt v="h24">{player.name}</Txt>
              {drafted && (
                <Txt v="body" color={C.textMuted}>
                  Drafted from {drafted.club} · {drafted.league} {drafted.decade}s
                  {career?.nationality ? ` · ${career.nationality}` : ''}
                  {career?.birthYear ? ` · b. ${career.birthYear}` : ''}
                </Txt>
              )}
            </View>
            {player.rating !== undefined && (
              <View style={styles.ratingBox}>
                <Txt v="h28" color={ratingTint(player.rating)}>
                  {Math.round(player.rating)}
                </Txt>
                <Txt v="capUpper" color={C.textMuted}>
                  RTG
                </Txt>
              </View>
            )}
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
              <Icon name="close" size={18} color={C.text} />
            </Pressable>
          </View>

          {load.status === 'loading' && (
            <Txt v="body" color={C.textMuted}>
              Loading career…
            </Txt>
          )}
          {load.status === 'none' && (
            <Txt v="body" color={C.textMuted}>
              Demo player – no career data.
            </Txt>
          )}
          {load.status === 'error' && (
            <Txt v="body" color={C.red}>
              Career not available (offline?).
            </Txt>
          )}

          {career && totals && (
            <>
              <View style={styles.totals}>
                {[
                  ['Seasons', totals.seasons],
                  ['Apps', totals.apps],
                  ['Goals', totals.goals],
                  ['Peak Rtg', Math.round(totals.peak)],
                ].map(([label, value]) => (
                  <View key={label} style={styles.total}>
                    <Txt v="h20">{String(value)}</Txt>
                    <Txt v="capUpper" color={C.textMuted}>
                      {label}
                    </Txt>
                  </View>
                ))}
              </View>

              {/* Rating per season */}
              {rated.length > 0 && (
                <View style={styles.block}>
                  <Txt v="h14">RATING BY SEASON</Txt>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chart} accessibilityLabel="Rating per season chart">
                      {career.seasons.map((s) => (
                        <View key={`${s.league}${s.season}${s.clubSlug}`} style={styles.barCol}>
                          <Txt v="num9" color={s.rating !== null ? ratingTint(s.rating) : C.textDim}>
                            {s.rating !== null ? Math.round(s.rating) : '–'}
                          </Txt>
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.bar,
                                {
                                  height: `${Math.max(3, s.rating ?? 0)}%`,
                                  backgroundColor: s.rating !== null ? ratingTint(s.rating) : C.surface4,
                                },
                              ]}
                            />
                          </View>
                          <Txt v="tiny" color={C.textDim}>
                            {String(s.season).slice(2)}
                          </Txt>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Clubs */}
              <View style={styles.block}>
                <Txt v="h14">CAREER</Txt>
                {stints(career).map((c) => (
                  <View key={`${c.club}${c.from}`} style={styles.stint}>
                    <View style={styles.flex}>
                      <Txt v="bodyBold">{c.club}</Txt>
                      <Txt v="cap" color={C.textMuted}>
                        {LEAGUE_ADJECTIVES[c.league as keyof typeof LEAGUE_ADJECTIVES] ?? c.league} ·{' '}
                        {c.from === c.to ? seasonLabel(c.from) : `${seasonLabel(c.from)}–${seasonLabel(c.to)}`}
                      </Txt>
                    </View>
                    <Txt v="cap" color={C.textMuted}>
                      {c.apps} apps · {c.goals} goals
                    </Txt>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Links to the squad */}
          <View style={styles.block}>
            <Txt v="h14">LINKS IN YOUR SQUAD</Txt>
            {links.length === 0 ? (
              <Txt v="body" color={C.textMuted}>
                No links with the players you drafted yet.
              </Txt>
            ) : (
              links.map((l) => (
                <Pressable
                  key={`${l.target.kind}${l.target.index}`}
                  onPress={() => onOpen(l.target)}
                  accessibilityRole="button"
                  accessibilityLabel={`${l.name}: ${l.label}`}
                  style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
                  <View style={[styles.linkDot, { backgroundColor: LINK_TINT[Math.min(4, l.value)] }]} />
                  <View style={styles.flex}>
                    <Txt v="bodyBold">{l.name}</Txt>
                    <Txt v="cap" color={C.textMuted}>
                      {l.label}
                    </Txt>
                  </View>
                  <Icon name="chevron_right" size={16} color={C.textDim} />
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    flex: 1,
    borderRadius: R.xl,
    backgroundColor: C.surface,
    boxShadow: SHADOW_LG,
    overflow: 'hidden',
  },
  content: { padding: 16, gap: 16 },
  flex: { flex: 1 },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  captain: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: R.xs, backgroundColor: C.gold },
  ratingBox: { alignItems: 'center' },
  close: {
    width: 32,
    height: 32,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface3,
  },
  totals: { flexDirection: 'row', gap: 8 },
  total: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: R.lg, backgroundColor: C.surface2 },
  block: { gap: 8 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingTop: 4 },
  barCol: { width: 22, alignItems: 'center', gap: 2 },
  barTrack: { width: 12, height: 90, justifyContent: 'flex-end', borderRadius: R.xs, backgroundColor: C.surface3 },
  bar: { width: '100%', borderRadius: R.xs },
  stint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: R.md,
    backgroundColor: C.surface2,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: R.md,
    backgroundColor: alpha(C.surface3, 0.6),
  },
  linkDot: { width: 10, height: 10, borderRadius: R.pill },
  pressed: { opacity: 0.7 },
});
