import {
  LEGENDS,
  matchEvents,
  seasonLabel,
  simulateMatch,
  type Legend,
  type LegendResponse,
  type MatchEvent,
  type MatchResult,
} from '@champion/shared';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { fetchLegend, fetchLegendsAvailability } from '@/api/client';
import { MatchPlay, playLocally, yourSide } from '@/components/match-play';
import { EndBar, TournamentShell } from '@/components/tournament-shell';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn, Chip, Glow, SHADOW_LG, SHADOW_SM } from '@/design/ui';
import { collectLegend, useLegendCollection } from '@/game/legends';
import type { ResultReport } from '@/game/online';
import type { DraftPlayer } from '@/mocks/players';
import { teamName } from '@/game/progress';

type Props = {
  formation: string;
  lineup: readonly (DraftPlayer | null)[];
  overall: number;
  chemistry: number;
  onBack: () => void;
  onFinished: () => void;
  onNewGame: () => void;
  onExit: () => void;
  onResult?: (result: ResultReport) => void;
};

type Format = 'single' | 'tie';
type Leg = { youAtHome: boolean; result: MatchResult; events: MatchEvent[]; yours: number; theirs: number };
type Tie = {
  legs: [Leg, Leg];
  aggYours: number;
  aggTheirs: number;
  penalties: { yours: number; theirs: number } | null;
  won: boolean;
};

const TIERS = [3, 2, 1] as const;
const TIER_LABEL = { 3: 'IMMORTALS', 2: 'GIANTS', 1: 'CULT HEROES' } as const;
const TIER_TINT = { 3: C.gold, 2: C.blueLight, 1: C.green } as const;
const TIER_ICON = { 3: 'crown', 2: 'workspace_premium', 1: 'stars' } as const;
const PENALTY_SCORED = 0.76;

/** A shoot-out: five each, then sudden death. */
function shootout(random = Math.random) {
  let yours = 0;
  let theirs = 0;
  for (let k = 0; k < 5; k++) {
    if (random() < PENALTY_SCORED) yours++;
    if (random() < PENALTY_SCORED) theirs++;
  }
  while (yours === theirs) {
    const a = random() < PENALTY_SCORED;
    const b = random() < PENALTY_SCORED;
    if (a) yours++;
    if (b) theirs++;
  }
  return { yours, theirs };
}

/**
 * Legends mode: 40 legendary club seasons as bosses. Pick one, play a single match or a two-legged
 * tie against its real XI; every legend you beat goes into your collection.
 */
export function LegendsTournament({
  formation,
  lineup,
  overall,
  chemistry,
  onBack,
  onFinished,
  onNewGame,
  onExit,
  onResult,
}: Props) {
  const collection = useLegendCollection();
  const [available, setAvailable] = useState<Set<string> | null>(null);
  const [picked, setPicked] = useState<Legend | null>(null);
  const [format, setFormat] = useState<Format>('single');
  const [locked, setLocked] = useState(false);
  const [xi, setXI] = useState<LegendResponse | null>(null);
  const [missing, setMissing] = useState(false);
  const [tie, setTie] = useState<Tie | null>(null);

  useEffect(() => {
    fetchLegendsAvailability()
      .then((a) => setAvailable(new Set(a.available)))
      .catch(() => setAvailable(null));
  }, []);

  useEffect(() => {
    setXI(null);
    setMissing(false);
    if (!picked) return;
    let live = true;
    fetchLegend(picked.id)
      .then((r) => live && setXI(r))
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [picked]);

  const tiers = useMemo(() => TIERS.map((t) => ({ tier: t, list: LEGENDS.filter((l) => l.tier === t) })), []);
  const collected = LEGENDS.filter((l) => collection[l.id]).length;
  const rating = xi?.xi.length ? xi.xi.reduce((s, p) => s + (p.rating ?? 50), 0) / xi.xi.length : null;
  const label = (l: Legend) => `${l.club} ${seasonLabel(l.season)}`;

  const finish = (l: Legend, won: boolean, result: ResultReport) => {
    if (won) collectLegend(l.id, { date: new Date().toISOString(), score: result.detail, formation });
    onResult?.(result);
  };

  const playTie = () => {
    if (!picked || !xi) return;
    const you = yourSide(formation, lineup);
    const them = { name: picked.nickname, xi: xi.xi, factor: 1 };
    const leg = (youAtHome: boolean): Leg => {
      const [home, away] = youAtHome ? [you, them] : [them, you];
      const result = simulateMatch(home, away);
      const yours = youAtHome ? result.homeGoals : result.awayGoals;
      const theirs = youAtHome ? result.awayGoals : result.homeGoals;
      return { youAtHome, result, events: matchEvents(home, away, result), yours, theirs };
    };
    // You play the first leg at home, the legend hosts the return leg.
    const legs: [Leg, Leg] = [leg(true), leg(false)];
    const aggYours = legs[0].yours + legs[1].yours;
    const aggTheirs = legs[0].theirs + legs[1].theirs;
    const penalties = aggYours === aggTheirs ? shootout() : null;
    const won = penalties ? penalties.yours > penalties.theirs : aggYours > aggTheirs;
    setTie({ legs, aggYours, aggTheirs, penalties, won });
    setLocked(true);
    onFinished();
    finish(picked, won, {
      mode: 'legend',
      title: `vs ${picked.nickname} (${label(picked)})`,
      detail: `${aggYours}–${aggTheirs} agg.${penalties ? ` · pens ${penalties.yours}–${penalties.theirs}` : ''}`,
      outcome: won ? 'win' : 'loss',
    });
  };

  return (
    <TournamentShell title="Legends" onBack={!locked && picked ? () => setPicked(null) : onBack}>
      {!picked && (
        <>
          <Animated.View entering={FadeIn.duration(250)} style={styles.hero}>
            <Glow color={C.gold} opacity={0.18} size={220} style={{ right: -60, top: -80 }} />
            <Txt v="capUpper" color={C.gold}>
              BEAT THE LEGENDS
            </Txt>
            <Txt v="h24">The 40 greatest club seasons</Txt>
            <Txt v="body" color={C.textMuted}>
              Every legend plays with its real XI of that season. Beat one and it goes into your collection.
            </Txt>
            <View style={styles.progressRow}>
              <View style={styles.progress}>
                <View
                  style={{ width: `${(collected / LEGENDS.length) * 100}%`, height: '100%', backgroundColor: C.gold }}
                />
              </View>
              <Txt v="num13" color={C.gold}>
                {collected}/{LEGENDS.length}
              </Txt>
            </View>
          </Animated.View>

          {tiers.map(({ tier, list }) => (
            <View key={tier} style={styles.tier}>
              <View style={styles.tierHead}>
                <Icon name={TIER_ICON[tier]} size={15} color={TIER_TINT[tier]} />
                <Txt v="h14" color={TIER_TINT[tier]}>
                  {TIER_LABEL[tier]}
                </Txt>
                <Txt v="cap" color={C.textDim}>
                  {list.filter((l) => collection[l.id]).length}/{list.length}
                </Txt>
              </View>
              {list.map((l) => {
                const won = !!collection[l.id];
                const soon = available !== null && !available.has(l.id);
                return (
                  <Pressable
                    key={l.id}
                    onPress={() => setPicked(l)}
                    disabled={soon}
                    accessibilityRole="button"
                    accessibilityLabel={`${l.nickname}, ${label(l)}${won ? ', collected' : ''}`}
                    style={({ pressed }) => [
                      styles.legend,
                      won && styles.legendWon,
                      soon && styles.soon,
                      pressed && styles.pressed,
                    ]}>
                    <View style={[styles.badge, { backgroundColor: alpha(TIER_TINT[tier], won ? 0.9 : 0.15) }]}>
                      <Icon name={won ? 'check' : 'shield'} size={16} color={won ? C.deep : TIER_TINT[tier]} />
                    </View>
                    <View style={styles.flex}>
                      <Txt v="h14" numberOfLines={1}>
                        {l.nickname}
                      </Txt>
                      <Txt v="capBody" color={C.textMuted} numberOfLines={1}>
                        {label(l)}
                        {won ? ` · won ${collection[l.id]!.score}` : ''}
                      </Txt>
                    </View>
                    {won ? (
                      <Chip label="COLLECTED" color={C.onGoldDark} bg={C.gold} radius={R.pill} />
                    ) : soon ? (
                      <Chip label="NO SQUAD YET" color={C.textMuted} bg={C.surface3} radius={R.pill} />
                    ) : (
                      <Icon name="chevron_right" size={18} color={C.textMuted} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </>
      )}

      {picked && (
        <>
          <Animated.View entering={FadeIn.duration(250)} style={styles.story}>
            <View style={styles.tierHead}>
              <Icon name={TIER_ICON[picked.tier]} size={14} color={TIER_TINT[picked.tier]} />
              <Txt v="capUpper" color={TIER_TINT[picked.tier]}>
                {TIER_LABEL[picked.tier]} · {label(picked)}
              </Txt>
            </View>
            <Txt v="h24">{picked.nickname}</Txt>
            <Txt v="body" color={C.textMuted}>
              {picked.story}
            </Txt>
            {collection[picked.id] && !locked && (
              <Chip
                label={`IN YOUR COLLECTION · ${collection[picked.id]!.score}`}
                color={C.gold}
                bg={alpha(C.gold, 0.15)}
                icon="check_circle"
                radius={R.pill}
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
              />
            )}
          </Animated.View>

          {!locked && (
            <View style={styles.segment}>
              {(['single', 'tie'] as const).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFormat(f)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: format === f }}
                  style={[styles.segBtn, format === f && styles.segActive]}>
                  <Txt v="h14" color={format === f ? C.onGreenStrong : C.textMuted}>
                    {f === 'single' ? 'Single match' : 'Two legs'}
                  </Txt>
                </Pressable>
              ))}
            </View>
          )}

          {missing ? (
            <Txt v="bodySemi" color={C.red} style={styles.center}>
              This legend&apos;s squad isn&apos;t in the database yet – pick another one.
            </Txt>
          ) : format === 'single' ? (
            <MatchPlay
              key={picked.id}
              formation={formation}
              lineup={lineup}
              overall={overall}
              chemistry={chemistry}
              opponentName={picked.nickname}
              opponentRating={rating}
              opponentChip={`LEGEND ${'★'.repeat(picked.tier)}`}
              meta={`${label(picked)} · VENUE DRAWN AT KICK-OFF`}
              metaPlayed={label(picked)}
              simulate={async (you) => {
                const opp = xi ?? (await fetchLegend(picked.id));
                return playLocally(you, { name: picked.nickname, xi: opp.xi });
              }}
              onFinished={() => {
                setLocked(true);
                onFinished();
              }}
              onNewGame={onNewGame}
              onExit={onExit}
              onResult={(r) =>
                finish(picked, r.outcome === 'win', {
                  mode: 'legend',
                  title: `vs ${picked.nickname} (${label(picked)})`,
                  detail: `${r.yours}–${r.theirs} ${r.played.youAtHome ? '(home)' : '(away)'}`,
                  outcome: r.outcome,
                })
              }>
              {collection[picked.id] && (
                <Chip
                  label="LEGEND COLLECTED"
                  color={C.onGoldDark}
                  bg={C.gold}
                  icon="emoji_events"
                  radius={R.pill}
                  style={{ alignSelf: 'center' }}
                />
              )}
            </MatchPlay>
          ) : tie ? (
            <>
              <TieCard tie={tie} legend={picked} />
              <EndBar onNewGame={onNewGame} onExit={onExit} />
            </>
          ) : (
            <View style={styles.card}>
              <View style={styles.versus}>
                <View style={styles.side}>
                  <Txt v="h20">{teamName()}</Txt>
                  <Chip label={`OVR ${Math.round(overall)} · CHEM ${chemistry}`} color={C.green} bg={C.surface4} />
                </View>
                <Txt v="h20" color={C.gold}>
                  VS
                </Txt>
                <View style={styles.side}>
                  <Txt v="h20" numberOfLines={1} adjustsFontSizeToFit>
                    {picked.nickname}
                  </Txt>
                  <Chip label={rating ? `RTG ${Math.round(rating)}` : '…'} color={C.textMuted} bg={C.surface4} />
                </View>
              </View>
              <Txt v="body" color={C.textMuted} style={styles.center}>
                First leg at home, return leg away. Level on aggregate: penalties.
              </Txt>
              <Btn
                kind="blue"
                icon="swords"
                label={xi ? 'Play the tie' : 'Loading the legend…'}
                sub="Both legs at once"
                disabled={!xi}
                onPress={playTie}
              />
              {!xi && <ActivityIndicator color={C.green} />}
            </View>
          )}
        </>
      )}
    </TournamentShell>
  );
}

/** Both legs, the aggregate and (if needed) the shoot-out. */
function TieCard({ tie, legend }: { tie: Tie; legend: Legend }) {
  const goals = (leg: Leg, yours: boolean) =>
    leg.events
      .filter((e) => e.type === 'goal' && (e.side === (leg.youAtHome ? 'home' : 'away')) === yours)
      .map((e) => `${e.player.split(' ').slice(-1)[0]} ${e.minute}'`)
      .join(', ');
  return (
    <Animated.View entering={FadeIn.duration(300)} style={[styles.card, styles.tieCard]}>
      <Glow color={tie.won ? C.gold : C.red} opacity={0.15} size={220} style={{ right: -60, top: -80 }} />
      <View style={[styles.verdict, { backgroundColor: tie.won ? C.gold : C.redDeep }]}>
        <Icon name={tie.won ? 'emoji_events' : 'flag'} size={14} color={tie.won ? C.onGoldDark : C.red} />
        <Txt v="h14" color={tie.won ? C.onGoldDark : C.red}>
          {tie.won ? 'LEGEND BEATEN · COLLECTED' : 'THE LEGEND GOES THROUGH'}
        </Txt>
      </View>
      <View style={styles.agg}>
        <Txt v="h36" color={tie.won ? C.green : C.text}>
          {tie.aggYours}
        </Txt>
        <Txt v="h20" color={C.textDim}>
          –
        </Txt>
        <Txt v="h36" color={tie.won ? C.text : C.red}>
          {tie.aggTheirs}
        </Txt>
      </View>
      <Txt v="cap" color={C.textMuted} style={styles.center}>
        AGGREGATE{tie.penalties ? ` · PENALTIES ${tie.penalties.yours}–${tie.penalties.theirs}` : ''}
      </Txt>
      {tie.legs.map((leg, k) => (
        <View key={k} style={styles.leg}>
          <View style={styles.between}>
            <Txt v="capUpper" color={C.textMuted}>
              {k === 0 ? '1ST LEG · HOME' : `2ND LEG · AWAY AT ${legend.club.toUpperCase()}`}
            </Txt>
            <Txt v="h16">
              {leg.yours} – {leg.theirs}
            </Txt>
          </View>
          {!!goals(leg, true) && (
            <Txt v="capBody" color={C.blueLight}>
              ⚽ {teamName()}: {goals(leg, true)}
            </Txt>
          )}
          {!!goals(leg, false) && (
            <Txt v="capBody" color={C.textMuted}>
              ⚽ {legend.nickname}: {goals(leg, false)}
            </Txt>
          )}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 6,
    padding: 16,
    overflow: 'hidden',
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  progress: {
    flex: 1,
    height: 6,
    overflow: 'hidden',
    borderRadius: R.pill,
    backgroundColor: C.surface4,
  },
  tier: {
    gap: 6,
  },
  tierHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: R.md,
    backgroundColor: C.surface,
  },
  legendWon: {
    borderWidth: 1,
    borderColor: alpha(C.gold, 0.4),
  },
  soon: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.8,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  story: {
    gap: 4,
    padding: 16,
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: R.pill,
    backgroundColor: C.surface,
  },
  segBtn: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.pill,
  },
  segActive: {
    backgroundColor: C.greenStrong,
  },
  center: {
    textAlign: 'center',
  },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  tieCard: {
    overflow: 'hidden',
    alignItems: 'stretch',
    boxShadow: SHADOW_LG,
  },
  versus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  side: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: R.pill,
  },
  agg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    height: 60,
    borderRadius: R.lg,
    backgroundColor: C.deep,
  },
  leg: {
    gap: 4,
    padding: 10,
    borderRadius: R.sm,
    backgroundColor: C.surface2,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
