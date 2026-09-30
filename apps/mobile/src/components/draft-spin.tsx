import {
  DECADES,
  LEAGUE_ADJECTIVES,
  LEAGUE_NAMES,
  LEAGUES,
  PLAYER_ROLES,
  boostWeight,
  decadeLabel,
  positionFit,
  slugify,
  type DraftBoostId,
  type League,
  type PlayerRole,
  type PositionCode,
} from '@champion/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchClubs, fetchSquad, toDraftPlayer } from '@/api/client';
import { SlotReel, type SlotReelHandle } from '@/components/slot-reel';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, HEADER_HEIGHT, R, alpha } from '@/design/tokens';
import { Btn, Chip, Glow, ScreenHeader } from '@/design/ui';
import { consumeItem, useWallet } from '@/game/wallet';
import { randomPlayers, type DraftPlayer } from '@/mocks/players';
import { formatRating } from '@/utils/rating';

const LEAGUE_ITEMS = Object.values(LEAGUE_ADJECTIVES);
const DECADE_ITEMS = DECADES.map((d) => `${decadeLabel(d)}s`);
// Shown (covered) until the clubs for the spun league + decade arrive from the API.
const CLUB_PLACEHOLDER = ['?'];

// Reels spin one after another, left to right: decade, then league, then club.
const COLUMN_NAMES = ['decade', 'league', 'club'] as const;
const CLUB_SLOT = 2;

const pickRandom = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;
const ROW = 40;

type ClubStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
const CLUB_COVER_TEXT: Partial<Record<ClubStatus, string>> = {
  loading: '…',
  empty: 'No clubs',
  error: 'Offline',
};
const SPIN_DURATION = 2600;

export const ROLE_TITLES: Record<PlayerRole, string> = {
  FW: 'Forwards',
  MF: 'Midfielders',
  DF: 'Defenders',
  GK: 'Goalkeepers',
};
const ROLE_TABS: Record<PlayerRole, string> = { GK: 'GK', DF: 'DEF', MF: 'MID', FW: 'FWD' };

export type DraftPick = {
  player: DraftPlayer;
  league: string;
  club: string;
  decade: string;
};

type Props = {
  /** Empty spots of the lineup; only players who fit at least one of them can be picked. */
  openSpots: { code: PositionCode; role: PlayerRole }[];
  /** A bench slot is free: then any player can be picked (he can go on the bench). */
  benchOpen?: boolean;
  /** Names already in the lineup; they can't be drafted twice. */
  taken: string[];
  onPick: (pick: DraftPick) => void;
  /** Team chemistry gained by picking this player (on his best open spot); null if none fits. */
  chemistryGain?: (player: DraftPlayer) => number | null;
  /** Team chemistry (0–100) of the XI so far. */
  teamChemistry: number;
  /** Daily challenge: allowed decades and leagues, seeded reels, limited re-spins. */
  rules?: DraftRules;
};

export type DraftRules = {
  decades?: readonly number[];
  leagues?: readonly League[];
  random?: () => number;
  /** Re-spins left (null = unlimited). */
  respinsLeft?: number | null;
  onRespin?: () => void;
  /** Draft boost of this draft: the club reel lands more often on clubs with top-rated players. */
  boost?: DraftBoostId | null;
};

/** "Live Draft Session": three reels (decade, league, club), then that club's squad to draft from. */
export function DraftSpin({ openSpots, benchOpen = false, taken, onPick, chemistryGain, teamChemistry, rules }: Props) {
  const insets = useSafeAreaInsets();
  const decadeItems = useMemo(
    () =>
      rules?.decades?.length
        ? DECADES.filter((d) => rules.decades!.includes(d)).map((d) => `${decadeLabel(d)}s`)
        : DECADE_ITEMS,
    [rules?.decades],
  );
  const leagueItems = useMemo(
    () =>
      rules?.leagues?.length
        ? LEAGUES.filter((l) => rules.leagues!.includes(l)).map((l) => LEAGUE_ADJECTIVES[l])
        : LEAGUE_ITEMS,
    [rules?.leagues],
  );
  const respinsLeft = rules?.respinsLeft ?? null;
  const canPick = (p: DraftPlayer) =>
    !taken.includes(p.name) && (benchOpen || openSpots.some((spot) => positionFit(p, spot) !== null));
  const reels = useRef<(SlotReelHandle | null)[]>([]);
  const [results, setResults] = useState<(string | null)[]>([null, null, null]);
  // Reels still waiting for their turn stay covered.
  const [revealed, setRevealed] = useState([true, false, false]);
  const [players, setPlayers] = useState<DraftPlayer[] | null>(null);
  // 'real' = squad from the database, 'dummy' = none imported for this club and decade yet.
  // 'absent' = the club didn't play in this league in the spun decade (after a decade re-spin).
  const [playerSource, setPlayerSource] = useState<'loading' | 'real' | 'dummy' | 'absent'>('loading');
  const playerRequest = useRef(0);
  const queue = useRef<number[]>([1, CLUB_SLOT]);
  const [clubItems, setClubItems] = useState<string[]>(CLUB_PLACEHOLDER);
  const [clubWeights, setClubWeights] = useState<number[] | undefined>(undefined);
  const [clubStatus, setClubStatus] = useState<ClubStatus>('idle');
  const [clubSpin, setClubSpin] = useState(0);
  const clubRequest = useRef(0);
  const [tab, setTab] = useState<PlayerRole | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [chamberWidth, setChamberWidth] = useState(0);

  // The reels render once the chamber has been measured; then the first one starts.
  const measured = chamberWidth > 0;
  useEffect(() => {
    if (measured) requestAnimationFrame(() => reels.current[0]?.spin());
  }, [measured]);

  useEffect(() => {
    if (clubSpin > 0) reels.current[CLUB_SLOT]?.spin();
  }, [clubSpin]);

  // Reels report back from callbacks captured at spin time, so accumulate in a ref, not render state.
  const latest = useRef<(string | null)[]>([null, null, null]);
  // The API wants the decade as "80"; the reel shows "80s".
  const decadeOf = (text: string) => text.replace(/s$/, '');

  const loadClubs = () => {
    const id = ++clubRequest.current;
    const [decadeText, leagueText] = latest.current;
    setClubStatus('loading');
    fetchClubs(leagueText!, decadeOf(decadeText!))
      .then(({ clubs }) => {
        if (id !== clubRequest.current) return;
        if (clubs.length === 0) return setClubStatus('empty');
        setClubItems(clubs.map((c) => c.club));
        setClubWeights(rules?.boost ? clubs.map((c) => boostWeight(rules.boost, c.top)) : undefined);
        setClubStatus('ready');
        setRevealed((prev) => prev.map((r, i) => r || i === CLUB_SLOT));
        setClubSpin((n) => n + 1);
      })
      .catch(() => {
        if (id === clubRequest.current) setClubStatus('error');
      });
  };

  // Real squad for the spun club and decade; dummy players when none is imported (or offline).
  const loadPlayers = () => {
    const id = ++playerRequest.current;
    const [decadeText, leagueText, clubText] = latest.current;
    const decade = decadeOf(decadeText!);
    const showDummies = () => {
      if (id !== playerRequest.current) return;
      setPlayers(randomPlayers(leagueText!));
      setPlayerSource('dummy');
    };
    setPlayerSource('loading');
    Promise.all([fetchClubs(leagueText!, decade), fetchSquad(leagueText!, decade, clubText!)])
      .then(([{ clubs }, { players: squad }]) => {
        if (id !== playerRequest.current) return;
        if (!clubs.some((c) => c.clubSlug === slugify(clubText!))) {
          setPlayers(null);
          return setPlayerSource('absent');
        }
        if (squad.length === 0) return showDummies();
        setPlayers(squad.map(toDraftPlayer));
        setPlayerSource('real');
      })
      .catch(showDummies);
  };

  const setResult = (slot: number) => (item: string) => {
    latest.current = latest.current.map((r, i) => (i === slot ? item : r));
    setResults(latest.current);
    const next = queue.current.shift();
    if (next === CLUB_SLOT) {
      loadClubs();
    } else if (next !== undefined) {
      setRevealed((prev) => prev.map((r, i) => r || i === next));
      reels.current[next]?.spin();
    } else if (latest.current.every(Boolean)) {
      loadPlayers();
    }
  };

  // Decade re-spins alone (the club stays; its players reload for the new decade).
  // League re-spins league, then club (the club list depends on the league).
  // Club re-spins alone, from the clubs of the current league and decade.
  const respin = (slot: number) => {
    setScouted(null);
    // A stuck spin (no clubs, offline, club absent) is free.
    if (!stuck) {
      if (respinsLeft !== null && respinsLeft <= 0) return;
      rules?.onRespin?.();
    }
    const slots = slot === 0 ? [0] : slot === 1 ? [1, CLUB_SLOT] : [CLUB_SLOT];
    playerRequest.current++;
    if (slots.includes(CLUB_SLOT)) {
      clubRequest.current++;
      setClubStatus('idle');
    }
    latest.current = latest.current.map((r, i) => (slots.includes(i) ? null : r));
    setResults(latest.current);
    setRevealed((prev) => prev.map((r, i) => (slots.includes(i) ? i === slots[0] && i !== CLUB_SLOT : r)));
    setPlayers(null);
    setChosen(null);
    setTab(null);
    queue.current = slots.slice(1);
    if (slots[0] === CLUB_SLOT) loadClubs();
    else reels.current[slots[0]]?.spin();
  };

  const gains = useMemo(
    () => new Map((players ?? []).map((p) => [p.id, chemistryGain?.(p) ?? null])),
    [players, chemistryGain],
  );

  const done = results.every(Boolean);
  // Nothing to draft (no clubs / offline / club absent) always allows a re-spin.
  const stuck = clubStatus === 'empty' || clubStatus === 'error' || playerSource === 'absent';

  // Scout (store item, casual games only): a second random club of the same league and decade to
  // choose from – still a random draw, never a better player.
  const casual = !rules?.random;
  const scoutsLeft = useWallet().wallet?.consumables.scout ?? 0;
  const [scouted, setScouted] = useState<string | null>(null);
  const [scouting, setScouting] = useState(false);
  const scout = async () => {
    const current = latest.current[CLUB_SLOT];
    const others = clubItems.filter((c) => c !== current && c !== CLUB_PLACEHOLDER[0]);
    if (!others.length) return;
    setScouting(true);
    const ok = await consumeItem('scout');
    setScouting(false);
    if (ok) setScouted(pickRandom(others));
  };
  const takeScouted = () => {
    if (!scouted) return;
    latest.current = latest.current.map((r, i) => (i === CLUB_SLOT ? scouted : r));
    setResults(latest.current);
    setScouted(null);
    loadPlayers();
  };
  const canRespin = (done || stuck) && (respinsLeft === null || respinsLeft > 0 || stuck);
  const columnItems = [decadeItems, leagueItems, clubItems];
  const [decade, league, club] = results;
  const reelWidth = chamberWidth ? (chamberWidth - 16 - 8) / 3 : 0;
  const leagueCode = LEAGUES.find((l) => LEAGUE_ADJECTIVES[l] === league);
  const columnLabels = [
    'Decade',
    leagueCode ? LEAGUE_NAMES[leagueCode].split(' / ')[0] : 'League',
    club ? clubShort(club) : 'Club',
  ];

  // Position tabs: the first role that still has an open spot is shown first.
  const byRole = [...PLAYER_ROLES]
    .reverse()
    .map((r) => ({ role: r, list: (players ?? []).filter((p) => p.position === r) }));
  const activeTab =
    tab ??
    byRole.find((g) => g.list.length && openSpots.some((s) => s.role === g.role))?.role ??
    byRole.find((g) => g.list.length)?.role ??
    'GK';
  const list = (byRole.find((g) => g.role === activeTab)?.list ?? [])
    .slice()
    .sort((a, b) => Number(canPick(b)) - Number(canPick(a)) || (b.rating ?? 0) - (a.rating ?? 0));
  const chosenPlayer = players?.find((p) => p.id === chosen && canPick(p)) ?? null;

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Glow color={C.green} opacity={0.1} size={500} style={{ left: -55, top: -80 }} />
        <Glow color={C.gold} opacity={0.1} size={400} style={{ left: -5, bottom: 40 }} />
      </View>
      <ScreenHeader title="Live Draft Session" showBell={false} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + HEADER_HEIGHT + 4, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.between}>
            <View style={styles.flex}>
              <View style={styles.row4}>
                <View style={styles.diceIcon}>
                  <Icon name="casino" size={14} color={C.gold} />
                </View>
                <Txt v="h20" style={{ letterSpacing: -0.5 }}>
                  Spin for a player
                </Txt>
              </View>
              <Txt v="body" color={C.textMuted} style={{ marginTop: 2 }}>
                Match decade, league and club to reveal the squad
              </Txt>
            </View>
            {respinsLeft !== null ? (
              <Chip
                label={`${respinsLeft} RE-SPIN${respinsLeft === 1 ? '' : 'S'}`}
                color={respinsLeft > 0 ? C.gold : C.red}
                bg={C.surface4}
                icon="autorenew"
                type="capUpper"
                radius={R.pill}
              />
            ) : (
              <Chip label="LIVE DRAFT" color={C.green} bg={C.surface4} dot={C.green} type="capUpper" radius={R.pill} />
            )}
          </View>

          {/* Slot chamber */}
          <View style={styles.chamber} onLayout={(e) => setChamberWidth(e.nativeEvent.layout.width)}>
            <View style={styles.reels}>
              {reelWidth > 0 &&
                COLUMN_NAMES.map((name, i) => (
                  <View key={name} style={[styles.column, { width: reelWidth }]}>
                    <Pressable
                      onPress={() => respin(i)}
                      disabled={!canRespin}
                      accessibilityRole="button"
                      accessibilityLabel={`Re-spin ${name}`}
                      style={({ pressed }) => [
                        styles.respin,
                        !canRespin && styles.invisible,
                        pressed && styles.pressed,
                      ]}>
                      <Icon name="autorenew" size={11} color={C.textMuted} />
                      <Txt v="tiny" color={C.textMuted} style={styles.upper}>
                        RESPIN
                      </Txt>
                    </Pressable>
                    <View>
                      <SlotReel
                        ref={(handle) => {
                          reels.current[i] = handle;
                        }}
                        items={columnItems[i]}
                        width={reelWidth}
                        duration={SPIN_DURATION}
                        rowHeight={ROW}
                        fontSize={i === CLUB_SLOT ? 16 : 20}
                        lines={i === CLUB_SLOT ? 2 : 1}
                        random={rules?.random}
                        stopAnywhere={!rules?.random}
                        weights={i === CLUB_SLOT ? clubWeights : undefined}
                        onResult={setResult(i)}
                      />
                      {!revealed[i] && (
                        <Animated.View
                          entering={FadeIn.duration(200)}
                          exiting={FadeOut.duration(300)}
                          style={styles.cover}>
                          <Txt v={i === CLUB_SLOT && CLUB_COVER_TEXT[clubStatus] ? 'bodyBold' : 'h28'} color={C.gold}>
                            {i === CLUB_SLOT && CLUB_COVER_TEXT[clubStatus] ? CLUB_COVER_TEXT[clubStatus] : '?'}
                          </Txt>
                        </Animated.View>
                      )}
                    </View>
                    <View style={styles.reelLabel}>
                      <Txt v="cap" color={C.green} numberOfLines={1}>
                        {columnLabels[i]}
                      </Txt>
                    </View>
                  </View>
                ))}
            </View>
            {/* Gold payline across the three reels */}
            <View pointerEvents="none" style={styles.payline}>
              <View style={styles.paylineBar} />
              <View style={styles.paylineBar} />
            </View>
            <View style={styles.matchRow}>
              <View style={styles.row6}>
                <Icon name="verified" size={15} color={done ? C.gold : C.textDim} />
                <Txt v="cap" color={done ? C.text : C.textDim}>
                  {done ? 'Jackpot Match Configured' : 'Spinning…'}
                </Txt>
              </View>
              {done && players && (
                <Chip
                  label={`${players.length} PLAYERS`}
                  color={C.gold}
                  bg={alpha(C.gold, 0.15)}
                  radius={R.pill}
                  style={{ paddingVertical: 2 }}
                />
              )}
            </View>
          </View>

          {done && playerSource === 'loading' && (
            <Txt v="body" color={C.textMuted} style={styles.center}>
              Loading players…
            </Txt>
          )}
          {done && playerSource === 'absent' && (
            <Txt v="bodySemi" color={C.red} style={styles.center}>
              {club} didn&apos;t play in the {league} league in the {decade}. Respin to get a club from that decade.
            </Txt>
          )}

          {casual && done && (playerSource === 'real' || playerSource === 'dummy') && (scouted || scoutsLeft > 0) && (
            <View style={styles.scoutRow}>
              {scouted ? (
                <>
                  <Txt v="cap" color={C.textMuted}>
                    Scout found another club:
                  </Txt>
                  <Btn kind="dark" label={club ?? ''} height={36} labelType="capUpper" onPress={() => setScouted(null)} />
                  <Btn kind="gold" label={scouted} height={36} labelType="capUpper" onPress={takeScouted} />
                </>
              ) : (
                <Btn
                  kind="dark"
                  icon="search"
                  label={scouting ? 'SCOUTING…' : `SCOUT · ${scoutsLeft} LEFT`}
                  height={36}
                  labelType="capUpper"
                  disabled={scouting}
                  accessibilityLabel="Scout: show a second random club to choose from"
                  onPress={scout}
                />
              )}
            </View>
          )}

          {players && (playerSource === 'real' || playerSource === 'dummy') && league && club && decade && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.gap8}>
              {/* Squad header + position tabs */}
              <View style={styles.between}>
                <View style={styles.flex}>
                  <Txt v="h14" numberOfLines={1}>
                    {playerSource === 'real' ? club : 'Demo players'}
                  </Txt>
                  <Txt v="body" color={C.textMuted}>
                    {playerSource === 'real' ? `${decade} squad · ` : ''}
                    {players.length} players
                  </Txt>
                </View>
                <Chip
                  label={`${openSpots.length} SPOTS OPEN`}
                  color={C.textMuted}
                  bg={C.surface3}
                  dot={C.greenStrong}
                  type="capBody"
                  radius={R.pill}
                  style={{ paddingVertical: 2 }}
                />
              </View>
              {playerSource === 'dummy' && (
                <Txt v="body" color={C.textMuted}>
                  No squad imported for this club and decade yet.
                </Txt>
              )}
              <View style={styles.tabs}>
                {byRole.map((g) => {
                  const active = g.role === activeTab;
                  return (
                    <Pressable
                      key={g.role}
                      onPress={() => setTab(g.role)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      style={[styles.tab, active && styles.tabActive]}>
                      <Txt v="cap" color={active ? C.onGreenStrong : C.textMuted}>
                        {ROLE_TABS[g.role]} ({g.list.length})
                      </Txt>
                    </Pressable>
                  );
                })}
              </View>

              {/* Players */}
              <View style={styles.gap8}>
                {list.map((item) => {
                  const ok = canPick(item);
                  const selected = chosenPlayer?.id === item.id;
                  const gain = gains.get(item.id);
                  const main = item.positions?.[0] ?? item.position;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setChosen(item.id)}
                      disabled={!ok}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: !ok }}
                      style={[styles.player, selected && styles.playerSelected, !ok && styles.playerOff]}>
                      <View style={styles.playerLeft}>
                        <View
                          style={[
                            styles.posBadge,
                            {
                              backgroundColor: selected
                                ? alpha(C.goldDeep, 0.2)
                                : ok
                                  ? C.surface4
                                  : alpha(C.surface4, 0.4),
                            },
                          ]}>
                          <Txt
                            v="cap"
                            style={{ fontFamily: 'SpaceGrotesk_700Bold', lineHeight: 10 }}
                            color={selected ? C.gold : ok ? C.text : C.textMuted}>
                            {item.position}
                          </Txt>
                          <Txt v="tiny" color={selected ? alpha(C.gold, 0.7) : alpha(C.textMuted, ok ? 1 : 0.6)}>
                            {main}
                          </Txt>
                        </View>
                        <View style={styles.flexShrink}>
                          <View style={styles.row6}>
                            <Txt v="h16" color={ok ? C.text : C.textMuted} numberOfLines={1} style={styles.flexShrink}>
                              {item.name}
                            </Txt>
                            {selected && <Icon name="stars" size={14} color={C.gold} />}
                          </View>
                          {item.detail ? (
                            <Txt v="body" color={ok ? C.textMuted : alpha(C.textMuted, 0.7)} numberOfLines={1}>
                              {item.detail}
                            </Txt>
                          ) : null}
                        </View>
                      </View>
                      {ok ? (
                        <View style={styles.row6}>
                          {gain != null && (
                            <View style={[styles.badge, { backgroundColor: alpha(C.green, selected ? 0.2 : 0.1) }]}>
                              <Txt v="cap" color={C.green}>
                                +{gain} CHEM
                              </Txt>
                            </View>
                          )}
                          {item.rating !== undefined && (
                            <View
                              style={[
                                styles.badge,
                                {
                                  backgroundColor: item.rating >= 85 ? alpha(C.blue, 0.25) : alpha(C.greenStrong, 0.3),
                                },
                              ]}>
                              <Txt v="h14" color={item.rating >= 85 ? C.blueLight : C.green}>
                                {formatRating(item.rating)} RTG
                              </Txt>
                            </View>
                          )}
                        </View>
                      ) : (
                        <Chip
                          label={taken.includes(item.name) ? 'IN YOUR XI' : 'NO SPOT'}
                          color={C.red}
                          bg={C.surface4}
                          type="capBody"
                          radius={R.pill}
                          style={{ paddingHorizontal: 10 }}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Draft CTA */}
              <View style={[styles.gap8, { paddingTop: 8 }]}>
                <Btn
                  kind="green"
                  icon="check_circle"
                  label={chosenPlayer ? `Draft ${chosenPlayer.name}` : 'Select a player'}
                  disabled={!chosenPlayer}
                  onPress={() =>
                    chosenPlayer && onPick({ player: chosenPlayer, league, club, decade: decadeOf(decade) })
                  }>
                  {chosenPlayer?.rating !== undefined && (
                    <View style={styles.ovrPill}>
                      <Txt v="bodyBold" color={C.onGreenStrong} style={{ fontSize: 11, lineHeight: 18 }}>
                        {formatRating(chosenPlayer.rating)} OVR
                      </Txt>
                    </View>
                  )}
                </Btn>
                <Txt v="body" color={C.textMuted} style={styles.center}>
                  Green chemistry shows what he adds on his best open spot.
                </Txt>
              </View>
            </Animated.View>
          )}
        </View>

        {/* Quick stats */}
        <View style={styles.stats}>
          <Stat icon="bolt" label="TEAM CHEMISTRY" value={`${teamChemistry} / 100`} />
          <Stat icon="deployed_code" label="OPEN SPOTS" value={`${openSpots.length} Left`} color={C.green} />
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
  color = C.text,
}: {
  icon: 'bolt' | 'deployed_code';
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>
        <Icon name={icon} size={16} color={C.text} />
      </View>
      <View>
        <Txt v="capUpper" color={C.textMuted} style={{ letterSpacing: 0.6 }}>
          {label}
        </Txt>
        <Txt v="h20" color={color}>
          {value}
        </Txt>
      </View>
    </View>
  );
}

/** Short club tag for the reel label ("Barcelona" → "BAR", "Real Madrid" → "RMA"). */
function clubShort(club: string) {
  const words = club
    .replace(/[^A-Za-zÀ-ÿ ]/g, '')
    .split(' ')
    .filter(Boolean);
  if (words.length >= 2) return (words[0]!.slice(0, 1) + words[1]!.slice(0, 2)).toUpperCase();
  return club.slice(0, 3).toUpperCase();
}

const styles = StyleSheet.create({
  scoutRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  screen: {
    ...StyleSheet.absoluteFill,
    // Above the game screen's header.
    zIndex: 20,
    backgroundColor: C.bg,
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  card: {
    gap: 16,
    padding: 16,
    borderRadius: R.xl,
    backgroundColor: alpha(C.surface, 0.95),
    boxShadow: '0px 20px 50px rgba(0,0,0,0.85)',
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  flexShrink: {
    flexShrink: 1,
  },
  row4: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  row6: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gap8: {
    gap: 8,
  },
  center: {
    textAlign: 'center',
  },
  upper: {
    textTransform: 'uppercase',
  },
  diceIcon: {
    width: 24,
    height: 24,
    borderRadius: R.sm,
    backgroundColor: alpha(C.gold, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0px 0px 12px ${alpha(C.gold, 0.3)}`,
  },
  chamber: {
    padding: 8,
    gap: 8,
    borderRadius: R.lg,
    backgroundColor: C.deep,
    overflow: 'hidden',
    boxShadow: 'inset 0px 4px 16px rgba(0,0,0,0.9)',
  },
  reels: {
    flexDirection: 'row',
    gap: 4,
    minHeight: 40 * 3 + 60,
  },
  column: {
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: R.md,
    backgroundColor: C.surface,
    overflow: 'hidden',
  },
  respin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: R.pill,
    backgroundColor: C.surface4,
  },
  invisible: {
    opacity: 0,
  },
  pressed: {
    opacity: 0.7,
  },
  cover: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  reelLabel: {
    marginTop: 4,
    maxWidth: '90%',
    padding: 8,
    borderRadius: R.xs,
    backgroundColor: alpha(C.surface4, 0.6),
  },
  payline: {
    position: 'absolute',
    left: 1,
    right: 1,
    top: 65.5,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // The bars sit in the gutter left of the first reel and right of the last one, so long club
    // names on the payline never run under them.
    paddingHorizontal: 0,
    borderRadius: R.md,
    backgroundColor: alpha(C.gold, 0.1),
    boxShadow: `0px 0px 20px ${alpha(C.gold, 0.35)}`,
  },
  paylineBar: {
    width: 6,
    height: 24,
    borderRadius: R.pill,
    backgroundColor: C.gold,
    boxShadow: `0px 0px 8px ${C.gold}`,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  sepDot: {
    width: 5,
    height: 5,
    borderRadius: R.pill,
    backgroundColor: C.textDim,
  },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: R.md,
    backgroundColor: C.deep,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: R.sm,
    backgroundColor: C.surface2,
  },
  tabActive: {
    backgroundColor: C.greenStrong,
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: R.lg,
    backgroundColor: C.surface,
  },
  playerSelected: {
    experimental_backgroundImage: `linear-gradient(to right, ${C.surface2}, ${C.surface3}, ${C.surface2})`,
    boxShadow: `0px 4px 8px rgba(0,0,0,0.5), 0px 0px 0px 2px ${alpha(C.green, 0.2)}`,
  },
  playerOff: {
    opacity: 0.5,
    backgroundColor: alpha(C.deep, 0.6),
  },
  playerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  posBadge: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: R.sm,
  },
  ovrPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: R.pill,
    backgroundColor: alpha(C.onGreenStrong, 0.2),
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: R.md,
    backgroundColor: alpha(C.surface, 0.8),
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: R.sm,
    backgroundColor: C.surface4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
