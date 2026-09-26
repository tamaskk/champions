import {
  lastCompleteSeason,
  seasonLabel,
  sideFromLineup,
  simulateCup,
  squadInsight,
  type CupFieldResponse,
  type CupMatch,
  type CupResult,
  type CupTeam,
  type League,
} from '@champion/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { fetchCupField } from '@/api/client';
import { Select } from '@/components/select';
import { SlotReel, type SlotReelHandle } from '@/components/slot-reel';
import { ResultInsight } from '@/components/result-insight';
import { EndBar, TournamentShell, type ShellMode } from '@/components/tournament-shell';
import { Icon } from '@/design/icon';
import type { ResultReport } from '@/game/online';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn, Chip, Glow, SHADOW_LG, SHADOW_SM } from '@/design/ui';
import type { DraftPlayer } from '@/mocks/players';
import { teamName } from '@/game/progress';

type Props = {
  /** random = the season is spun on a reel; pick = chosen from a dropdown (or the Random button). */
  mode: 'random' | 'pick';
  formation: string;
  lineup: readonly (DraftPlayer | null)[];
  overall: number;
  chemistry: number;
  onBack: () => void;
  onMode?: (mode: ShellMode) => void;
  /** Called when the result is in: the squad can't play again. */
  onFinished: () => void;
  onNewGame: () => void;
  onExit: () => void;
  onRandom: (random: boolean) => void;
  /** The cup run's result, for the leaderboard. */
  onResult?: (result: ResultReport) => void;
};

type Load = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; field: CupFieldResponse };
type View3 = 'path' | 'groups' | 'knockouts';

const YOUR_ID = '__you__';
const LEAGUE_SHORT: Record<League, string> = { ENG: 'ENG', ESP: 'ESP', ITA: 'ITA', GER: 'GER', FRA: 'FRA' };

const allSeasons = () => {
  const last = lastCompleteSeason();
  return Array.from({ length: last - 1960 + 1 }, (_, i) => last - i);
};
const randomOf = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/**
 * Champions League mode: your XI joins the 31 strongest clubs of the top five leagues of a season
 * (by Elo): group stage, two-legged knockouts, a final on neutral ground.
 */
export function CupTournament({
  mode,
  formation,
  lineup,
  overall,
  chemistry,
  onBack,
  onMode,
  onRandom,
  onFinished,
  onNewGame,
  onExit,
  onResult,
}: Props) {
  const [season, setSeason] = useState<number | null>(mode === 'pick' ? lastCompleteSeason() : null);
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<Load>({ status: 'idle' });
  const request = useRef(0);

  const drawField = (s: number) => {
    const id = ++request.current;
    setLoad({ status: 'loading' });
    fetchCupField(s)
      .then((field) => id === request.current && setLoad({ status: 'ready', field }))
      .catch(() => id === request.current && setLoad({ status: 'error' }));
  };

  // ---- Random: one season reel.
  const reel = useRef<SlotReelHandle>(null);
  const [reelWidth, setReelWidth] = useState(0);
  const [round, setRound] = useState(0);
  const seasonItems = useMemo(() => allSeasons().map(seasonLabel), []);
  useEffect(() => {
    if (mode === 'random' && reelWidth) requestAnimationFrame(() => reel.current?.spin());
  }, [mode, round, reelWidth]);
  const spinAgain = () => {
    request.current++;
    setLoad({ status: 'idle' });
    setSeason(null);
    setRound((r) => r + 1);
  };

  const field = load.status === 'ready' ? load.field : null;

  // Teams: the field plus your XI.
  const teams = useMemo<CupTeam[] | null>(() => {
    if (!field) return null;
    const you = sideFromLineup(
      teamName(),
      formation,
      lineup.map((p) => (p ? { ...p, rating: p.rating ?? null } : null)),
    );
    return [
      { ...you, id: YOUR_ID, league: null },
      ...field.clubs
        .filter((c) => c.xi.length > 0)
        .map((c) => ({
          id: `${c.league}|${c.clubSlug}`,
          name: c.club,
          xi: c.xi,
          factor: 1,
          league: c.league,
          elo: c.elo,
        })),
    ];
  }, [field, formation, lineup]);
  const byId = useMemo(() => new Map((teams ?? []).map((t) => [t.id, t])), [teams]);
  const name = (id: string) => (id === YOUR_ID ? teamName() : (byId.get(id)?.name ?? '?'));

  const [result, setResult] = useState<CupResult | null>(null);
  const [view, setView] = useState<View3>('path');
  const [simError, setSimError] = useState(false);
  // The "why": your lines against the clubs you actually played.
  const why = useMemo(() => {
    const you = byId.get(YOUR_ID);
    if (!result || !you) return null;
    const mine = result.matches.filter(yoursIn);
    const faced = [...new Set(mine.map((m) => (m.home === YOUR_ID ? m.away : m.home)))].flatMap((id) => {
      const t = byId.get(id);
      return t ? [t] : [];
    });
    return {
      insight: squadInsight(you, faced),
      goalsFor: mine.reduce((n, m) => n + fromYou(m).ours, 0),
      goalsAgainst: mine.reduce((n, m) => n + fromYou(m).theirs, 0),
      matches: mine.length,
    };
  }, [result, byId]);
  useEffect(() => {
    setResult(null);
    setView('path');
    setSimError(false);
  }, [field]);

  const simulate = () => {
    if (!teams) return;
    try {
      const r = simulateCup(teams.slice(0, 32));
      setResult(r);
      const champion = r.championId === YOUR_ID;
      const last = [...r.rounds].reverse().find((x) => x.ties.some((t) => t.a === YOUR_ID || t.b === YOUR_ID));
      onResult?.({
        mode: 'cup',
        title: `Champions League ${season ? seasonLabel(season) : ''}`.trim(),
        detail: champion
          ? 'Winners'
          : last
            ? last.name === 'Final'
              ? 'Runner-up'
              : `Out: ${last.name}`
            : 'Group stage exit',
        outcome: champion
          ? 'champion'
          : last?.name === 'Final' || last?.name === 'Semi-finals'
            ? 'top'
            : last
              ? 'mid'
              : 'out',
      });
      onFinished();
      setSimError(false);
    } catch {
      setSimError(true);
    }
  };

  return (
    <TournamentShell
      title={mode === 'random' ? 'Random Champions League' : 'Champions League'}
      onBack={onBack}
      mode="cup"
      onMode={onMode}>
      {!result && (
        <View style={styles.card}>
          <View style={styles.segment}>
            {(['pick', 'random'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => onRandom(m === 'random')}
                style={[styles.segBtn, mode === m && styles.segActive]}>
                <Icon name={m === 'pick' ? 'tune' : 'casino'} size={13} color={mode === m ? C.text : C.textMuted} />
                <Txt v="cap" color={mode === m ? C.text : C.textMuted}>
                  {m === 'pick' ? 'Choose season' : 'Spin the reel'}
                </Txt>
              </Pressable>
            ))}
          </View>

          {mode === 'pick' && (
            <View style={styles.gap8}>
              <Select
                label="Season"
                value={season ? seasonLabel(season) : 'Choose'}
                open={open}
                onToggle={() => setOpen(!open)}
                options={allSeasons().map((s) => ({ key: String(s), label: seasonLabel(s), active: s === season }))}
                onSelect={(key) => {
                  setSeason(Number(key));
                  setOpen(false);
                }}
              />
              <View style={styles.row8}>
                <Btn
                  kind="mid"
                  icon="casino"
                  label="Random"
                  height={44}
                  radius={R.sm}
                  style={styles.flex}
                  onPress={() => {
                    const s = randomOf(allSeasons());
                    setSeason(s);
                    setOpen(false);
                    drawField(s);
                  }}
                />
                <Btn
                  kind="green"
                  icon="groups"
                  label="Draw the field"
                  height={44}
                  radius={R.sm}
                  style={styles.flex}
                  disabled={!season}
                  onPress={() => season && drawField(season)}
                />
              </View>
            </View>
          )}

          {mode === 'random' && !field && (
            <View style={styles.chamber} onLayout={(e) => setReelWidth(e.nativeEvent.layout.width - 16)}>
              {reelWidth > 0 && (
                <View style={styles.reelCol}>
                  <SlotReel
                    key={`season-${round}`}
                    ref={reel}
                    items={seasonItems}
                    width={reelWidth}
                    duration={2600}
                    fontSize={24}
                    onResult={(label) => {
                      const s = Number(label.slice(0, 4));
                      setSeason(s);
                      drawField(s);
                    }}
                  />
                  <View style={styles.reelLabel}>
                    <Txt v="cap" color={C.green}>
                      Season
                    </Txt>
                  </View>
                </View>
              )}
              <View pointerEvents="none" style={styles.payline}>
                <View style={styles.paylineBar} />
                <View style={styles.paylineBar} />
              </View>
            </View>
          )}
          {mode === 'random' && field && (
            <Btn kind="mid" icon="autorenew" label="Spin again" height={44} radius={R.sm} onPress={spinAgain} />
          )}

          {load.status === 'loading' && <ActivityIndicator color={C.green} />}
          {load.status === 'error' && (
            <Txt v="bodySemi" color={C.red} style={styles.center}>
              Couldn&apos;t load the clubs of that season. Check that the web server is running.
            </Txt>
          )}
        </View>
      )}

      {/* The field, by seeding pot, before the draw */}
      {field && teams && !result && !open && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.panel}>
          <View style={styles.between}>
            <View style={[styles.row4, styles.flexShrink]}>
              <Icon name="stars" size={18} color={C.gold} />
              <Txt v="h20" style={styles.flexShrink}>
                Champions League {seasonLabel(field.season)}
              </Txt>
            </View>
            <Chip label={`${teams.length} TEAMS`} color={C.textMuted} bg={C.surface3} type="capUpper" radius={R.pill} />
          </View>
          <Txt v="body" color={C.textMuted}>
            {teamName()} (OVR {Math.round(overall)} · CHEM {chemistry}) joins the {teams.length - 1} strongest clubs of
            Europe&apos;s top five leagues that season. 8 groups of 4, the top two go through; two-legged knockouts; the
            final on neutral ground.
          </Txt>
          <View style={styles.fieldGrid}>
            {teams
              .slice()
              .sort((a, b) => (b.elo ?? 0) - (a.elo ?? 0))
              .map((t) => (
                <View key={t.id} style={[styles.fieldItem, t.id === YOUR_ID && styles.fieldYours]}>
                  <Txt v="capBody" color={t.id === YOUR_ID ? C.blueLight : C.textDim} style={{ width: 28 }}>
                    {t.league ? LEAGUE_SHORT[t.league] : 'XI'}
                  </Txt>
                  <Txt
                    v="bodySemi"
                    numberOfLines={1}
                    style={styles.flexShrink}
                    color={t.id === YOUR_ID ? C.blueLight : C.text}>
                    {t.name}
                  </Txt>
                </View>
              ))}
          </View>
          {teams.length < 32 && (
            <Txt v="bodySemi" color={C.red}>
              Only {teams.length} teams with a squad this season – pick another season.
            </Txt>
          )}
          <Btn
            kind="blue"
            icon="play_arrow"
            label="Simulate Champions League"
            sub="Groups · knockouts · final"
            disabled={teams.length < 32}
            onPress={simulate}
          />
          {simError && (
            <Txt v="bodySemi" color={C.red} style={styles.center}>
              The draw failed – try again.
            </Txt>
          )}
        </Animated.View>
      )}

      {result && field && !open && (
        <>
          <Verdict result={result} season={field.season} name={name} />
          {why && (
            <ResultInsight
              insight={why.insight}
              stats={{ goalsFor: why.goalsFor, goalsAgainst: why.goalsAgainst, matches: why.matches }}
            />
          )}
          <View style={styles.tabs}>
            {(
              [
                { id: 'path', label: 'Your path' },
                { id: 'groups', label: 'Groups' },
                { id: 'knockouts', label: 'Knockouts' },
              ] as const
            ).map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setView(t.id)}
                style={[styles.tab, view === t.id && styles.tabActive]}>
                <Txt v="bodySemi" color={view === t.id ? C.onGreenStrong : C.textMuted}>
                  {t.label}
                </Txt>
              </Pressable>
            ))}
          </View>
          {view === 'path' && <YourPath result={result} name={name} />}
          {view === 'groups' && <Groups result={result} name={name} />}
          {view === 'knockouts' && <Knockouts result={result} name={name} />}
          <EndBar onNewGame={onNewGame} onExit={onExit} />
        </>
      )}
    </TournamentShell>
  );
}

type Named = { name: (id: string) => string };

const yoursIn = (m: CupMatch) => m.home === YOUR_ID || m.away === YOUR_ID;

/** Your score first: goals, extra time and penalties from your point of view. */
function fromYou(m: CupMatch) {
  const home = m.home === YOUR_ID;
  const ours = home ? m.homeGoals : m.awayGoals;
  const theirs = home ? m.awayGoals : m.homeGoals;
  const pens = m.penalties
    ? home
      ? [m.penalties.home, m.penalties.away]
      : [m.penalties.away, m.penalties.home]
    : null;
  return { home, ours, theirs, pens, opponent: home ? m.away : m.home };
}

/** How far you went, the final, your record. */
function Verdict({ result, season, name }: { result: CupResult } & Named & { season: number }) {
  const champion = result.championId === YOUR_ID;
  const lastRound = [...result.rounds].reverse().find((r) => r.ties.some((t) => t.a === YOUR_ID || t.b === YOUR_ID));
  const group = result.groups.find((g) => g.teams.includes(YOUR_ID))!;
  const groupPos = group.result.table.findIndex((r) => r.id === YOUR_ID) + 1;
  const [pill, title, note] = champion
    ? ['CHAMPIONS OF EUROPE', 'You lift the trophy! 🏆', 'Kings of Europe – the ultimate draft.']
    : lastRound?.name === 'Final'
      ? ['RUNNER-UP', 'Lost the final', 'So close. One more spin?']
      : lastRound
        ? [
            'KNOCKED OUT',
            `Out in the ${lastRound.name === 'Round of 16' ? 'round of 16' : lastRound.name.toLowerCase()}`,
            `Group ${group.name} survived, the knockouts didn't.`,
          ]
        : [
            'GROUP STAGE EXIT',
            `${groupPos}${groupPos === 3 ? 'rd' : 'th'} in Group ${group.name}`,
            'Not enough to reach the knockouts.',
          ];

  const mine = result.matches.filter(yoursIn).map(fromYou);
  const won = mine.filter((m) => m.ours > m.theirs).length;
  const drawn = mine.filter((m) => m.ours === m.theirs).length;
  const lost = mine.length - won - drawn;
  const gf = mine.reduce((s, m) => s + m.ours, 0);
  const ga = mine.reduce((s, m) => s + m.theirs, 0);
  const final = result.rounds[result.rounds.length - 1]!.ties[0]!;
  const finalLeg = final.legs[0]!;
  const top = result.scorers.filter((s) => s.teamId === YOUR_ID).slice(0, 3);
  const cupTop = result.scorers[0];

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.trophyCard}>
      <Glow color={C.gold} opacity={0.15} size={200} style={{ right: -60, top: -60 }} />
      <View style={styles.between}>
        <View style={[styles.row4, styles.flexShrink]}>
          <Icon name="emoji_events" size={19} color={C.gold} />
          <Txt v="h20" style={styles.flexShrink}>
            Champions League {seasonLabel(season)}
          </Txt>
        </View>
        <Chip label="COMPLETED" color={C.onGold} bg={C.goldDeep} radius={R.pill} style={{ paddingVertical: 2 }} />
      </View>
      <View style={styles.victory}>
        <View
          style={[
            styles.grail,
            {
              backgroundColor: champion ? C.gold : C.surface4,
              boxShadow: champion ? `0px 0px 10px ${alpha(C.gold, 0.45)}` : undefined,
            },
          ]}>
          <Icon name={champion ? 'emoji_events' : 'flag'} size={14} color={champion ? C.onGoldDark : C.text} />
          <Txt v="num13" color={champion ? C.onGoldDark : C.text} style={{ textTransform: 'uppercase' }}>
            {pill}
          </Txt>
        </View>
        <Txt v="h28" color={champion ? C.gold : C.text} style={styles.center}>
          {title}
        </Txt>
        <Txt v="body14" color={C.textMuted} style={styles.center}>
          {note}
        </Txt>
        <View style={styles.strip}>
          <StripItem label="RECORD" value={`${won}W ${drawn}D ${lost}L`} color={C.green} />
          <StripItem label="GOALS" value={`${gf}:${ga}`} color={C.text} />
          <StripItem label="MATCHES" value={String(mine.length)} color={C.gold} />
        </View>
        <View style={styles.finalRow}>
          <Txt v="capUpper" color={C.textMuted}>
            FINAL
          </Txt>
          <Txt v="bodySemi" style={styles.center}>
            {name(final.a)} {finalLeg.homeGoals}–{finalLeg.awayGoals} {name(final.b)}
            {finalLeg.penalties
              ? ` (pens ${finalLeg.penalties.home}–${finalLeg.penalties.away})`
              : finalLeg.extraTime
                ? ' (aet)'
                : ''}
          </Txt>
        </View>
        {top.length > 0 && (
          <Txt v="body" style={styles.center}>
            ⚽ {top.map((s) => `${s.name} ${s.goals}`).join(' · ')}
          </Txt>
        )}
        {cupTop && (
          <Txt v="body" color={C.textMuted} style={styles.center}>
            Top scorer: {cupTop.name} ({name(cupTop.teamId)}) {cupTop.goals}
          </Txt>
        )}
      </View>
    </Animated.View>
  );
}

function StripItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stripItem}>
      <Txt v="cap" color={C.textMuted}>
        {label}
      </Txt>
      <Txt v="h20" color={color}>
        {value}
      </Txt>
    </View>
  );
}

/** Every match you played, group stage to your last. */
function YourPath({ result, name }: { result: CupResult } & Named) {
  const mine = result.matches.filter(yoursIn);
  return (
    <View style={styles.panel}>
      {mine.map((m, i) => {
        const r = fromYou(m);
        const outcome =
          r.ours !== r.theirs ? (r.ours > r.theirs ? 'W' : 'L') : r.pens ? (r.pens[0]! > r.pens[1]! ? 'W' : 'L') : 'D';
        const color = outcome === 'W' ? C.green : outcome === 'D' ? C.gold : C.red;
        return (
          <View key={i} style={[styles.pathRow, i % 2 === 1 && styles.zebra]}>
            <View style={styles.flex}>
              <Txt v="capBody" color={C.textDim}>
                {m.stage}
              </Txt>
              <Txt v="bodySemi" numberOfLines={1}>
                {m.neutral ? 'vs' : r.home ? 'vs' : '@'} {name(r.opponent)}
                {m.neutral ? ' · neutral' : ''}
              </Txt>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Txt v="num13">
                {r.ours}–{r.theirs}
              </Txt>
              {(m.extraTime || r.pens) && (
                <Txt v="capBody" color={C.textDim}>
                  {r.pens ? `pens ${r.pens[0]}–${r.pens[1]}` : 'aet'}
                </Txt>
              )}
            </View>
            <View style={[styles.mark, { backgroundColor: alpha(color, 0.2) }]}>
              <Txt v="cap" color={color}>
                {outcome}
              </Txt>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** The 8 group tables, yours first; the top two (green) went through. */
function Groups({ result, name }: { result: CupResult } & Named) {
  const groups = [...result.groups].sort(
    (a, b) => Number(b.teams.includes(YOUR_ID)) - Number(a.teams.includes(YOUR_ID)),
  );
  return (
    <View style={styles.gap8}>
      {groups.map((g) => (
        <View key={g.name} style={styles.panel}>
          <Txt v="h14" style={{ textTransform: 'uppercase' }}>
            Group {g.name}
          </Txt>
          <View style={styles.table}>
            <View style={[styles.tr, styles.trHead]}>
              {['#', 'CLUB', 'P', 'GD', 'PTS'].map((h, i) => (
                <Txt key={h} v="capBody" color={C.textMuted} style={[{ flex: i === 1 ? 5 : 1 }, i > 1 && styles.right]}>
                  {h}
                </Txt>
              ))}
            </View>
            {g.result.table.map((r, i) => {
              const yours = r.id === YOUR_ID;
              return (
                <View key={r.id} style={[styles.tr, yours && styles.trYours]}>
                  <View style={[styles.flex, styles.row4]}>
                    <Txt v="bodyBold" color={i < 2 ? C.green : C.textMuted}>
                      {r.position}
                    </Txt>
                  </View>
                  <Txt v="bodySemi" numberOfLines={1} color={yours ? C.blueLight : C.text} style={{ flex: 5 }}>
                    {name(r.id)}
                  </Txt>
                  <Txt v="body" style={[styles.flex, styles.right]}>
                    {r.played}
                  </Txt>
                  <Txt v="body" style={[styles.flex, styles.right]}>
                    {r.goalsFor - r.goalsAgainst > 0 ? '+' : ''}
                    {r.goalsFor - r.goalsAgainst}
                  </Txt>
                  <Txt v="bodyBold" color={yours ? C.gold : C.text} style={[styles.flex, styles.right]}>
                    {r.points}
                  </Txt>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Round of 16 to the final: aggregate scores, legs, extra time and penalties. */
function Knockouts({ result, name }: { result: CupResult } & Named) {
  return (
    <View style={styles.gap8}>
      {result.rounds.map((round) => {
        const final = round.name === 'Final';
        return (
          <View key={round.name} style={[styles.panel, final && styles.finalPanel]}>
            <View style={styles.row4}>
              <Icon name={final ? 'emoji_events' : 'account_tree'} size={16} color={final ? C.gold : C.green} />
              <Txt v="h14" color={final ? C.gold : C.text} style={{ textTransform: 'uppercase' }}>
                {round.name}
              </Txt>
            </View>
            {round.ties.map((t) => {
              const involved = t.a === YOUR_ID || t.b === YOUR_ID;
              const legs = t.legs
                .map(
                  (l, i) =>
                    `${final ? '' : i === 0 ? '1st ' : '2nd '}${l.homeGoals}–${l.awayGoals}${l.penalties ? ` (pens ${l.penalties.home}–${l.penalties.away})` : l.extraTime ? ' aet' : ''}`,
                )
                .join(' · ');
              return (
                <View key={`${t.a}-${t.b}`} style={[styles.tie, involved && styles.trYours]}>
                  <View style={styles.tieTeams}>
                    <Txt
                      v={t.winner === t.a ? 'bodyBold' : 'body'}
                      color={t.winner === t.a ? (t.a === YOUR_ID ? C.blueLight : C.text) : C.textMuted}
                      numberOfLines={1}
                      style={styles.flex}>
                      {name(t.a)}
                    </Txt>
                    <Txt v="num13" color={final ? C.gold : C.text} style={styles.agg}>
                      {t.aggA}–{t.aggB}
                    </Txt>
                    <Txt
                      v={t.winner === t.b ? 'bodyBold' : 'body'}
                      color={t.winner === t.b ? (t.b === YOUR_ID ? C.blueLight : C.text) : C.textMuted}
                      numberOfLines={1}
                      style={[styles.flex, styles.right]}>
                      {name(t.b)}
                    </Txt>
                  </View>
                  <Txt v="capBody" color={C.textDim} style={styles.center}>
                    {final ? `Neutral ground · ${legs}` : legs}
                  </Txt>
                </View>
              );
            })}
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
  panel: {
    gap: 8,
    padding: 16,
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  finalPanel: {
    borderWidth: 1,
    borderColor: alpha(C.gold, 0.4),
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
  right: {
    textAlign: 'right',
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
  reelCol: {
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: R.md,
    backgroundColor: C.surface,
    overflow: 'hidden',
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
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  fieldItem: {
    width: '49%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: R.sm,
    backgroundColor: C.surface2,
  },
  fieldYours: {
    backgroundColor: alpha(C.blue, 0.15),
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
    borderRadius: R.sm,
    backgroundColor: alpha(C.surface3, 0.4),
  },
  stripItem: {
    flex: 1,
    alignItems: 'center',
  },
  finalRow: {
    alignItems: 'center',
    gap: 2,
    marginVertical: 4,
  },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: R.pill,
    backgroundColor: C.surface2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: R.pill,
  },
  tabActive: {
    backgroundColor: C.green,
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: R.sm,
  },
  zebra: {
    backgroundColor: alpha(C.surface2, 0.6),
  },
  mark: {
    width: 24,
    alignItems: 'center',
    paddingVertical: 2,
    borderRadius: R.xs,
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
    paddingVertical: 7,
  },
  trHead: {
    paddingVertical: 4,
    backgroundColor: C.surface2,
  },
  trYours: {
    backgroundColor: alpha(C.blue, 0.15),
  },
  tie: {
    gap: 2,
    padding: 8,
    borderRadius: R.sm,
    backgroundColor: C.surface2,
  },
  tieTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agg: {
    minWidth: 44,
    textAlign: 'center',
  },
});
