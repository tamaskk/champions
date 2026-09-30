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
  squadInsight,
  weakestClub,
  type League,
  type LeagueTableResponse,
  type SeasonTeam,
} from '@champion/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import { fetchSeasonXIs, fetchTable } from '@/api/client';
import { SeasonPlayer, TableRow, ordinal, signed } from '@/components/season-player';
import { Select } from '@/components/select';
import { SlotReel, type SlotReelHandle } from '@/components/slot-reel';
import { TournamentShell, type ShellMode } from '@/components/tournament-shell';
import { YOUR_ID, leagueSeasonTitle, startLeagueSeason, useLeagueSeason } from '@/game/league-season';
import type { ResultReport } from '@/game/online';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn, SHADOW_SM } from '@/design/ui';
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
type Sim = 'idle' | 'loading' | 'error' | 'started';

const SPIN_DURATION = 2600;

const leagueByLabel = (label: string) => LEAGUES.find((l) => LEAGUE_ADJECTIVES[l] === label)!;
const seasonsOf = (league: League) => {
  const last = lastCompleteSeason();
  return Array.from({ length: last - leagueFirstSeason(league) + 1 }, (_, i) => last - i);
};
const randomOf = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
const average = (xs: (number | null)[]) => {
  const known = xs.filter((x): x is number => x !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
};
const shortSeason = (season: number) => `'${seasonLabel(season).slice(2)}`;

/**
 * League mode: a real league season in which your XI takes the place of the club that finished
 * last. Shows that season's real table, then simulates the whole season (every club plays every
 * other club home and away with the match engine, your XI included) and hands it to SeasonPlayer,
 * which reveals it matchday by matchday and saves it so it can be continued later.
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

  // ---- Season: simulated in full at kick-off, then played matchday by matchday (SeasonPlayer).
  const [sim, setSim] = useState<Sim>('idle');
  const saved = useLeagueSeason();
  const xisCache = useRef<{ key: string; teams: SeasonTeam[] } | null>(null);

  const startSeason = async () => {
    if (!table || !replaced) return;
    setSim('loading');
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
      const all = [...teams, { ...you, id: YOUR_ID }];
      const result = simulateSeason(all, pointsForWin(table.league, table.season), Math.random, {
        detailFor: YOUR_ID,
      });
      startLeagueSeason({
        league: table.league,
        season: table.season,
        squadId,
        teamName: teamName(),
        formation,
        overall,
        chemistry,
        replaced: replaced.club,
        teams: all.map((t) => ({ id: t.id, name: t.name, rating: average(t.xi.map((p) => p.rating)) })),
        result,
        rounds: Math.max(...result.fixtures.map((f) => f.round)),
        insight: squadInsight(you, teams),
        bench: you.bench?.length ?? 0,
      });
      // The squad's result goes to the leaderboard now (it is decided); the player sees it matchday by
      // matchday, and the season record (XP, Hall of Fame) is written when the last one is shown.
      const row = result.table.find((r) => r.id === YOUR_ID)!;
      const clubs = result.table.length;
      onResult?.({
        mode: 'league',
        title: `${LEAGUE_NAMES[table.league].split(' / ')[0]} ${seasonLabel(table.season)}`,
        detail: `${ordinal(row.position)} · ${row.won}-${row.drawn}-${row.lost} · ${row.points} pts`,
        outcome:
          row.position === 1 ? 'champion' : row.position <= 4 ? 'top' : row.position <= clubs / 2 ? 'mid' : 'out',
      });
      setSim('started');
      onFinished();
    } catch {
      setSim('error');
    }
  };

  if (sim === 'started' && saved) {
    return (
      <TournamentShell title={leagueSeasonTitle(saved)} onBack={onBack}>
        <SeasonPlayer save={saved} onNewGame={onNewGame} onExit={onExit} />
      </TournamentShell>
    );
  }

  return (
    <TournamentShell
      title={mode === 'random' ? 'Random League' : 'League'}
      onBack={onBack}
      mode="league"
      onMode={onMode}>
      {/* Pick or spin the league season */}
      {(
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
                            stopAnywhere
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
                            stopAnywhere
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

      {table && replaced && !open && (
        <View style={styles.standings}>
          <View style={[styles.between, { paddingBottom: 4 }]}>
            <View style={[styles.row4, styles.flexShrink]}>
              <Icon name="leaderboard" size={17} color={C.green} />
              <Txt v="h20" style={styles.flexShrink}>
                Real Final Table
              </Txt>
            </View>
            <Txt v="cap" color={C.textDim} style={{ textAlign: 'right' }}>
              {LEAGUE_NAMES[table.league].split(' / ')[0]} {shortSeason(table.season)}
            </Txt>
          </View>
          <Txt v="body" color={C.textMuted}>
            {teamName()} (OVR {Math.round(overall)} · CHEM {chemistry}) replaces {replaced.club}, who finished last.
          </Txt>

          <View style={styles.table}>
            <TableRow head cells={['POS', 'CLUB', 'P', 'W', 'D', 'L', 'GD', 'PTS']} />
            {table.rows.map((r, i) => {
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

          {sim === 'error' && (
            <Txt v="bodySemi" color={C.red} style={styles.center}>
              Couldn&apos;t load the clubs&apos; squads.
            </Txt>
          )}
          {saved && !saved.recorded && (
            <Txt v="body" color={C.gold} style={styles.center}>
              Starting replaces your unfinished {leagueSeasonTitle(saved)} (matchday {saved.revealed}/{saved.rounds}).
            </Txt>
          )}
          <Btn
            kind="blue"
            icon="play_arrow"
            label={sim === 'loading' ? 'Simulating…' : 'Start the season'}
            sub="Matchday by matchday, or straight to the end"
            height={52}
            radius={R.sm}
            disabled={sim === 'loading'}
            onPress={startSeason}
          />
          <Txt v="capBody" color={C.textDim} style={styles.center}>
            The simulation plays every fixture again, your XI included. Saved as you go – continue any time from Home.
          </Txt>
        </View>
      )}
    </TournamentShell>
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
});
