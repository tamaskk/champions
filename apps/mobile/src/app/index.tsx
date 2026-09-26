import {
  FORMATIONS,
  TOURNAMENT_MODES,
  chemistryPreview,
  computeChemistry,
  formationLayout,
  isLockedSpot,
  linkBetween,
  linkLabel,
  swapSpots,
  formationRoles,
  positionFit,
  seededRandom,
  squadSummary,
  type DailyResponse,
  type SquadDetail,
  type Formation,
  type SavedPlayer,
  type PositionFit,
  type TournamentMode,
  FREE_RESPINS_PER_DRAFT,
} from '@champion/shared';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DailyResult } from '@/components/daily-result';
import { DraftSpin, ROLE_TITLES, type DraftPick, type DraftRules } from '@/components/draft-spin';
import { FormationPitch } from '@/components/formation-pitch';
import { HomeLanding } from '@/components/home-landing';
import { CupTournament } from '@/components/cup-tournament';
import { ChallengeMatch } from '@/components/challenge-match';
import { H2HMatch } from '@/components/h2h-match';
import { LeagueTournament } from '@/components/league-tournament';
import { LegendsTournament } from '@/components/legends-tournament';
import { MatchSetup } from '@/components/match-setup';
import { useHideTabBar } from '@/components/pill-tabs';
import { SlotReel, type SlotReelHandle } from '@/components/slot-reel';
import { SquadSummary } from '@/components/squad-summary';
import { TournamentPicker } from '@/components/tournament-picker';
import { TournamentShell } from '@/components/tournament-shell';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, HEADER_HEIGHT, NAV_ROOM, R, alpha } from '@/design/tokens';
import { Btn, Chip, SHADOW_SM, ScreenHeader } from '@/design/ui';
import { autofillBench, autofillLineup } from '@/game/autofill';
import { consumeItem, useWallet } from '@/game/wallet';
import { usePendingChallenge } from '@/game/challenge';
import { startDailyAttempt } from '@/game/daily';
import { clearCurrentSquad, reportResult, setCurrentSquad } from '@/game/online';
import { kitColor, recordProgress, useProgress } from '@/game/progress';
import { BenchRow } from '@/components/bench-row';
import { DraftSettings } from '@/components/draft-settings';
import { PlayerCard, type CardLink, type CardTarget } from '@/components/player-card';
import { recordDraft } from '@/game/session';
import type { DraftPlayer } from '@/mocks/players';
import { formatRating } from '@/utils/rating';

const TOURNAMENT_LABELS = Object.fromEntries(TOURNAMENT_MODES.map((m) => [m.id, m.label])) as Record<
  TournamentMode,
  string
>;

// Substitutes' bench (arcade mode): slots and the minimum to complete the squad.
const BENCH_SIZE = 5;
const BENCH_MIN = 3;
const EMPTY_BENCH: (DraftPick | null)[] = Array(BENCH_SIZE).fill(null);

export default function HomeScreen() {
  // Kit colour chosen on the profile, for the placed players on the pitch.
  const kit = kitColor(useProgress());
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reel = useRef<SlotReelHandle>(null);
  const [started, setStarted] = useState(false);
  const [formation, setFormation] = useState<Formation | null>(null);
  const [showPitch, setShowPitch] = useState(false);
  const [drawing, setDrawing] = useState(false);
  // Remounts the draft reels on every spin so they start fresh.
  const [drawId, setDrawId] = useState(0);
  const [lineup, setLineup] = useState<(DraftPick | null)[]>([]);
  // Substitutes (arcade only): at least BENCH_MIN of BENCH_SIZE to complete; rotated in over a season.
  const [bench, setBench] = useState<(DraftPick | null)[]>(EMPTY_BENCH);
  // Captain by player id, so the armband follows him through swaps.
  const [captainId, setCaptainId] = useState<string | null>(null);
  // Player card open for an XI spot or a bench slot.
  const [card, setCard] = useState<CardTarget | null>(null);
  // Picked player waiting to be placed on one of the highlighted spots.
  const [pending, setPending] = useState<DraftPick | null>(null);
  // Placed player being moved: tap another spot to swap with it (never the goalkeeper).
  const [selected, setSelected] = useState<number | null>(null);
  // End-of-draft summary, opened with "Complete" once all spots are filled.
  const [showSummary, setShowSummary] = useState(false);
  const [showTournaments, setShowTournaments] = useState(false);
  const [tournament, setTournament] = useState<TournamentMode | null>(null);
  const [autofilling, setAutofilling] = useState(false);
  // This draft in the session records (set when the summary first opens).
  const [squadId, setSquadId] = useState<number | null>(null);
  // A squad plays one tournament: once a result is in, only "new game" or home.
  const [finished, setFinished] = useState(false);
  const gameId = useRef(0);
  const pitchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Daily challenge: its rules, the day's seeded reels and the re-spins used.
  const [daily, setDaily] = useState<DailyResponse | null>(null);
  const dailyRandom = useRef<(() => number) | null>(null);
  const [respinsUsed, setRespinsUsed] = useState(0);
  // Casual draft: free re-spins used (then bought re-spins are spent).
  const [freeRespinsUsed, setFreeRespinsUsed] = useState(0);
  // Daily practice try (store item): not recorded, not ranked.
  const [practice, setPractice] = useState(false);
  // A finished tournament with a Second chance available: offer it before leaving.
  const [offerSecondChance, setOfferSecondChance] = useState(false);
  // Draft settings sheet (tune button).
  const [showSettings, setShowSettings] = useState(false);
  const showLinks = useProgress().settings.showLinks;
  const { wallet } = useWallet();
  const respinTokens = wallet?.consumables.respin ?? 0;
  const secondChances = wallet?.consumables['second-chance'] ?? 0;
  // A shared squad someone wants to play against ("Challenge this XI").
  const challenge = usePendingChallenge();
  // The challenged squad, kept while its match is played (the pending one is cleared at kick-off).
  const [challenged, setChallenged] = useState<SquadDetail | null>(null);

  useHideTabBar(drawing || showSummary || showTournaments);

  const roles = formation ? formationRoles(formation) : [];
  const spots = formation ? formationLayout(formation).map((s, i) => ({ code: s.code, role: roles[i] })) : [];
  const openSpots = spots.filter((_, i) => !lineup[i]);
  const lineupFull = lineup.length > 0 && lineup.every(Boolean);
  const useBench = !daily;
  const benchCount = bench.filter(Boolean).length;
  const benchOpen = useBench && benchCount < BENCH_SIZE;
  // The squad is complete with a full XI and (arcade) at least BENCH_MIN substitutes.
  const squadReady = lineupFull && (!useBench || benchCount >= BENCH_MIN);
  const placed = lineup.filter((p): p is DraftPick => !!p);
  // Dummy players have no rating and add nothing.
  const ratingTotal = placed.reduce((sum, p) => sum + (p.player.rating ?? 0), 0);
  // Main position = blue, other position = gold, no fit = can't be placed there.
  const fits: PositionFit[] = spots.map((spot, i) =>
    pending && !lineup[i] ? positionFit(pending.player, spot) : null,
  );
  const lineupPlayers = useMemo(
    () => lineup.map((p) => (p ? (p.player.id === captainId ? { ...p.player, captain: true } : p.player) : null)),
    [lineup, captainId],
  );
  const benchPlayers = useMemo(() => bench.map((p) => p?.player ?? null), [bench]);
  const captainSpot = lineup.findIndex((p) => !!p && p.player.id === captainId);
  const chemistry = useMemo(
    () => (formation ? computeChemistry(formation, lineupPlayers) : null),
    [formation, lineupPlayers],
  );
  const pendingPreview = useMemo(
    () => (formation && pending ? chemistryPreview(formation, lineupPlayers, pending.player) : null),
    [formation, lineupPlayers, pending],
  );
  const chemistryGain = useCallback(
    (player: DraftPlayer) =>
      formation ? (chemistryPreview(formation, lineupPlayers, player).best?.gain ?? null) : null,
    [formation, lineupPlayers],
  );
  const moving = selected !== null && formation ? lineup[selected] : null;
  const moveFits: (PositionFit | 'out')[] = spots.map((spot, i) =>
    moving && formation && i !== selected && lineup[i] && !isLockedSpot(formation, i)
      ? (positionFit(moving.player, spot) ?? 'out')
      : null,
  );
  const moveGains = useMemo(() => {
    if (selected === null || !formation || !chemistry) return undefined;
    return lineupPlayers.map((_, i) => {
      const next = swapSpots(formation, lineupPlayers, selected, i);
      return next ? computeChemistry(formation, next).team - chemistry.team : null;
    });
  }, [selected, formation, lineupPlayers, chemistry]);
  // Players of a legends partnership get the gold name tag.
  const pillars = useMemo(() => {
    const set = new Set<number>();
    chemistry?.links.forEach((l) => l.kind === 'legends' && (set.add(l.a), set.add(l.b)));
    return lineup.map((_, i) => set.has(i));
  }, [chemistry, lineup]);

  const contentWidth = width - 32;
  // Header, top bar, stats and badges above the pitch; helper, buttons and tab bar below.
  const pitchWidth = Math.min(
    contentWidth,
    (height - insets.top - insets.bottom - HEADER_HEIGHT - 130 - 110 - NAV_ROOM) / 1.25,
  );

  const startGame = (d: DailyResponse | null = null, practiceTry = false) => {
    gameId.current += 1;
    setPractice(practiceTry);
    setFreeRespinsUsed(0);
    setStarted(true);
    setFormation(null);
    setShowPitch(false);
    setSquadId(null);
    setDaily(d);
    setRespinsUsed(0);
    // Everyone gets the same reels on the same day.
    dailyRandom.current = d ? seededRandom(`${d.date}|${d.challenge.id}`) : null;
    if (d && !practiceTry) startDailyAttempt(d.date, d.challenge.title);
    const locked = d?.challenge.rules.formation;
    if (locked) requestAnimationFrame(() => handleResult(locked));
    else requestAnimationFrame(() => reel.current?.spin());
  };

  const handleResult = (result: Formation) => {
    const id = gameId.current;
    setFormation(result);
    setLineup(formationLayout(result).map(() => null));
    setBench(EMPTY_BENCH);
    setCaptainId(null);
    setCard(null);
    pitchTimer.current = setTimeout(() => {
      if (id === gameId.current) setShowPitch(true);
    }, 800);
  };

  const closeGame = () => {
    gameId.current += 1;
    clearTimeout(pitchTimer.current);
    setStarted(false);
    setLineup([]);
    setFormation(null);
    setShowPitch(false);
    setDrawing(false);
    setPending(null);
    setSelected(null);
    setShowSummary(false);
    setShowTournaments(false);
    setTournament(null);
    setAutofilling(false);
    setSquadId(null);
    setFinished(false);
    setDaily(null);
    dailyRandom.current = null;
    setRespinsUsed(0);
    setBench(EMPTY_BENCH);
    setCaptainId(null);
    setCard(null);
    setPractice(false);
    setFreeRespinsUsed(0);
    setOfferSecondChance(false);
    clearCurrentSquad();
  };

  const spin = () => {
    setSelected(null);
    setDrawId((id) => id + 1);
    setDrawing(true);
  };

  const autocomplete = async () => {
    const id = gameId.current;
    setSelected(null);
    setAutofilling(true);
    const cancelled = () => id !== gameId.current;
    const next = await autofillLineup(spots, lineup, cancelled);
    if (cancelled()) return;
    setLineup(next);
    if (useBench) {
      const subs = await autofillBench(bench, next, cancelled);
      if (cancelled()) return;
      setBench(subs);
    }
    setAutofilling(false);
  };

  const complete = () => {
    if (!formation) return;
    setSelected(null);
    if (squadId === null) {
      const s = squadSummary(formation, lineupPlayers);
      const names = placed
        .slice()
        .sort((a, b) => (b.player.rating ?? 0) - (a.player.rating ?? 0))
        .map((p) => p.player.name.split(' ').slice(-1)[0]!);
      setSquadId(recordDraft({ formation, overall: s.overall, chemistry: s.chemistry.team, names }));
      recordProgress({
        kind: 'draft',
        draft: {
          formation,
          overall: s.overall,
          chemistry: s.chemistry.team,
          bonuses: s.chemistry.bonuses.map((b) => b.id),
          players: placed.map((p) => ({ name: p.player.name, league: p.league, club: p.club, decade: p.decade })),
        },
      });
      // Ready to be saved on the leaderboard (players in spot order).
      setCurrentSquad({
        formation,
        overall: s.overall,
        rating: s.rating,
        chemistry: s.chemistry.team,
        players: lineup.flatMap((p, i): SavedPlayer[] =>
          p
            ? [
                {
                  spot: spots[i]!.code,
                  role: roles[i]!,
                  name: p.player.name,
                  rating: p.player.rating ?? null,
                  club: p.club,
                  decade: p.decade,
                  league: p.league,
                },
              ]
            : [],
        ),
      });
    }
    setShowSummary(true);
  };

  const dailyRules: DraftRules | undefined = daily
    ? {
        decades: daily.challenge.rules.decades,
        leagues: daily.challenge.rules.leagues,
        random: dailyRandom.current ?? undefined,
        respinsLeft:
          daily.challenge.rules.maxRespins === undefined
            ? null
            : Math.max(0, daily.challenge.rules.maxRespins - respinsUsed),
        onRespin: () => setRespinsUsed((n) => n + 1),
      }
    : undefined;

  // Casual draft: FREE_RESPINS_PER_DRAFT free re-spins per squad, then bought ones (store).
  const casualRules: DraftRules = {
    respinsLeft: Math.max(0, FREE_RESPINS_PER_DRAFT - freeRespinsUsed) + respinTokens,
    onRespin: () => {
      if (freeRespinsUsed < FREE_RESPINS_PER_DRAFT) setFreeRespinsUsed((n) => n + 1);
      else void consumeItem('respin');
    },
  };

  // Leaving a finished tournament: with a Second chance in the wallet, offer one more first.
  const endTournament = () => {
    if (!daily && secondChances > 0) setOfferSecondChance(true);
    else closeGame();
  };
  const takeSecondChance = async () => {
    setOfferSecondChance(false);
    if (!(await consumeItem('second-chance'))) return closeGame();
    setFinished(false);
    setTournament(null);
    setShowTournaments(true);
  };

  const handlePick = (pick: DraftPick) => {
    setDrawing(false);
    setPending(pick);
  };

  const placeOnBench = (index: number) => {
    if (!pending || bench[index]) return;
    setBench((prev) => prev.map((p, i) => (i === index ? pending : p)));
    setPending(null);
  };

  const pressBench = (index: number) => {
    if (pending) return placeOnBench(index);
    if (bench[index]) {
      setSelected(null);
      setCard({ kind: 'bench', index });
    }
  };

  const toggleCaptain = () => {
    const p = selected !== null ? lineup[selected] : null;
    if (!p) return;
    setCaptainId((id) => (id === p.player.id ? null : p.player.id));
    setSelected(null);
  };

  const placeOnSpot = (index: number) => {
    if (!pending || !fits[index]) return;
    setLineup((prev) => prev.map((p, i) => (i === index ? pending : p)));
    setPending(null);
  };

  // Tap a placed player to pick him up, tap another placed player to swap them, tap him again to
  // cancel. Empty spots and the goalkeeper don't take part. Out of position costs chemistry.
  const pressSpot = (index: number) => {
    if (pending) return placeOnSpot(index);
    if (!formation) return;
    if (selected === null) {
      // Any placed player (the goalkeeper too) can be picked up for his card or the armband.
      if (lineup[index]) setSelected(index);
      return;
    }
    if (index !== selected) {
      const next = swapSpots(formation, lineup, selected, index);
      if (next) setLineup(next);
    }
    setSelected(null);
  };

  // Waiting pick: fitting empty spots. Otherwise any placed player; while one is picked up, the
  // swap targets and himself (to cancel). The goalkeeper never swaps.
  const pitchPressable = spots.map((_, i) => {
    if (pending) return !!fits[i];
    if (!formation || !lineup[i]) return false;
    if (selected === null || i === selected) return true;
    return !isLockedSpot(formation, i) && !isLockedSpot(formation, selected);
  });

  // Player card: the player, where he was drafted from, and his links to the rest of the squad.
  const cardPick = card ? (card.kind === 'xi' ? lineup[card.index] : bench[card.index]) : null;
  const cardLinks = useMemo((): CardLink[] => {
    if (!card || !cardPick) return [];
    const others: { pick: DraftPick; target: CardTarget }[] = [
      ...lineup.flatMap((p, index) => (p ? [{ pick: p, target: { kind: 'xi' as const, index } }] : [])),
      ...bench.flatMap((p, index) => (p ? [{ pick: p, target: { kind: 'bench' as const, index } }] : [])),
    ].filter((o) => !(o.target.kind === card.kind && o.target.index === card.index));
    return others
      .map((o) => {
        const link = linkBetween(cardPick.player.chemistry, o.pick.player.chemistry);
        return { name: o.pick.player.name, label: linkLabel(link), value: link.value, target: o.target };
      })
      .filter((l) => l.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [card, cardPick, lineup, bench]);

  if (!started) {
    return (
      <HomeLanding
        onStart={() => startGame()}
        onDaily={(d) => startGame(d)}
        onPractice={async (d) => {
          if (await consumeItem('daily-practice')) startGame(d, true);
        }}
      />
    );
  }

  const overall = formation ? squadSummary(formation, lineupPlayers).overall : 0;
  const nextSpot = openSpots[0]?.code;

  return (
    <View style={styles.screen}>
      <ScreenHeader title={daily ? 'Daily Challenge' : 'Home'} />

      {/* Formation reel */}
      {!showPitch && (
        <View style={[styles.center, { paddingTop: insets.top + HEADER_HEIGHT, paddingBottom: NAV_ROOM }]}>
          <View style={[styles.spinCard, { width: contentWidth }]}>
            <Txt v="capUpper" color={C.green} style={{ letterSpacing: 1 }}>
              {daily?.challenge.rules.formation ? 'LOCKED FORMATION' : 'SPINNING FORMATION'}
            </Txt>
            <Txt v="h24">Your tactic</Txt>
            <View style={styles.chamber}>
              <SlotReel
                ref={reel}
                items={FORMATIONS}
                width={contentWidth - 48}
                rowHeight={56}
                visibleRows={5}
                fontSize={26}
                random={dailyRandom.current ?? undefined}
                onResult={handleResult}
              />
              <View pointerEvents="none" style={styles.payline}>
                <View style={styles.paylineBar} />
                <View style={styles.paylineBar} />
              </View>
            </View>
            <Txt v="h28" color={formation ? C.gold : C.textDim}>
              {formation ?? '…'}
            </Txt>
          </View>
        </View>
      )}

      {/* Pitch & team building */}
      {showPitch && formation && (
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + HEADER_HEIGHT, paddingBottom: NAV_ROOM + insets.bottom }}
          showsVerticalScrollIndicator={false}>
          <View style={styles.top}>
            <View style={styles.between}>
              <Pressable
                onPress={closeGame}
                accessibilityRole="button"
                accessibilityLabel="Back to home"
                style={styles.roundBtn}>
                <Icon name="close" size={18} color={C.text} />
              </Pressable>
              <View style={{ alignItems: 'center' }}>
                <Txt v="capUpper" color={C.green} style={{ letterSpacing: 1 }}>
                  ACTIVE TACTIC
                </Txt>
                <View style={styles.row4}>
                  <Txt v="h24" style={{ letterSpacing: 1.2 }}>
                    {formation}
                  </Txt>
                  <Icon name="expand_more" size={16} color={C.green} />
                </View>
              </View>
              <Pressable
                onPress={() => setShowSettings(true)}
                accessibilityRole="button"
                accessibilityLabel="Draft settings"
                style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.7 }]}>
                <Icon name="tune" size={18} color={C.text} />
              </Pressable>
            </View>

            <View style={styles.ticker}>
              <View style={styles.row4}>
                <Txt v="capUpper" color={C.textMuted} style={{ letterSpacing: 0.6 }}>
                  RATING
                </Txt>
                <View style={[styles.tick, { backgroundColor: alpha(C.blue, 0.2) }]}>
                  <Txt v="num13" color={C.blueLight} style={{ lineHeight: 13 }}>
                    {formatRating(ratingTotal)}
                  </Txt>
                </View>
              </View>
              <View style={styles.tickDot} />
              <View style={styles.row4}>
                <Txt v="capUpper" color={C.textMuted} style={{ letterSpacing: 0.6 }}>
                  SQUAD
                </Txt>
                <View style={[styles.tick, { backgroundColor: C.surface4 }]}>
                  <Txt v="num13" style={{ lineHeight: 13 }}>
                    {placed.length}/{lineup.length}
                  </Txt>
                </View>
              </View>
              <View style={styles.tickDot} />
              <View style={styles.row4}>
                <Txt v="capUpper" color={C.textMuted} style={{ letterSpacing: 0.6 }}>
                  CHEM
                </Txt>
                <View style={[styles.tick, styles.row2, { backgroundColor: alpha(C.gold, 0.15) }]}>
                  <Icon name="bolt" size={11} color={C.gold} />
                  <Txt v="num13" color={C.gold} style={{ lineHeight: 13 }}>
                    {chemistry?.team ?? 0}
                  </Txt>
                </View>
              </View>
            </View>

            {!!chemistry?.bonuses.length && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badges}>
                {chemistry.bonuses.map((b) =>
                  b.id === 'dynasty' ? (
                    <Chip
                      key={b.id}
                      label={b.label}
                      icon="stars"
                      color={C.goldLight}
                      bg={alpha(C.goldDeep, 0.2)}
                      radius={R.pill}
                    />
                  ) : (
                    <Chip
                      key={b.id}
                      label={b.label}
                      icon="stars"
                      color={C.greenLight}
                      bg={alpha(C.greenStrong, 0.2)}
                      radius={R.pill}
                    />
                  ),
                )}
              </ScrollView>
            )}
          </View>

          <View style={styles.pitchWrap}>
            <FormationPitch
              kitColor={kit}
              formation={formation}
              width={pitchWidth}
              highlighted={pending ? fits : moving ? moveFits : undefined}
              pressable={pitchPressable}
              selected={selected}
              captain={captainSpot >= 0 ? captainSpot : undefined}
              labels={lineup.map((p) => p?.player.name.split(' ').slice(-1)[0] ?? null)}
              ratings={lineup.map((p) => p?.player.rating ?? null)}
              pillars={pillars}
              onPlayerPress={pressSpot}
              links={showLinks ? chemistry?.links : undefined}
              chemistry={chemistry?.players}
              gains={
                pendingPreview
                  ? pendingPreview.bySpot.map((team) => (team === null ? null : team - pendingPreview.current))
                  : moveGains
              }
              tag={daily ? 'DAILY CHALLENGE' : placed[0] ? `ARCADE ${placed[0].decade}S` : 'ARCADE MODE'}
            />
          </View>

          <View style={styles.bottom}>
            <View style={styles.callout}>
              <Icon name="info" size={15} color={C.textMuted} />
              <Txt v="body" color={C.textMuted} style={styles.flex}>
                {moving ? (
                  <>
                    Swap{' '}
                    <Txt v="bodyBold" color={C.gold}>
                      {moving.player.name}
                    </Txt>
                    {isLockedSpot(formation, selected!)
                      ? ': the goalkeeper stays in goal. Open his card or give him the armband; tap him again to cancel.'
                      : ': tap another player to swap. Red = out of position (−1 chemistry). Tap him again to cancel.'}
                  </>
                ) : pending ? (
                  <>
                    Place{' '}
                    <Txt v="bodyBold" color={C.blueLight}>
                      {pending.player.name}
                    </Txt>{' '}
                    ({ROLE_TITLES[pending.player.position].slice(0, -1)}
                    {pending.player.rating !== undefined && ` · Rtg ${formatRating(pending.player.rating)}`}) on a blue
                    (main position) or gold (other position) spot
                    {pendingPreview?.best && pendingPreview.best.gain > 0
                      ? ` · up to +${pendingPreview.best.gain} chemistry`
                      : ''}
                  </>
                ) : lineupFull && !squadReady ? (
                  <>
                    XI complete. Draft at least{' '}
                    <Txt v="bodyBold" color={C.gold}>
                      {BENCH_MIN - benchCount} more
                    </Txt>{' '}
                    for the bench: substitutes rest your starters over a league season.
                  </>
                ) : lineupFull ? (
                  <>
                    Squad full. Tap{' '}
                    <Txt v="bodyBold" color={C.blueLight}>
                      Complete
                    </Txt>{' '}
                    for the summary, or tap two players to swap them.
                  </>
                ) : (
                  <>
                    Tap{' '}
                    <Txt v="bodyBold" color={C.blueLight}>
                      Spin
                    </Txt>{' '}
                    to draft next player, or{' '}
                    <Txt v="bodySemi" color={C.text}>
                      Autocomplete
                    </Txt>{' '}
                    to fill the rest.
                  </>
                )}
              </Txt>
            </View>

            {useBench && <BenchRow bench={bench} min={BENCH_MIN} placing={!!pending} onPress={pressBench} />}

            {moving && selected !== null && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.actions}>
                <Btn
                  kind="dark"
                  icon="person"
                  label="PLAYER CARD"
                  onPress={() => {
                    setCard({ kind: 'xi', index: selected });
                    setSelected(null);
                  }}
                  style={styles.flex}
                />
                <Btn
                  kind="gold"
                  icon="military_tech"
                  label={captainSpot === selected ? 'REMOVE ARMBAND' : 'MAKE CAPTAIN'}
                  sub="+1 chemistry to his neighbours"
                  onPress={toggleCaptain}
                  style={styles.flex}
                />
              </Animated.View>
            )}

            {!pending && !moving && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.actions}>
                {squadReady ? (
                  <Btn
                    kind="blue"
                    icon="check_circle"
                    label="COMPLETE SQUAD"
                    sub={daily ? 'Check the challenge' : 'Summary & tournaments'}
                    onPress={complete}
                    style={styles.flex}
                  />
                ) : (
                  <>
                    {!daily && (
                      <Btn
                        kind="dark"
                        icon="auto_awesome"
                        label={autofilling ? 'FILLING…' : 'AUTOCOMPLETE'}
                        accessibilityLabel="Autocomplete: fill all empty spots with random players"
                        disabled={autofilling}
                        onPress={autocomplete}
                        style={styles.flex}
                      />
                    )}
                    <Btn
                      kind="blue"
                      icon="casino"
                      label="⚡ SPIN DRAFT"
                      sub={nextSpot ? `SLOT REEL ${nextSpot}` : benchOpen ? 'BENCH' : undefined}
                      disabled={autofilling}
                      onPress={spin}
                      style={styles.flex}
                    />
                  </>
                )}
              </Animated.View>
            )}
          </View>
        </ScrollView>
      )}

      {drawing && (
        <DraftSpin
          key={drawId}
          openSpots={openSpots}
          benchOpen={benchOpen}
          taken={[...lineup, ...bench].flatMap((p) => (p ? [p.player.name] : []))}
          onPick={handlePick}
          chemistryGain={chemistryGain}
          teamChemistry={chemistry?.team ?? 0}
          rules={dailyRules ?? casualRules}
        />
      )}

      {card && cardPick && formation && (
        <PlayerCard
          key={`${card.kind}${card.index}`}
          player={card.kind === 'xi' ? lineupPlayers[card.index]! : cardPick.player}
          drafted={{ club: cardPick.club, decade: cardPick.decade, league: cardPick.league }}
          role={card.kind === 'xi' ? `${spots[card.index]?.code ?? ''}` : `SUB · ${cardPick.player.position}`}
          captain={card.kind === 'xi' && card.index === captainSpot}
          links={cardLinks}
          onOpen={setCard}
          onClose={() => setCard(null)}
        />
      )}

      {showSummary && formation && !showTournaments && (
        <SquadSummary
          formation={formation}
          lineup={lineup}
          onClose={() => setShowSummary(false)}
          onNewGame={() => {
            closeGame();
            startGame();
          }}
          onStartTournament={() => setShowTournaments(true)}
          startLabel={daily ? 'Check challenge' : 'Start tournament'}
        />
      )}

      {showTournaments && formation && daily && (
        <DailyResult
          daily={daily}
          formation={formation}
          lineup={lineupPlayers}
          overall={overall}
          chemistry={chemistry?.team ?? 0}
          onHome={closeGame}
          onResult={practice ? undefined : reportResult}
          practice={practice}
        />
      )}

      {showSettings && (
        <DraftSettings
          respins={
            daily
              ? null
              : { freeLeft: Math.max(0, FREE_RESPINS_PER_DRAFT - freeRespinsUsed), bought: respinTokens }
          }
          onRestart={
            daily
              ? undefined
              : () => {
                  setShowSettings(false);
                  closeGame();
                  startGame();
                }
          }
          onClose={() => setShowSettings(false)}
        />
      )}

      {offerSecondChance && (
        <View style={styles.offer}>
          <View style={styles.offerCard}>
            <Icon name="replay" size={28} color={C.gold} />
            <Txt v="h20">Second chance?</Txt>
            <Txt v="body" color={C.textMuted} style={{ textAlign: 'center' }}>
              This XI can play one more tournament. You have {secondChances}.
            </Txt>
            <Btn kind="gold" label="PLAY ANOTHER TOURNAMENT" height={48} onPress={takeSecondChance} style={{ alignSelf: 'stretch' }} />
            <Btn kind="dark" label="NO, NEW GAME" height={44} onPress={closeGame} style={{ alignSelf: 'stretch' }} />
          </View>
        </View>
      )}

      {showTournaments &&
        formation &&
        !daily &&
        (tournament === 'random-league' || tournament === 'league' ? (
          <LeagueTournament
            key={tournament}
            mode={tournament === 'random-league' ? 'random' : 'pick'}
            formation={formation}
            lineup={lineupPlayers}
            bench={benchPlayers}
            overall={overall}
            chemistry={chemistry?.team ?? 0}
            squadId={squadId}
            onBack={() => (finished ? endTournament() : setTournament(null))}
            onMode={
              finished
                ? undefined
                : (m) => setTournament(m === 'match' ? 'match' : m === 'cup' ? 'champions-league' : 'league')
            }
            onFinished={() => setFinished(true)}
            onNewGame={() => {
              closeGame();
              startGame();
            }}
            onExit={closeGame}
            onResult={reportResult}
            onRandom={(random) => setTournament(random ? 'random-league' : 'league')}
          />
        ) : tournament === 'champions-league' || tournament === 'random-champions-league' ? (
          <CupTournament
            key={tournament}
            mode={tournament === 'random-champions-league' ? 'random' : 'pick'}
            formation={formation}
            lineup={lineupPlayers}
            overall={overall}
            chemistry={chemistry?.team ?? 0}
            onBack={() => (finished ? endTournament() : setTournament(null))}
            onMode={
              finished
                ? undefined
                : (m) => setTournament(m === 'match' ? 'match' : m === 'cup' ? 'champions-league' : 'league')
            }
            onFinished={() => setFinished(true)}
            onNewGame={() => {
              closeGame();
              startGame();
            }}
            onExit={closeGame}
            onResult={reportResult}
            onRandom={(random) => setTournament(random ? 'random-champions-league' : 'champions-league')}
          />
        ) : tournament === 'match' ? (
          <MatchSetup
            formation={formation}
            lineup={lineupPlayers}
            overall={overall}
            chemistry={chemistry?.team ?? 0}
            onBack={() => (finished ? endTournament() : setTournament(null))}
            onMode={
              finished
                ? undefined
                : (m) => setTournament(m === 'match' ? 'match' : m === 'cup' ? 'champions-league' : 'league')
            }
            onFinished={() => setFinished(true)}
            onNewGame={() => {
              closeGame();
              startGame();
            }}
            onExit={closeGame}
            onResult={reportResult}
          />
        ) : tournament === 'legends' ? (
          <LegendsTournament
            formation={formation}
            lineup={lineupPlayers}
            overall={overall}
            chemistry={chemistry?.team ?? 0}
            onBack={() => (finished ? endTournament() : setTournament(null))}
            onFinished={() => setFinished(true)}
            onNewGame={() => {
              closeGame();
              startGame();
            }}
            onExit={closeGame}
            onResult={reportResult}
          />
        ) : tournament === 'challenge' && challenged ? (
          <ChallengeMatch
            squad={challenged}
            formation={formation}
            lineup={lineupPlayers}
            overall={overall}
            chemistry={chemistry?.team ?? 0}
            onBack={() => (finished ? endTournament() : setTournament(null))}
            onFinished={() => setFinished(true)}
            onNewGame={() => {
              closeGame();
              startGame();
            }}
            onExit={closeGame}
            onResult={reportResult}
          />
        ) : tournament === 'h2h' ? (
          <H2HMatch
            formation={formation}
            lineup={lineupPlayers}
            overall={overall}
            chemistry={chemistry?.team ?? 0}
            onBack={() => (finished ? endTournament() : setTournament(null))}
            onFinished={() => setFinished(true)}
            onNewGame={() => {
              closeGame();
              startGame();
            }}
            onExit={closeGame}
            onResult={reportResult}
          />
        ) : tournament ? (
          <TournamentShell title={TOURNAMENT_LABELS[tournament]} onBack={() => setTournament(null)}>
            <View style={styles.soon}>
              <Txt v="h24">{TOURNAMENT_LABELS[tournament]}</Txt>
              <Txt v="body" color={C.textMuted}>
                Coming soon
              </Txt>
            </View>
          </TournamentShell>
        ) : (
          <TournamentPicker
            overall={overall}
            chemistry={chemistry?.team ?? 0}
            onPick={(mode) => {
              if (mode === 'challenge') setChallenged(challenge);
              setTournament(mode);
            }}
            onBack={() => setShowTournaments(false)}
            challenge={challenge}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  offer: {
    ...StyleSheet.absoluteFill,
    zIndex: 70,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  offerCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderRadius: R.xl,
    backgroundColor: C.surface,
  },
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinCard: {
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: R.xl,
    backgroundColor: alpha(C.surface, 0.95),
    boxShadow: '0px 20px 50px rgba(0,0,0,0.85)',
  },
  chamber: {
    padding: 8,
    borderRadius: R.lg,
    backgroundColor: C.deep,
    overflow: 'hidden',
    boxShadow: 'inset 0px 4px 16px rgba(0,0,0,0.9)',
  },
  payline: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 8 + 56 * 2,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
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
  top: {
    gap: 4,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row4: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  flex: {
    flex: 1,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: R.pill,
    backgroundColor: C.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: SHADOW_SM,
  },
  ticker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: alpha(C.surface, 0.9),
    boxShadow: '0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)',
  },
  tick: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: R.xs,
  },
  tickDot: {
    width: 4,
    height: 4,
    borderRadius: R.pill,
    backgroundColor: C.divider,
  },
  badges: {
    gap: 6,
    paddingVertical: 2,
  },
  pitchWrap: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  bottom: {
    gap: 4,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: R.md,
    backgroundColor: C.surface,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  soon: {
    alignItems: 'center',
    gap: 4,
    padding: 24,
    borderRadius: R.md,
    backgroundColor: C.surface,
  },
});
