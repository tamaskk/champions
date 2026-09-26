import {
  LEAGUES,
  LEAGUE_ADJECTIVES,
  LEAGUE_NAMES,
  lastCompleteSeason,
  leagueFirstSeason,
  pointsForWin,
  seasonLabel,
  sideFromLineup,
  simulateSeason,
  weakestClub,
  type League,
  type LeagueTableResponse,
  type SeasonResult,
  type SeasonTeam,
} from '@champion/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { fetchSeasonXIs, fetchTable } from '@/api/client';
import { Select } from '@/components/select';
import { SlotReel, type SlotReelHandle } from '@/components/slot-reel';
import { EndBar, TournamentShell, type ShellMode } from '@/components/tournament-shell';
import type { ResultReport } from '@/game/online';
import { recordSeason } from '@/game/session';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn, Chip, Glow, SHADOW_LG, SHADOW_SM } from '@/design/ui';
import type { DraftPlayer } from '@/mocks/players';
import { teamName } from '@/game/progress';

type Props = {
  /** random = league + season spun on reels; pick = chosen from dropdowns (or the Random button). */
  mode: 'random' | 'pick';
  formation: string;
  /** Your XI, in formation spot order. */
  lineup: readonly (DraftPlayer | null)[];
  /** Substitutes, rotated in over the season. */
  bench?: readonly (DraftPlayer | null)[];
  /** Squad numbers shown with "Your XI". */
  overall: number;
  chemistry: number;
  /** Session squad id, for "Your records". */
  squadId: number | null;
  onBack: () => void;
  onMode?: (mode: ShellMode) => void;
  /** Called when the result is in: the squad can't play again. */
  onFinished: () => void;
  onNewGame: () => void;
  onExit: () => void;
  onRandom: (random: boolean) => void;
  /** The season's result, for the leaderboard. */
  onResult?: (result: ResultReport) => void;
};

type Load = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; table: LeagueTableResponse };
type Sim = { status: 'idle' | 'loading' | 'error' } | { status: 'done'; result: SeasonResult };

const YOUR_ID = '__you__';
const SPIN_DURATION = 2600;

const leagueByLabel = (label: string) => LEAGUES.find((l) => LEAGUE_ADJECTIVES[l] === label)!;
const seasonsOf = (league: League) => {
  const last = lastCompleteSeason();
  return Array.from({ length: last - leagueFirstSeason(league) + 1 }, (_, i) => last - i);
};
const randomOf = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const ordinal = (n: number) => {
  const s =
    n % 100 >= 11 && n % 100 <= 13 ? 'th' : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th');
  return `${n}${s}`;
};
const shortSeason = (season: number) => `'${seasonLabel(season).slice(2)}`;

/**
 * League mode: a real league season in which your XI takes the place of the club that finished
 * last. Shows that season's real table, then simulates the whole season: every club plays every
 * other club home and away with the match engine (your XI included).
 */
export function LeagueTournament({
  mode,
  formation,
  lineup,
  bench = [],
  overall,
  chemistry,
  squadId,
  onBack,
  onMode,
  onRandom,
  onFinished,
  onNewGame,
  onExit,
  onResult,
}: Props) {
  const [league, setLeague] = useState<League | null>(mode === 'pick' ? 'ENG' : null);
  const [season, setSeason] = useState<number | null>(mode === 'pick' ? lastCompleteSeason() : null);
  const [load, setLoad] = useState<Load>({ status: 'idle' });
  const request = useRef(0);

  const showTable = (l: League, s: number) => {
    const id = ++request.current;
    setLoad({ status: 'loading' });
    fetchTable({ league: l, season: s })
      .then((table) => id === request.current && setLoad({ status: 'ready', table }))
      .catch(() => id === request.current && setLoad({ status: 'error' }));
  };

  // ---- Random: league reel, then the season reel of that league.
  const leagueReel = useRef<SlotReelHandle>(null);
  const seasonReel = useRef<SlotReelHandle>(null);
  const [round, setRound] = useState(0);
  const [seasonSpin, setSeasonSpin] = useState(0);
  const [reelWidth, setReelWidth] = useState(0);

  useEffect(() => {
    if (mode !== 'random' || !reelWidth) return;
    requestAnimationFrame(() => leagueReel.current?.spin());
  }, [mode, round, reelWidth]);

  useEffect(() => {
    if (seasonSpin > 0) seasonReel.current?.spin();
  }, [seasonSpin]);

  const drawAgain = () => {
    request.current++;
    setLoad({ status: 'idle' });
    setLeague(null);
    setSeason(null);
    setRound((r) => r + 1);
  };

  // ---- Pick: dropdowns.
  const [open, setOpen] = useState<'league' | 'season' | null>(null);
  const pickRandom = () => {
    const l = randomOf(LEAGUES);
    const s = randomOf(seasonsOf(l));
    setLeague(l);
    setSeason(s);
    setOpen(null);
    showTable(l, s);
  };

  const table = load.status === 'ready' ? load.table : null;
  const replaced = table ? weakestClub(table.rows) : null;
  const seasonItems = useMemo(() => (league ? seasonsOf(league).map(seasonLabel) : ['?']), [league]);

  // ---- Season simulation.
  const [sim, setSim] = useState<Sim>({ status: 'idle' });
  const [showFixtures, setShowFixtures] = useState(false);
  const xisCache = useRef<{ key: string; teams: SeasonTeam[] } | null>(null);
  useEffect(() => {
    setSim({ status: 'idle' });
    setShowFixtures(false);
  }, [table]);

  const simulate = async () => {
    if (!table || !replaced) return;
    setSim({ status: 'loading' });
    try {
      const key = `${table.league}-${table.season}`;
      let teams = xisCache.current?.key === key ? xisCache.current.teams : null;
      if (!teams) {
        const data = await fetchSeasonXIs({ league: table.league, season: table.season });
        teams = data.clubs
          .filter((c) => c.clubSlug !== replaced.clubSlug && c.xi.length > 0)
          .map((c) => ({ id: c.clubSlug, name: c.club, xi: c.xi, factor: 1 }));
        xisCache.current = { key, teams };
      }
      const you = sideFromLineup(
        teamName(),
        formation,
        lineup.map((p) => (p ? { ...p, rating: p.rating ?? null } : null)),
        bench.map((p) => (p ? { ...p, rating: p.rating ?? null } : null)),
      );
      const result = simulateSeason([...teams, { ...you, id: YOUR_ID }], pointsForWin(table.league, table.season));
      const row = result.table.find((r) => r.id === YOUR_ID)!;
      if (squadId !== null) {
        recordSeason(squadId, {
          league: table.league,
          label: `${LEAGUE_NAMES[table.league].split(' / ')[0]} ${shortSeason(table.season)}`,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          points: row.points,
          position: row.position,
        });
      }
      const clubs = result.table.length;
      onResult?.({
        mode: 'league',
        title: `${LEAGUE_NAMES[table.league].split(' / ')[0]} ${seasonLabel(table.season)}`,
        detail: `${ordinal(row.position)} · ${row.won}-${row.drawn}-${row.lost} · ${row.points} pts`,
        outcome:
          row.position === 1 ? 'champion' : row.position <= 4 ? 'top' : row.position <= clubs / 2 ? 'mid' : 'out',
      });
      setSim({ status: 'done', result });
      onFinished();
    } catch {
      setSim({ status: 'error' });
    }
  };
  const simResult = sim.status === 'done' ? sim.result : null;

  return (
    <TournamentShell
      title={mode === 'random' ? 'Random League' : 'League'}
      onBack={onBack}
      mode="league"
      onMode={onMode}>
      {/* Pick or spin the league season */}
      {!simResult && (
        <View style={styles.card}>
          <View style={styles.segment}>
            {(['pick', 'random'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => onRandom(m === 'random')}
                style={[styles.segBtn, mode === m && styles.segActive]}>
                <Icon name={m === 'pick' ? 'tune' : 'casino'} size={13} color={mode === m ? C.text : C.textMuted} />
                <Txt v="cap" color={mode === m ? C.text : C.textMuted}>
                  {m === 'pick' ? 'Choose season' : 'Spin the reels'}
                </Txt>
              </Pressable>
            ))}
          </View>

          {mode === 'random' && !table && (
            <View style={styles.chamber} onLayout={(e) => setReelWidth((e.nativeEvent.layout.width - 16 - 4) / 2)}>
              {reelWidth > 0 && (
                <View style={styles.reels}>
                  {[0, 1].map((i) => (
                    <View key={i} style={[styles.reelCol, { width: reelWidth }]}>
                      <View>
                        {i === 0 ? (
                          <SlotReel
                            key={`league-${round}`}
                            ref={leagueReel}
                            items={Object.values(LEAGUE_ADJECTIVES)}
                            width={reelWidth}
                            duration={SPIN_DURATION}
                            onResult={(label) => {
                              setLeague(leagueByLabel(label));
                              setSeasonSpin((n) => n + 1);
                            }}
                          />
                        ) : (
                          <SlotReel
                            key={`season-${round}-${league}`}
                            ref={seasonReel}
                            items={seasonItems}
                            width={reelWidth}
                            duration={SPIN_DURATION}
                            onResult={(label) => {
                              const s = Number(label.slice(0, 4));
                              setSeason(s);
                              if (league) showTable(league, s);
                            }}
                          />
                        )}
                        {i === 1 && !league && (
                          <Animated.View exiting={FadeOut.duration(300)} style={styles.cover}>
                            <Txt v="h28" color={C.gold}>
                              ?
                            </Txt>
                          </Animated.View>
                        )}
                      </View>
                      <View style={styles.reelLabel}>
                        <Txt v="cap" color={C.green}>
                          {i === 0 ? 'League' : 'Season'}
                        </Txt>
                      </View>
                    </View>
                  ))}
                </View>
              )}
              <View pointerEvents="none" style={styles.payline}>
                <View style={styles.paylineBar} />
                <View style={styles.paylineBar} />
              </View>
            </View>
          )}

          {mode === 'pick' && (
            <View style={styles.gap8}>
              <Select
                label="League"
                value={league ? `${league} · ${LEAGUE_NAMES[league]}` : 'Choose'}
                open={open === 'league'}
                onToggle={() => setOpen(open === 'league' ? null : 'league')}
                options={LEAGUES.map((l) => ({ key: l, label: `${l} · ${LEAGUE_NAMES[l]}`, active: l === league }))}
                onSelect={(key) => {
                  const l = key as League;
                  setLeague(l);
                  setSeason((s) => (s === null ? s : Math.max(s, leagueFirstSeason(l))));
                  setOpen(null);
                }}
              />
              <Select
                label="Season"
                value={season ? seasonLabel(season) : 'Choose'}
                open={open === 'season'}
                onToggle={() => setOpen(open === 'season' ? null : 'season')}
                options={(league ? seasonsOf(league) : []).map((s) => ({
                  key: String(s),
                  label: seasonLabel(s),
                  active: s === season,
                }))}
                onSelect={(key) => {
                  setSeason(Number(key));
                  setOpen(null);
                }}
              />
              <View style={styles.row8}>
                <Btn
                  kind="mid"
                  icon="casino"
                  label="Random"
                  height={44}
                  radius={R.sm}
                  onPress={pickRandom}
                  style={styles.flex}
                />
                <Btn
                  kind="green"
                  icon="leaderboard"
                  label="Show table"
                  height={44}
                  radius={R.sm}
                  disabled={!league || !season}
                  onPress={() => league && season && showTable(league, season)}
                  style={styles.flex}
                />
              </View>
            </View>
          )}

          {mode === 'random' && table && (
            <Btn kind="mid" icon="autorenew" label="Spin again" height={44} radius={R.sm} onPress={drawAgain} />
          )}
          {load.status === 'loading' && <ActivityIndicator color={C.green} />}
          {load.status === 'error' && (
            <Txt v="bodySemi" color={C.red} style={styles.center}>
              Couldn&apos;t load the table. Check that the web server is running.
            </Txt>
          )}
        </View>
      )}

      {table && simResult && !open && <SeasonCard league={table.league} season={table.season} result={simResult} />}

      {table && replaced && !open && (
        <View style={styles.standings}>
          <View style={[styles.between, { paddingBottom: 4 }]}>
            <View style={[styles.row4, styles.flexShrink]}>
              <Icon name="leaderboard" size={17} color={C.green} />
              <Txt v="h20" style={styles.flexShrink}>
                {simResult ? (showFixtures ? 'Your 38 Fixtures' : 'Final Standings') : 'Real Final Table'}
              </Txt>
            </View>
            <Txt v="cap" color={C.textDim} style={{ textAlign: 'right' }}>
              {simResult
                ? `MATCHDAY ${simResult.table[0]?.played}/${simResult.table[0]?.played}`
                : `${LEAGUE_NAMES[table.league].split(' / ')[0]} ${shortSeason(table.season)}`}
            </Txt>
          </View>
          {!simResult && (
            <Txt v="body" color={C.textMuted}>
              {teamName()} (OVR {Math.round(overall)} · CHEM {chemistry}) replaces {replaced.club}, who finished last.
            </Txt>
          )}

          {simResult && showFixtures ? (
            <Fixtures result={simResult} />
          ) : (
            <View style={styles.table}>
              <TableRow head cells={['POS', 'CLUB', 'P', 'W', 'D', 'L', 'GD', 'PTS']} />
              {simResult
                ? simResult.table.map((r, i) => (
                    <TableRow
                      key={r.id}
                      yours={r.id === YOUR_ID}
                      zebra={i % 2 === 1}
                      cells={[
                        String(r.position),
                        r.id === YOUR_ID ? teamName() : r.name,
                        String(r.played),
                        String(r.won),
                        String(r.drawn),
                        String(r.lost),
                        signed(r.goalsFor - r.goalsAgainst),
                        String(r.points),
                      ]}
                    />
                  ))
                : table.rows.map((r, i) => {
                    const yours = r.clubSlug === replaced.clubSlug;
                    return (
                      <TableRow
                        key={r.clubSlug}
                        yours={yours}
                        zebra={i % 2 === 1}
                        cells={
                          yours
                            ? ['–', teamName(), String(r.played), '–', '–', '–', '–', '–']
                            : [
                                String(r.position),
                                r.club,
                                String(r.played),
                                String(r.won),
                                String(r.drawn),
                                String(r.lost),
                                signed(r.goalsFor - r.goalsAgainst),
                                String(r.points),
                              ]
                        }
                      />
                    );
                  })}
            </View>
          )}

          {sim.status === 'error' && (
            <Txt v="bodySemi" color={C.red} style={styles.center}>
              Couldn&apos;t load the clubs&apos; squads.
            </Txt>
          )}
          <View style={[styles.row8, { paddingTop: 8 }]}>
            {!simResult && (
              <Btn
                kind="blue"
                icon="play_arrow"
                label={sim.status === 'loading' ? 'Simulating…' : 'Simulate season'}
                height={48}
                radius={R.sm}
                disabled={sim.status === 'loading'}
                onPress={simulate}
                style={styles.flex}
              />
            )}
            {simResult && (
              <Btn
                kind="gold"
                icon={showFixtures ? 'leaderboard' : 'calendar_month'}
                label={
                  showFixtures
                    ? 'Standings'
                    : `View ${simResult.fixtures.filter((f) => f.home === YOUR_ID || f.away === YOUR_ID).length} Fixtures`
                }
                height={48}
                radius={R.sm}
                onPress={() => setShowFixtures((v) => !v)}
                style={styles.flex}
              />
            )}
          </View>
          <Txt v="capBody" color={C.textDim} style={styles.center}>
            {simResult
              ? `Every club played every other club home and away · ${simResult.pointsForWin} points for a win`
              : 'The simulation plays every fixture again, your XI included.'}
          </Txt>
        </View>
      )}
      {simResult && <EndBar onNewGame={onNewGame} onExit={onExit} />}
    </TournamentShell>
  );
}

/** The simulated season's verdict: trophy card, record strip, your top scorers. */
function SeasonCard({ league, season, result }: { league: League; season: number; result: SeasonResult }) {
  const you = result.table.find((r) => r.id === YOUR_ID)!;
  const teams = result.table.length;
  const perfect = you.won === you.played;
  const maxPoints = you.played * result.pointsForWin;
  const [pill, verdict, note] = perfect
    ? ['THE HOLY GRAIL', `Perfect Season! ${you.won}-0 🏆`, 'Historical record unlocked · No draws, no defeats.']
    : you.position === 1 && you.lost === 0
      ? ['INVINCIBLES', 'Champions – unbeaten! 🏆', 'Not a single defeat all season.']
      : you.position === 1
        ? ['CHAMPIONS', 'Champions! 🏆', `${you.lost} defeat${you.lost === 1 ? '' : 's'} on the way to the title.`]
        : you.lost === 0
          ? ['UNBEATEN', `Unbeaten, but ${ordinal(you.position)}`, 'Too many draws to take the title.']
          : you.position > teams - 3
            ? ['RELEGATION ZONE', `${ordinal(you.position)} – going down`, 'Back to the draft board.']
            : ['SEASON OVER', `Finished ${ordinal(you.position)}`, `${you.won} wins from ${you.played} matches.`];
  const top = result.scorers.filter((s) => s.teamId === YOUR_ID).slice(0, 3);
  const leagueTop = result.scorers[0];
  const topName = leagueTop
    ? leagueTop.teamId === YOUR_ID
      ? teamName()
      : result.table.find((r) => r.id === leagueTop.teamId)?.name
    : null;
  const gold = you.position === 1;

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.trophyCard}>
      <Glow color={C.gold} opacity={0.15} size={200} style={{ right: -60, top: -60 }} />
      <View style={styles.between}>
        <View style={[styles.row4, styles.flexShrink]}>
          <Icon name="military_tech" size={19} color={C.gold} />
          <Txt v="h20" style={styles.flexShrink}>
            Simulated {LEAGUE_NAMES[league].split(' / ')[0]} {shortSeason(season)}
          </Txt>
        </View>
        <Chip
          label="CAMPAIGN COMPLETED"
          color={C.onGold}
          bg={C.goldDeep}
          radius={R.pill}
          style={{ paddingVertical: 2 }}
        />
      </View>
      <View style={styles.victory}>
        <View
          style={[
            styles.grail,
            {
              backgroundColor: gold ? C.gold : C.surface4,
              boxShadow: gold ? `0px 0px 10px ${alpha(C.gold, 0.45)}` : undefined,
            },
          ]}>
          <Icon name="emoji_events" size={14} color={gold ? C.onGoldDark : C.text} />
          <Txt
            v="num13"
            color={gold ? C.onGoldDark : C.text}
            style={{ textTransform: 'uppercase', letterSpacing: 0.325 }}>
            {pill}
          </Txt>
        </View>
        <Txt v="h28" color={gold ? C.gold : C.text} style={styles.center}>
          {verdict}
        </Txt>
        <Txt v="body14" color={C.textMuted} style={styles.center}>
          {note}
        </Txt>
        <View style={styles.strip}>
          <StripItem label="RECORD" value={`${you.won}W ${you.drawn}D ${you.lost}L`} color={C.green} />
          <StripItem
            label="GOAL DIFF"
            value={signed(you.goalsFor - you.goalsAgainst)}
            suffix={`(${you.goalsFor}:${you.goalsAgainst})`}
            color={C.text}
          />
          <StripItem
            label="POINTS"
            value={String(you.points)}
            suffix={you.points === maxPoints ? 'MAX' : `/${maxPoints}`}
            color={C.gold}
          />
        </View>
        {top.length > 0 && (
          <Txt v="body" color={C.text} style={styles.center}>
            ⚽ {top.map((s) => `${s.name} ${s.goals}`).join(' · ')}
          </Txt>
        )}
        {leagueTop && (
          <Txt v="body" color={C.textMuted} style={styles.center}>
            Top scorer: {leagueTop.name} ({topName}) {leagueTop.goals}
          </Txt>
        )}
      </View>
    </Animated.View>
  );
}

function StripItem({ label, value, suffix, color }: { label: string; value: string; suffix?: string; color: string }) {
  return (
    <View style={styles.stripItem}>
      <Txt v="cap" color={C.textMuted}>
        {label}
      </Txt>
      <Txt v="h20" color={color} style={styles.center}>
        {value}
        {suffix ? (
          <Txt v="bodySemi" color={C.textDim}>
            {' '}
            {suffix}
          </Txt>
        ) : null}
      </Txt>
    </View>
  );
}

// Column widths of the table (12-column grid in the design: pos 1, club 5, stats 1 each).
const COLS = [1, 5, 1, 1, 1, 1, 1.2, 1.2];

function TableRow({
  cells,
  head,
  yours,
  zebra,
}: {
  cells: string[];
  head?: boolean;
  yours?: boolean;
  zebra?: boolean;
}) {
  return (
    <View style={[styles.tr, head ? styles.trHead : yours ? styles.trYours : zebra ? styles.trZebra : null]}>
      {cells.map((c, i) => (
        <View
          key={i}
          style={[
            { flex: COLS[i] },
            i === 1
              ? styles.tdLeft
              : i === 0
                ? styles.tdLeft
                : i === cells.length - 1
                  ? styles.tdRight
                  : styles.tdCenter,
          ]}>
          {i === 1 && yours ? (
            <View style={styles.row4}>
              <Icon name="star" size={13} color={C.blueLight} />
              <Txt v="num13" color={C.blueLight}>
                {c}
              </Txt>
            </View>
          ) : (
            <Txt
              v={head ? 'capBody' : i === 1 ? 'bodySemi' : i === 0 || i === cells.length - 1 ? 'bodyBold' : 'body'}
              numberOfLines={1}
              style={[
                head && { letterSpacing: 0.5 },
                i === 1 && !head && { fontFamily: 'SpaceGrotesk_600SemiBold', letterSpacing: 0 },
                i === cells.length - 1 && yours && { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13 },
              ]}
              color={
                head
                  ? C.textMuted
                  : yours
                    ? i === cells.length - 1
                      ? C.gold
                      : i === 0
                        ? C.blueLight
                        : i === 3 || i === 6
                          ? C.green
                          : C.text
                    : i === 0 || i === 4 || i === 5
                      ? C.textMuted
                      : C.text
              }>
              {c}
            </Txt>
          )}
        </View>
      ))}
    </View>
  );
}

/** Your fixtures: round, opponent (vs = home, @ = away), score, W/D/L. */
function Fixtures({ result }: { result: SeasonResult }) {
  const names = new Map(result.table.map((r) => [r.id, r.name]));
  return (
    <View style={styles.table}>
      {result.fixtures
        .filter((f) => f.home === YOUR_ID || f.away === YOUR_ID)
        .map((f, i) => {
          const home = f.home === YOUR_ID;
          const ours = home ? f.homeGoals : f.awayGoals;
          const theirs = home ? f.awayGoals : f.homeGoals;
          const mark = ours > theirs ? 'W' : ours === theirs ? 'D' : 'L';
          const color = mark === 'W' ? C.green : mark === 'D' ? C.gold : C.red;
          return (
            <View key={f.round} style={[styles.tr, i % 2 === 1 && styles.trZebra]}>
              <Txt v="bodyBold" color={C.textMuted} style={{ width: 28 }}>
                {f.round}
              </Txt>
              <Txt v="bodySemi" numberOfLines={1} style={styles.flex}>
                {home ? 'vs' : '@'} {names.get(home ? f.away : f.home)}
              </Txt>
              <Txt v="num13" style={{ width: 44, textAlign: 'center' }}>
                {ours}–{theirs}
              </Txt>
              <View style={[styles.mark, { backgroundColor: alpha(color, 0.2) }]}>
                <Txt v="cap" color={color}>
                  {mark}
                </Txt>
              </View>
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  segment: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: R.md,
    backgroundColor: C.deep,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: R.sm,
  },
  segActive: {
    backgroundColor: C.surface3,
  },
  center: {
    textAlign: 'center',
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  row4: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  row8: {
    flexDirection: 'row',
    gap: 8,
  },
  gap8: {
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  flexShrink: {
    flexShrink: 1,
  },
  chamber: {
    padding: 8,
    borderRadius: R.lg,
    backgroundColor: C.deep,
    overflow: 'hidden',
    boxShadow: 'inset 0px 4px 16px rgba(0,0,0,0.9)',
  },
  reels: {
    flexDirection: 'row',
    gap: 4,
  },
  reelCol: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 4,
    borderRadius: R.md,
    backgroundColor: C.surface,
    overflow: 'hidden',
  },
  cover: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  reelLabel: {
    marginTop: 4,
    padding: 8,
    borderRadius: R.xs,
    backgroundColor: alpha(C.surface4, 0.6),
  },
  payline: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 8 + 4 + 40 - 8,
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
  trophyCard: {
    gap: 8,
    padding: 16,
    borderRadius: R.md,
    overflow: 'hidden',
    experimental_backgroundImage: `linear-gradient(to bottom, ${C.surface3}, ${C.surface2})`,
    boxShadow: SHADOW_LG,
  },
  victory: {
    alignItems: 'center',
    gap: 4,
    padding: 16,
    borderRadius: R.md,
    backgroundColor: C.deep,
  },
  grail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: R.pill,
  },
  strip: {
    width: '100%',
    flexDirection: 'row',
    gap: 4,
    marginTop: 12,
    marginBottom: 4,
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 4,
    borderRadius: R.sm,
    backgroundColor: alpha(C.surface3, 0.4),
  },
  stripItem: {
    flex: 1,
    alignItems: 'center',
  },
  standings: {
    gap: 8,
    padding: 16,
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  table: {
    borderRadius: R.sm,
    overflow: 'hidden',
    backgroundColor: C.deep,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  trHead: {
    paddingVertical: 4,
    backgroundColor: C.surface2,
  },
  trYours: {
    backgroundColor: alpha(C.blue, 0.15),
  },
  trZebra: {
    backgroundColor: alpha(C.surface2, 0.3),
  },
  tdLeft: {
    alignItems: 'flex-start',
  },
  tdCenter: {
    alignItems: 'center',
  },
  tdRight: {
    alignItems: 'flex-end',
  },
  mark: {
    width: 24,
    alignItems: 'center',
    paddingVertical: 2,
    borderRadius: R.xs,
  },
});
