import { standingsAfter, type SeasonFixture, type SeasonRow } from '@champion/shared';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { MatchPlay, type Played, type WatchSpeed } from '@/components/match-play';
import { EndBar } from '@/components/tournament-shell';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn, Chip, Glow, SHADOW_LG, SHADOW_SM } from '@/design/ui';
import {
  YOUR_ID,
  clearLeagueSeason,
  leagueSeasonTitle,
  revealLeagueRound,
  type LeagueSeasonSave,
} from '@/game/league-season';

export const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
export const ordinal = (n: number) => {
  const s =
    n % 100 >= 11 && n % 100 <= 13 ? 'th' : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th');
  return `${n}${s}`;
};

type Watching = { round: number; speed: WatchSpeed; replay: boolean };
type Tab = 'table' | 'fixtures' | 'results';

const isYours = (f: SeasonFixture) => f.home === YOUR_ID || f.away === YOUR_ID;
const markOf = (f: SeasonFixture) => {
  const home = f.home === YOUR_ID;
  const ours = home ? f.homeGoals : f.awayGoals;
  const theirs = home ? f.awayGoals : f.homeGoals;
  return { ours, theirs, mark: ours > theirs ? 'W' : ours === theirs ? 'D' : 'L' } as const;
};
const MARK_COLOR = { W: C.green, D: C.gold, L: C.red } as const;

/** One of your fixtures as a match to show (the season simulated it with its events). */
function playedOf(f: SeasonFixture, names: Map<string, string>): Played {
  const youAtHome = f.home === YOUR_ID;
  return {
    youAtHome,
    opponentName: names.get(youAtHome ? f.away : f.home) ?? '?',
    result: f.detail?.result ?? {
      homeGoals: f.homeGoals,
      awayGoals: f.awayGoals,
      goals: [],
      expected: { home: 0, away: 0 },
      chances: { win: 0, draw: 0, loss: 0 },
    },
    events: f.detail?.events ?? [],
  };
}

/**
 * A saved league season, played matchday by matchday: watch your match (result, fast or live),
 * see the table and the round's other results after every matchday, or jump to the end. Every
 * step is saved (game/league-season.ts), so the season can be left and continued at any time.
 */
export function SeasonPlayer({
  save,
  onNewGame,
  onExit,
}: {
  save: LeagueSeasonSave;
  /** In the draft flow: "new game" after the season (otherwise only "Finish season"). */
  onNewGame?: () => void;
  onExit: () => void;
}) {
  const [watching, setWatching] = useState<Watching | null>(null);
  const [tab, setTab] = useState<Tab>('table');
  const [resultsRound, setResultsRound] = useState<number | null>(null);

  const { result, revealed, rounds } = save;
  const done = revealed >= rounds;
  const names = useMemo(
    () => new Map(save.teams.map((t) => [t.id, t.id === YOUR_ID ? save.teamName : t.name])),
    [save.teams, save.teamName],
  );
  const ratings = useMemo(() => new Map(save.teams.map((t) => [t.id, t.rating])), [save.teams]);
  const table = useMemo(
    () =>
      done
        ? result.table
        : standingsAfter(
            save.teams.map((t) => ({ id: t.id, name: t.name })),
            result.fixtures,
            revealed,
            result.pointsForWin,
          ),
    [done, result, revealed, save.teams],
  );
  const yourFixtures = useMemo(() => result.fixtures.filter(isYours), [result.fixtures]);
  const you = table.find((r) => r.id === YOUR_ID)!;
  const shown = yourFixtures.filter((f) => f.round <= revealed);
  const form = shown.slice(-5).map((f) => markOf(f).mark);

  const nextRound = revealed + 1;
  const nextFixture = done ? null : (yourFixtures.find((f) => f.round === nextRound) ?? null);
  const watchedFixture = watching ? yourFixtures.find((f) => f.round === watching.round) : null;
  const opponentOf = (f: SeasonFixture) => (f.home === YOUR_ID ? f.away : f.home);
  const placeOf = (id: string) => table.find((r) => r.id === id)?.position;

  const roundShown = Math.min(resultsRound ?? revealed, revealed);
  const roundResults = result.fixtures.filter((f) => f.round === roundShown);

  const finish = (then: () => void) => () => {
    clearLeagueSeason();
    then();
  };

  return (
    <>
      {done ? (
        <SeasonCard save={save} />
      ) : (
        <SeasonProgress save={save} you={you} form={form} />
      )}

      {/* Your match of the matchday being watched (or a past one, again). */}
      {watching && watchedFixture && (
        <MatchPlay
          key={`${watching.round}-${watching.speed}-${watching.replay}`}
          formation={save.formation}
          lineup={[]}
          overall={save.overall}
          chemistry={save.chemistry}
          opponentName={names.get(opponentOf(watchedFixture)) ?? '?'}
          opponentRating={ratings.get(opponentOf(watchedFixture)) ?? null}
          opponentChip={`MATCHDAY ${watching.round}`}
          meta={`${leagueSeasonTitle(save)} · MATCHDAY ${watching.round}`}
          metaPlayed={`MATCHDAY ${watching.round}/${rounds}`}
          simulate={async () => playedOf(watchedFixture, names)}
          preplayed={{ played: playedOf(watchedFixture, names), speed: watching.speed }}
          onResult={() => {
            if (!watching.replay) revealLeagueRound(watching.round);
          }}
          onFinished={() => undefined}
          onNewGame={() => undefined}
          onExit={() => undefined}
          hideEndBar>
          <Btn
            kind="green"
            icon={watching.replay || revealed >= rounds ? 'check' : 'skip_next'}
            label={watching.replay ? 'Close' : revealed >= rounds ? 'See the final table' : 'Continue'}
            height={48}
            onPress={() => setWatching(null)}
          />
        </MatchPlay>
      )}

      {/* The next matchday: how to play it, or jump to the end. */}
      {!done && !watching && (
        <View style={styles.card}>
          <View style={styles.between}>
            <View style={[styles.row4, styles.flexShrink]}>
              <Icon name="sports_soccer" size={17} color={C.green} />
              <Txt v="h20" style={styles.flexShrink}>
                Matchday {nextRound}
              </Txt>
            </View>
            <Txt v="cap" color={C.textDim}>
              {rounds - revealed} TO GO
            </Txt>
          </View>
          {nextFixture ? (
            <>
              <Txt v="bodySemi">
                {nextFixture.home === YOUR_ID ? 'vs' : '@'} {names.get(opponentOf(nextFixture))}
                <Txt v="body" color={C.textMuted}>
                  {' '}
                  · {nextFixture.home === YOUR_ID ? 'home' : 'away'}
                  {revealed > 0 ? ` · ${ordinal(placeOf(opponentOf(nextFixture)) ?? 0)} in the table` : ''}
                </Txt>
              </Txt>
              <View style={styles.row8}>
                {(
                  [
                    { speed: 'quick', icon: 'bolt', label: 'Result', sub: 'At once' },
                    { speed: 'fast', icon: 'fast_forward', label: 'Fast', sub: '≈ 10 s' },
                    { speed: 'live', icon: 'timer', label: 'Live', sub: '≈ 45 s' },
                  ] as const
                ).map((o) => (
                  <Btn
                    key={o.speed}
                    kind={o.speed === 'live' ? 'green' : o.speed === 'fast' ? 'blue' : 'mid'}
                    icon={o.icon}
                    label={o.label}
                    sub={o.sub}
                    onPress={() => setWatching({ round: nextRound, speed: o.speed, replay: false })}
                    style={styles.flex}
                  />
                ))}
              </View>
            </>
          ) : (
            <>
              <Txt v="body" color={C.textMuted}>
                No match for {save.teamName} this matchday.
              </Txt>
              <Btn kind="mid" icon="skip_next" label="Next matchday" height={44} onPress={() => revealLeagueRound(nextRound)} />
            </>
          )}
          <Btn
            kind="dark"
            icon="sports_score"
            label="Simulate to the end"
            sub="Straight to the final table"
            height={48}
            onPress={() => revealLeagueRound(rounds)}
          />
          <Txt v="capBody" color={C.textDim} style={styles.center}>
            The whole season was simulated at kick-off – saved after every matchday, continue any time.
          </Txt>
        </View>
      )}

      {/* Table, your fixtures, the matchday's results */}
      <View style={styles.card}>
        <View style={styles.segment}>
          {(
            [
              { id: 'table', label: 'Table', icon: 'leaderboard' },
              { id: 'fixtures', label: 'Your fixtures', icon: 'calendar_month' },
              { id: 'results', label: 'Results', icon: 'sports_soccer' },
            ] as const
          ).map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.id }}
              style={[styles.segBtn, tab === t.id && styles.segActive]}>
              <Icon name={t.icon} size={13} color={tab === t.id ? C.text : C.textMuted} />
              <Txt v="cap" color={tab === t.id ? C.text : C.textMuted}>
                {t.label}
              </Txt>
            </Pressable>
          ))}
        </View>

        {tab === 'table' && (
          <View style={styles.table}>
            <TableRow head cells={['POS', 'CLUB', 'P', 'W', 'D', 'L', 'GD', 'PTS']} />
            {table.map((r, i) => (
              <TableRow
                key={r.id}
                yours={r.id === YOUR_ID}
                zebra={i % 2 === 1}
                cells={[
                  String(r.position),
                  names.get(r.id) ?? r.name,
                  String(r.played),
                  String(r.won),
                  String(r.drawn),
                  String(r.lost),
                  signed(r.goalsFor - r.goalsAgainst),
                  String(r.points),
                ]}
              />
            ))}
          </View>
        )}

        {tab === 'fixtures' && (
          <View style={styles.table}>
            {yourFixtures.map((f, i) => {
              const played = f.round <= revealed;
              const home = f.home === YOUR_ID;
              const m = markOf(f);
              return (
                <Pressable
                  key={f.round}
                  disabled={!played}
                  onPress={() => setWatching({ round: f.round, speed: 'quick', replay: true })}
                  accessibilityRole="button"
                  accessibilityLabel={
                    played
                      ? `Matchday ${f.round}, ${m.ours}–${m.theirs} ${home ? 'vs' : 'at'} ${names.get(opponentOf(f))} – watch again`
                      : `Matchday ${f.round}, ${home ? 'vs' : 'at'} ${names.get(opponentOf(f))}`
                  }
                  style={({ pressed }) => [styles.tr, i % 2 === 1 && styles.trZebra, pressed && { opacity: 0.7 }]}>
                  <Txt v="bodyBold" color={C.textMuted} style={{ width: 28 }}>
                    {f.round}
                  </Txt>
                  <Txt v="bodySemi" numberOfLines={1} color={played ? C.text : C.textDim} style={styles.flex}>
                    {home ? 'vs' : '@'} {names.get(opponentOf(f))}
                  </Txt>
                  {played ? (
                    <>
                      <Txt v="num13" style={{ width: 44, textAlign: 'center' }}>
                        {m.ours}–{m.theirs}
                      </Txt>
                      <View style={[styles.mark, { backgroundColor: alpha(MARK_COLOR[m.mark], 0.2) }]}>
                        <Txt v="cap" color={MARK_COLOR[m.mark]}>
                          {m.mark}
                        </Txt>
                      </View>
                    </>
                  ) : (
                    <Txt v="cap" color={C.textDim} style={{ width: 68, textAlign: 'right' }}>
                      {f.round === nextRound ? 'NEXT' : '–'}
                    </Txt>
                  )}
                </Pressable>
              );
            })}
            {shown.length > 0 && (
              <Txt v="capBody" color={C.textDim} style={[styles.center, { padding: 8 }]}>
                Tap a played match to watch it again.
              </Txt>
            )}
          </View>
        )}

        {tab === 'results' &&
          (revealed === 0 ? (
            <Txt v="body" color={C.textMuted}>
              No matchday played yet.
            </Txt>
          ) : (
            <>
              <View style={styles.between}>
                <Pressable
                  onPress={() => setResultsRound(Math.max(1, roundShown - 1))}
                  disabled={roundShown <= 1}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Previous matchday"
                  style={{ opacity: roundShown <= 1 ? 0.3 : 1, transform: [{ rotate: '180deg' }] }}>
                  <Icon name="chevron_right" size={22} color={C.text} />
                </Pressable>
                <Txt v="h14">MATCHDAY {roundShown}</Txt>
                <Pressable
                  onPress={() => setResultsRound(Math.min(revealed, roundShown + 1))}
                  disabled={roundShown >= revealed}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Next matchday"
                  style={{ opacity: roundShown >= revealed ? 0.3 : 1 }}>
                  <Icon name="chevron_right" size={22} color={C.text} />
                </Pressable>
              </View>
              <View style={styles.table}>
                {roundResults.map((f, i) => {
                  const yours = isYours(f);
                  return (
                    <View key={`${f.home}-${f.away}`} style={[styles.tr, yours ? styles.trYours : i % 2 === 1 && styles.trZebra]}>
                      <Txt v="bodySemi" numberOfLines={1} color={f.home === YOUR_ID ? C.blueLight : C.text} style={[styles.flex, { textAlign: 'right' }]}>
                        {names.get(f.home)}
                      </Txt>
                      <Txt v="num13" style={{ width: 52, textAlign: 'center' }}>
                        {f.homeGoals}–{f.awayGoals}
                      </Txt>
                      <Txt v="bodySemi" numberOfLines={1} color={f.away === YOUR_ID ? C.blueLight : C.text} style={styles.flex}>
                        {names.get(f.away)}
                      </Txt>
                    </View>
                  );
                })}
              </View>
            </>
          ))}

        <Txt v="capBody" color={C.textDim} style={styles.center}>
          Every club plays every other club home and away · {result.pointsForWin} points for a win
        </Txt>
      </View>

      {done &&
        (onNewGame ? (
          <EndBar onNewGame={finish(onNewGame)} onExit={finish(onExit)} />
        ) : (
          <Btn kind="green" icon="check" label="Finish season" height={48} onPress={finish(onExit)} />
        ))}
    </>
  );
}

/** Before the end: matchday, your place, record and form. */
function SeasonProgress({ save, you, form }: { save: LeagueSeasonSave; you: SeasonRow; form: readonly ('W' | 'D' | 'L')[] }) {
  const { revealed, rounds } = save;
  return (
    <View style={styles.progressCard}>
      <View style={styles.between}>
        <View style={[styles.row4, styles.flexShrink]}>
          <Icon name="leaderboard" size={17} color={C.green} />
          <Txt v="h20" numberOfLines={1} style={styles.flexShrink}>
            {leagueSeasonTitle(save)}
          </Txt>
        </View>
        <Chip label={`MATCHDAY ${revealed}/${rounds}`} color={C.green} bg={C.surface3} type="capUpper" radius={R.pill} />
      </View>
      <View style={styles.progressBar}>
        <View style={{ flex: revealed, backgroundColor: C.green }} />
        <View style={{ flex: rounds - revealed }} />
      </View>
      <View style={styles.strip}>
        <StripItem label="POSITION" value={revealed ? ordinal(you.position) : '–'} color={C.blueLight} />
        <StripItem label="RECORD" value={`${you.won}-${you.drawn}-${you.lost}`} color={C.green} />
        <StripItem label="POINTS" value={String(you.points)} color={C.gold} />
      </View>
      {form.length > 0 && (
        <View style={[styles.row4, { alignSelf: 'center' }]}>
          <Txt v="cap" color={C.textMuted}>
            FORM
          </Txt>
          {form.map((m, i) => (
            <View key={i} style={[styles.mark, { backgroundColor: alpha(MARK_COLOR[m], 0.2) }]}>
              <Txt v="cap" color={MARK_COLOR[m]}>
                {m}
              </Txt>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** The season's verdict: trophy card, record strip, your top scorers. */
function SeasonCard({ save }: { save: LeagueSeasonSave }) {
  const { result } = save;
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
      ? save.teamName
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
            Simulated {leagueSeasonTitle(save)}
          </Txt>
        </View>
        <Chip label="CAMPAIGN COMPLETED" color={C.onGold} bg={C.goldDeep} radius={R.pill} style={{ paddingVertical: 2 }} />
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
          <Txt v="num13" color={gold ? C.onGoldDark : C.text} style={{ textTransform: 'uppercase', letterSpacing: 0.325 }}>
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

export function TableRow({
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
            i === 1 || i === 0 ? styles.tdLeft : i === cells.length - 1 ? styles.tdRight : styles.tdCenter,
          ]}>
          {i === 1 && yours ? (
            <View style={styles.row4}>
              <Icon name="star" size={13} color={C.blueLight} />
              <Txt v="num13" color={C.blueLight} numberOfLines={1}>
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

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  progressCard: {
    gap: 10,
    padding: 16,
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_LG,
  },
  progressBar: {
    height: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: R.pill,
    backgroundColor: C.surface4,
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
  flex: {
    flex: 1,
  },
  flexShrink: {
    flexShrink: 1,
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
    marginTop: 4,
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
  table: {
    borderRadius: R.sm,
    overflow: 'hidden',
    backgroundColor: C.deep,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
