import {
  DRAFT_BOOSTS,
  FREE_RESPINS_PER_DRAFT,
  chemistryPreview,
  computeChemistry,
  formationLayout,
  formationRoles,
  isLockedSpot,
  linkBetween,
  linkLabel,
  positionFit,
  squadSummary,
  swapSpots,
  type DailyResponse,
  type DraftBoostId,
  type Formation,
  type PlayerRole,
  type PositionFit,
  type SavedPlayer,
  type SquadDetail,
  type TournamentMode,
} from '@champion/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import type { DraftPick, DraftRules } from '@/components/draft-spin';
import type { CardLink, CardTarget } from '@/components/player-card';
import type { SlotReelHandle } from '@/components/slot-reel';
import type { EndActions } from '@/components/tournament-shell';
import { showInterstitialAfterGame } from '@/game/ads';
import { track } from '@/game/analytics';
import { autofillBench, autofillLineup } from '@/game/autofill';
import { usePendingChallenge } from '@/game/challenge';
import { dailyReels, loadDailyDraft, saveDailyDraft, startDailyAttempt } from '@/game/daily';
import { clearCurrentSquad, secondChanceOnline, setCurrentSquad } from '@/game/online';
import { recordProgress, useProgress } from '@/game/progress';
import { recordDraft } from '@/game/session';
import { consumeItem, useWallet } from '@/game/wallet';
import type { DraftPlayer } from '@/mocks/players';

import { BENCH_MIN, BENCH_SIZE, EMPTY_BENCH } from './constants';

/**
 * One draft from the formation reel to the finished tournament: the squad being built (XI, bench,
 * captain), what the player is doing with it right now (placing a pick, moving a starter, bringing
 * on a substitute), the Daily's rules and seeded reels, boosts and re-spins, and the tournament the
 * finished squad plays. The Home screen renders it with the components of this folder.
 */
export function useDraft() {
  const reel = useRef<SlotReelHandle>(null);
  const [started, setStarted] = useState(false);
  const [formation, setFormation] = useState<Formation | null>(null);
  const [showPitch, setShowPitch] = useState(false);
  const [drawing, setDrawing] = useState(false);
  // Remounts the draft reels on every spin so they start fresh.
  const [drawId, setDrawId] = useState(0);
  const [lineup, setLineup] = useState<(DraftPick | null)[]>([]);
  // Substitutes (arcade only, optional): up to BENCH_SIZE, rotated in over a league season.
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
  // The Daily's seeded reels (read while rendering, so state – not a ref). The function keeps its own
  // position in the seed, so it is set once per draft and never replaced mid-draft.
  const [dailyRandom, setDailyRandom] = useState<(() => number) | null>(null);
  // How many seeded reel draws the Daily has used (saved with the draft, to continue it exactly).
  const dailyCalls = useRef<(() => number) | null>(null);
  const [respinsUsed, setRespinsUsed] = useState(0);
  // Draft boost used in this draft (casual only): the club reel favours clubs with top-rated players.
  const [boost, setBoost] = useState<DraftBoostId | null>(null);
  const [activatingBoost, setActivatingBoost] = useState<DraftBoostId | null>(null);
  // Casual draft: free re-spins used (then bought re-spins are spent).
  const [freeRespinsUsed, setFreeRespinsUsed] = useState(0);
  // Daily practice try (store item): not recorded, not ranked.
  const [practice, setPractice] = useState(false);
  // A finished tournament with a Second chance available: offer it before leaving.
  const [offerSecondChance, setOfferSecondChance] = useState(false);
  // Draft settings sheet (tune button) and formation info (tap the formation name).
  const [showSettings, setShowSettings] = useState(false);
  const [showFormation, setShowFormation] = useState(false);
  const showLinks = useProgress().settings.showLinks;
  const { wallet } = useWallet();
  const respinTokens = wallet?.consumables.respin ?? 0;
  const secondChances = wallet?.consumables['second-chance'] ?? 0;
  // A shared squad someone wants to play against ("Challenge this XI").
  const challenge = usePendingChallenge();
  // The challenged squad, kept while its match is played (the pending one is cleared at kick-off).
  const [challenged, setChallenged] = useState<SquadDetail | null>(null);

  const roles = formation ? formationRoles(formation) : [];
  const spots = formation ? formationLayout(formation).map((s, i) => ({ code: s.code, role: roles[i] })) : [];
  const openSpots = spots.filter((_, i) => !lineup[i]);
  const lineupFull = lineup.length > 0 && lineup.every(Boolean);
  const useBench = !daily;
  const benchCount = bench.filter(Boolean).length;
  const benchOpen = useBench && benchCount < BENCH_SIZE;
  // The squad is complete with a full XI (the bench is optional, BENCH_MIN = 0).
  const squadReady = lineupFull && (!useBench || benchCount >= BENCH_MIN);
  const placed = lineup.filter((p): p is DraftPick => !!p);
  // Pitch tag: the era only when the whole XI so far comes from one decade.
  const placedDecades = new Set(placed.map((p) => p.decade));
  const arcadeTag =
    placedDecades.size === 1
      ? `ARCADE ${placed[0]!.decade}S`
      : placedDecades.size > 1
        ? `ARCADE · ${placedDecades.size} DECADES`
        : 'ARCADE MODE';
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
  // Substitute picked up from the bench: tap a starter to swap them (goalkeepers only for goalkeepers).
  const [subbing, setSubbing] = useState<number | null>(null);
  const sub = subbing !== null ? bench[subbing] : null;
  const canSwapWithBench = (spot: number, pick: DraftPick | null | undefined) =>
    !!formation && !!pick && !!lineup[spot] && isLockedSpot(formation, spot) === (pick.player.position === 'GK');
  const subFits: (PositionFit | 'out')[] = spots.map((spot, i) =>
    sub && canSwapWithBench(i, sub) ? (positionFit(sub.player, spot) ?? 'out') : null,
  );
  const subGains = useMemo(() => {
    if (!sub || !formation || !chemistry) return undefined;
    return lineupPlayers.map((p, i) => {
      if (!p || isLockedSpot(formation, i) !== (sub.player.position === 'GK')) return null;
      const next = lineupPlayers.map((q, k) => (k === i ? sub.player : q));
      return computeChemistry(formation, next).team - chemistry.team;
    });
  }, [sub, formation, lineupPlayers, chemistry]);
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

  const startGame = (
    d: DailyResponse | null = null,
    practiceTry = false,
    /** "Draft again": skip the formation reel and use this one. */
    keepFormation: Formation | null = null,
  ) => {
    gameId.current += 1;
    if (!practiceTry) track('draft_start', { mode: d ? 'daily' : 'arcade' });
    setPractice(practiceTry);
    setFreeRespinsUsed(0);
    setBoost(null);
    setStarted(true);
    setFormation(null);
    setShowPitch(false);
    setSquadId(null);
    setDaily(d);
    setRespinsUsed(0);
    // Everyone gets the same reels on the same day. A Daily draft that was left continues where it
    // was: same squad, same re-spins, the reels rewound to the same draw.
    const saved = d && !practiceTry ? loadDailyDraft(d.date, d.challenge.id) : null;
    const reels = d ? dailyReels(`${d.date}|${d.challenge.id}`, saved?.randomCalls ?? 0) : null;
    setDailyRandom(() => reels?.random ?? null);
    dailyCalls.current = reels?.calls ?? null;
    if (d && !practiceTry) startDailyAttempt(d.date, d.challenge.title);
    if (saved) {
      setFormation(saved.formation as Formation);
      setLineup(saved.lineup);
      setPending(saved.pending);
      setCaptainId(saved.captainId);
      setRespinsUsed(saved.respinsUsed);
      setBench(EMPTY_BENCH);
      setCard(null);
      setShowPitch(true);
      return;
    }
    const locked = d?.challenge.rules.formation ?? keepFormation;
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

  // The Daily draft is saved after every step (never mid-spin), so leaving doesn't cost the attempt.
  useEffect(() => {
    const calls = dailyCalls.current;
    if (!daily || practice || drawing || !formation || !calls) return;
    saveDailyDraft({
      date: daily.date,
      challengeId: daily.challenge.id,
      formation,
      lineup,
      pending,
      captainId,
      respinsUsed,
      randomCalls: calls(),
    });
  }, [daily, practice, drawing, formation, lineup, pending, captainId, respinsUsed]);

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
    setSubbing(null);
    setShowSummary(false);
    setShowTournaments(false);
    setTournament(null);
    setAutofilling(false);
    setSquadId(null);
    setFinished(false);
    setDaily(null);
    setDailyRandom(null);
    dailyCalls.current = null;
    setRespinsUsed(0);
    setBench(EMPTY_BENCH);
    setCaptainId(null);
    setCard(null);
    setPractice(false);
    setFreeRespinsUsed(0);
    setBoost(null);
    setOfferSecondChance(false);
    clearCurrentSquad();
  };

  // One tap for the whole bench: fills the empty slots (same draw as Autocomplete).
  const autoBench = async () => {
    const id = gameId.current;
    setSelected(null);
    setAutofilling(true);
    const subs = await autofillBench(bench, lineup, () => id !== gameId.current);
    if (!subs) return;
    setBench(subs.picks);
    setAutofilling(false);
    fillFailed(subs.missing, autoBench);
  };

  const spin = () => {
    setSelected(null);
    setSubbing(null);
    setDrawId((id) => id + 1);
    setDrawing(true);
  };

  const autocomplete = async () => {
    const id = gameId.current;
    setSelected(null);
    setAutofilling(true);
    const cancelled = () => id !== gameId.current;
    const next = await autofillLineup(spots, lineup, cancelled);
    if (!next) return;
    setLineup(next.picks);
    let missing = next.missing;
    if (useBench && !missing) {
      const subs = await autofillBench(bench, next.picks, cancelled);
      if (!subs) return;
      setBench(subs.picks);
      missing = subs.missing;
    }
    setAutofilling(false);
    fillFailed(missing, autocomplete);
  };

  // Autofill never makes players up: slots it could not fill stay empty, with a retry.
  const fillFailed = (missing: number, retry: () => void) => {
    if (!missing) return;
    Alert.alert(
      `${missing} ${missing === 1 ? 'spot' : 'spots'} left empty`,
      'Could not load real players for them. Check your connection and try again, or spin them yourself.',
      [{ text: 'Close', style: 'cancel' }, { text: 'Try again', onPress: retry }],
    );
  };

  const complete = () => {
    if (!formation) return;
    setSelected(null);
    if (squadId === null) {
      track('draft_done', { mode: daily ? 'daily' : 'arcade' });
      const s = squadSummary(formation, lineupPlayers);
      const names = placed
        .slice()
        .sort((a, b) => (b.player.rating ?? 0) - (a.player.rating ?? 0))
        .map((p) => p.player.name.split(' ').slice(-1)[0]!);
      // Players in spot order: kept in the Hall of Fame and ready for the leaderboard.
      const players = lineup.flatMap((p, i): SavedPlayer[] =>
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
                ...(p.player.id === captainId ? { captain: true } : {}),
              },
            ]
          : [],
      );
      setSquadId(
        recordDraft({
          formation,
          overall: s.overall,
          chemistry: s.chemistry.team,
          names,
          players,
          createdAt: new Date().toISOString(),
        }),
      );
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
    }
    setShowSummary(true);
  };

  // The squad the server plays with (and the leaderboard shows): XI in spot order with the captain,
  // plus the bench. Kept in step with the draft once it is complete; a changed squad is a new one.
  useEffect(() => {
    if (squadId === null || !formation || !lineup.every(Boolean)) return;
    const s = squadSummary(formation, lineupPlayers);
    const codes = formationLayout(formation).map((x) => x.code);
    const lineRoles = formationRoles(formation);
    const saved = (p: DraftPick, spot: string, role: PlayerRole): SavedPlayer => ({
      spot,
      role,
      name: p.player.name,
      rating: p.player.rating ?? null,
      club: p.club,
      decade: p.decade,
      league: p.league,
      ...(p.player.id === captainId ? { captain: true } : {}),
    });
    setCurrentSquad({
      formation,
      overall: s.overall,
      rating: s.rating,
      chemistry: s.chemistry.team,
      players: lineup.map((p, i) => saved(p!, codes[i]!, lineRoles[i]!)),
      bench: bench.flatMap((p) => (p ? [saved(p, 'SUB', p.player.position)] : [])),
    }, { formation, lineup: lineupPlayers, bench: benchPlayers });
  }, [squadId, formation, lineup, lineupPlayers, bench, benchPlayers, captainId]);

  const dailyRules: DraftRules | undefined = daily
    ? {
        decades: daily.challenge.rules.decades,
        leagues: daily.challenge.rules.leagues,
        random: dailyRandom ?? undefined,
        respinsLeft:
          daily.challenge.rules.maxRespins === undefined
            ? null
            : Math.max(0, daily.challenge.rules.maxRespins - respinsUsed),
        onRespin: () => setRespinsUsed((n) => n + 1),
      }
    : undefined;

  // Casual draft: FREE_RESPINS_PER_DRAFT free re-spins per squad, then bought ones (store).
  const casualRules: DraftRules = {
    boost,
    respinsLeft: Math.max(0, FREE_RESPINS_PER_DRAFT - freeRespinsUsed) + respinTokens,
    onRespin: () => {
      if (freeRespinsUsed < FREE_RESPINS_PER_DRAFT) setFreeRespinsUsed((n) => n + 1);
      else void consumeItem('respin');
    },
  };

  // Leaving a finished tournament: with a Second chance in the wallet, offer one more first.
  // A tournament was played to the end: its result is shown, then an interstitial (not in the
  // Daily, which has its own result screen; not for Club members).
  const tournamentOver = () => {
    setFinished(true);
    showInterstitialAfterGame();
  };

  const endTournament = () => {
    if (!daily && secondChances > 0) setOfferSecondChance(true);
    else closeGame();
  };
  const takeSecondChance = async () => {
    setOfferSecondChance(false);
    // The server gives this squad one more tournament (and takes the Second chance from the wallet).
    if (!(await secondChanceOnline())) return closeGame();
    setFinished(false);
    setTournament(null);
    setShowTournaments(true);
  };

  // "One more" on the end bar of a finished arcade tournament.
  const [shopForSecondChance, setShopForSecondChance] = useState(false);
  const endActions: EndActions | null =
    finished && !daily && formation
      ? {
          formation,
          secondChances,
          onDraftAgain: () => {
            const same = formation;
            closeGame();
            startGame(null, false, same);
          },
          onAnotherMode: () => (secondChances > 0 ? void takeSecondChance() : setShopForSecondChance(true)),
        }
      : null;

  // Boosts owned, and using one for this draft (it applies to every club reel from now on).
  const ownedBoosts: Record<DraftBoostId, number> = {
    star: wallet?.consumables[DRAFT_BOOSTS.star.itemId] ?? 0,
    legend: wallet?.consumables[DRAFT_BOOSTS.legend.itemId] ?? 0,
  };
  const activateBoost = async (b: DraftBoostId) => {
    if (boost || activatingBoost) return false;
    setActivatingBoost(b);
    const ok = await consumeItem(DRAFT_BOOSTS[b].itemId);
    setActivatingBoost(null);
    if (ok) setBoost(b);
    return ok;
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

  // A starter and a substitute change places (the armband stays on the pitch: it is dropped if the
  // captain goes to the bench).
  const swapWithBench = (spot: number, slot: number) => {
    const starter = lineup[spot];
    const substitute = bench[slot];
    if (!starter || !canSwapWithBench(spot, substitute)) return;
    setLineup((prev) => prev.map((p, i) => (i === spot ? substitute : p)));
    setBench((prev) => prev.map((p, i) => (i === slot ? starter : p)));
    if (starter.player.id === captainId) setCaptainId(null);
    setSelected(null);
    setSubbing(null);
  };

  // Tap a substitute to pick him up (again to put him down); with a starter picked up, tapping a
  // substitute swaps them.
  const pressBench = (index: number) => {
    if (pending) return placeOnBench(index);
    if (!bench[index]) return;
    if (selected !== null) return swapWithBench(selected, index);
    setSubbing((s) => (s === index ? null : index));
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
    if (subbing !== null) return swapWithBench(index, subbing);
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
    if (sub) return canSwapWithBench(i, sub);
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

  const overall = formation ? squadSummary(formation, lineupPlayers).overall : 0;
  const nextSpot = openSpots[0]?.code;

  return {
    started,
    startGame,
    closeGame,
    daily,
    practice,
    formation,
    showPitch,
    reel,
    dailyRandom,
    handleResult,
    showFormation,
    setShowFormation,
    showSettings,
    setShowSettings,
    ratingTotal,
    placed,
    lineup,
    bench,
    chemistry,
    pending,
    fits,
    sub,
    subFits,
    moving,
    moveFits,
    pitchPressable,
    selected,
    setSelected,
    captainSpot,
    pillars,
    pressSpot,
    showLinks,
    pendingPreview,
    subGains,
    moveGains,
    arcadeTag,
    boost,
    lineupFull,
    benchOpen,
    useBench,
    benchCount,
    subbing,
    setSubbing,
    canSwapWithBench,
    pressBench,
    card,
    setCard,
    toggleCaptain,
    squadReady,
    ownedBoosts,
    activateBoost,
    activatingBoost,
    autofilling,
    autoBench,
    spin,
    complete,
    autocomplete,
    nextSpot,
    drawing,
    drawId,
    openSpots,
    handlePick,
    chemistryGain,
    dailyRules,
    casualRules,
    lineupPlayers,
    benchPlayers,
    cardPick,
    spots,
    cardLinks,
    showSummary,
    setShowSummary,
    showTournaments,
    setShowTournaments,
    overall,
    freeRespinsUsed,
    respinTokens,
    offerSecondChance,
    secondChances,
    takeSecondChance,
    tournament,
    setTournament,
    squadId,
    finished,
    endTournament,
    tournamentOver,
    challenged,
    setChallenged,
    challenge,
    shopForSecondChance,
    setShopForSecondChance,
    endActions,
  };
}

export type Draft = ReturnType<typeof useDraft>;
