import {
  matchEvents,
  sideFromLineup,
  simulateMatch,
  type MatchEvent,
  type MatchPlayer,
  type MatchResult,
  type MatchSide,
} from '@champion/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { EndBar } from '@/components/tournament-shell';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn, SHADOW_LG, SHADOW_SM } from '@/design/ui';
import type { DraftPlayer } from '@/mocks/players';
import { Fireworks } from '@/components/celebration';
import { teamName, useProgress } from '@/game/progress';

/** A played match from your point of view (the engine's home side is `youAtHome ? you : them`). */
export type Played = {
  youAtHome: boolean;
  /** Final on neutral ground: no home advantage (you are the engine's "home" side). */
  neutral?: boolean;
  opponentName: string;
  result: MatchResult;
  /** Goals with assists, yellow and red cards, by minute. */
  events: MatchEvent[];
};

/** Live match clock: running through a half, waiting at half-time, or over. */
type Clock = { minute: number; phase: 'first' | 'ht' | 'second' | 'ft' };
/** Real time per match minute in a live match (45 minutes ≈ 20 s; fast: ≈ 4 s). */
const TICK_MS = 450;
const FAST_TICK_MS = 90;

/** How a match already played is shown: result at once, live, or live at fast speed. */
export type WatchSpeed = 'quick' | 'live' | 'fast';

const pct = (p: number) => `${Math.round(p * 100)}%`;
const initialOf = (name: string) => {
  const parts = name.split(' ');
  return parts.length > 1 ? `${parts[0]![0]}. ${parts.slice(1).join(' ')}` : name;
};

/** Your drafted XI as a match side. */
export function yourSide(formation: string, lineup: readonly (DraftPlayer | null)[]): MatchSide {
  return sideFromLineup(
    teamName(),
    formation,
    lineup.map((p) => (p ? { ...p, rating: p.rating ?? null } : null)),
  );
}

/** Plays your side against `opponent` on this device: random venue (or neutral), goals, cards. */
export function playLocally(
  you: MatchSide,
  opponent: { name: string; xi: MatchPlayer[]; factor?: number },
  venue: 'random' | 'neutral' = 'random',
): Played {
  const them = { name: opponent.name, xi: opponent.xi, factor: opponent.factor ?? 1 };
  const neutral = venue === 'neutral';
  const youAtHome = neutral || Math.random() < 0.5;
  const [home, away] = youAtHome ? [you, them] : [them, you];
  const result = simulateMatch(home, away, Math.random, { neutral });
  return { youAtHome, neutral, opponentName: opponent.name, result, events: matchEvents(home, away, result) };
}

export type MatchOutcome = { outcome: 'win' | 'draw' | 'loss'; yours: number; theirs: number; played: Played };

type Props = {
  formation: string;
  lineup: readonly (DraftPlayer | null)[];
  overall: number;
  chemistry: number;
  opponentName: string;
  /** Rating shown on the opponent crest (null = unknown yet). */
  opponentRating: number | null;
  /** Small chip under the opponent (Elo, place, "LEGEND"…). */
  opponentChip: string;
  /** Meta tag above the teams before kick-off, e.g. "ESP 2008/09 · VENUE DRAWN AT KICK-OFF". */
  meta: string;
  /** Tag after kick-off, e.g. "ESP 2008/09" (prefixed with HOME/AWAY/NEUTRAL MATCH). */
  metaPlayed: string;
  /** Plays the match (locally or on the server). */
  simulate: (you: MatchSide) => Promise<Played>;
  onFinished: () => void;
  onNewGame: () => void;
  onExit: () => void;
  /** The result, once (quick sim: at once; live: at full time). */
  onResult?: (outcome: MatchOutcome) => void;
  /** Extra content under the result (e.g. a legend's story). */
  children?: ReactNode;
  /** No end bar (the daily challenge shows its own verdict). */
  hideEndBar?: boolean;
  /** Shown instead of the kick-off buttons until the match can start (head-to-head search). */
  preMatch?: ReactNode;
  /** A match that is already decided (a league matchday): shown at once, no kick-off buttons. */
  preplayed?: { played: Played; speed: WatchSpeed };
};

/**
 * One match: versus card, Quick sim or Live match (clock 0'–45', half-time, 45'–90'), scoreboard,
 * timeline with goals, assists and cards; afterwards only "new game" or home.
 */
export function MatchPlay({
  formation,
  lineup,
  overall,
  chemistry,
  opponentName,
  opponentRating,
  opponentChip,
  meta,
  metaPlayed,
  simulate,
  onFinished,
  onNewGame,
  onExit,
  onResult,
  children,
  hideEndBar,
  preMatch,
  preplayed,
}: Props) {
  const [played, setPlayed] = useState<Played | null>(preplayed?.played ?? null);
  const [playing, setPlaying] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorText, setErrorText] = useState<string | null>(null);
  // null = quick sim (everything shown at once).
  const [clock, setClock] = useState<Clock | null>(
    preplayed && preplayed.speed !== 'quick' ? { minute: 0, phase: 'first' } : null,
  );
  const [fast, setFast] = useState(preplayed?.speed === 'fast');
  const running = clock?.phase === 'first' || clock?.phase === 'second';
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setClock((c) => {
        if (!c || (c.phase !== 'first' && c.phase !== 'second')) return c;
        const minute = c.minute + 1;
        if (c.phase === 'first' && minute >= 45) return { minute: 45, phase: 'ht' };
        if (minute >= 90) return { minute: 90, phase: 'ft' };
        return { ...c, minute };
      });
    }, fast ? FAST_TICK_MS : TICK_MS);
    return () => clearInterval(timer);
  }, [running, fast]);

  // Report the result when it is known to the player: at once, or at full time.
  const reported = useRef(false);
  useEffect(() => {
    if (!played || reported.current || (clock && clock.phase !== 'ft')) return;
    reported.current = true;
    const ours = played.events.filter(
      (e) => e.type === 'goal' && e.side === (played.youAtHome ? 'home' : 'away'),
    ).length;
    const total = played.result.homeGoals + played.result.awayGoals;
    const theirs = total - ours;
    onResult?.({ outcome: ours > theirs ? 'win' : ours === theirs ? 'draw' : 'loss', yours: ours, theirs, played });
  }, [played, clock, onResult]);

  const play = async (live: boolean) => {
    setPlaying('loading');
    try {
      const p = await simulate(yourSide(formation, lineup));
      setPlayed(p);
      setClock(live ? { minute: 0, phase: 'first' } : null);
      onFinished();
      setPlaying('idle');
    } catch (e) {
      setErrorText(e instanceof Error && e.message ? e.message : null);
      setPlaying('error');
    }
  };

  const tag = played
    ? `${played.neutral ? 'NEUTRAL' : played.youAtHome ? 'HOME' : 'AWAY'} MATCH · ${metaPlayed}`
    : meta;

  return (
    <>
      <Animated.View entering={FadeIn.duration(250)} style={styles.banner}>
        <View style={styles.bannerGlow} />
        <View style={styles.metaTag}>
          <Icon name="location_on" size={12} color={C.textMuted} />
          <Txt v="capUpper" color={C.textMuted} numberOfLines={1} style={styles.flexShrink}>
            {tag}
          </Txt>
        </View>
        <View style={styles.versus}>
          <TeamBox name={teamName()} rating={overall} chip={`CHEM ${chemistry}`} chipColor={C.green} you />
          <View style={styles.vs}>
            <Txt v="h20" color={C.gold}>
              VS
            </Txt>
          </View>
          <TeamBox name={opponentName} rating={opponentRating} chip={opponentChip} chipColor={C.textMuted} />
        </View>
        {played && <Scoreboard played={played} clock={clock} />}
      </Animated.View>

      {played && <Timeline played={played} clock={clock} />}
      {played && (!clock || clock.phase === 'ft') && children}

      {playing === 'error' && (
        <Txt v="bodySemi" color={C.red} style={styles.center}>
          {errorText ?? 'Couldn’t play the match – check your connection.'}
        </Txt>
      )}
      {clock && clock.phase !== 'ft' ? (
        clock.phase === 'ht' ? (
          <Btn
            kind="green"
            icon="play_arrow"
            label="Start 2nd half"
            sub="45' → 90'"
            onPress={() => setClock({ minute: 45, phase: 'second' })}
          />
        ) : (
          <View style={styles.playRow}>
            <Btn
              kind="dark"
              icon={fast ? 'slow_motion_video' : 'fast_forward'}
              label={fast ? 'Normal speed' : 'Fast'}
              onPress={() => setFast((f) => !f)}
              style={styles.flex}
            />
            <Btn
              kind="dark"
              icon="arrow_forward"
              label="Skip to FT"
              onPress={() => setClock({ minute: 90, phase: 'ft' })}
              style={styles.flex}
            />
          </View>
        )
      ) : played ? (
        hideEndBar ? null : (
          <EndBar onNewGame={onNewGame} onExit={onExit} />
        )
      ) : preMatch ? (
        preMatch
      ) : (
        <View style={styles.playRow}>
          <Btn
            kind="blue"
            icon="bolt"
            label={playing === 'loading' ? 'Loading…' : 'Quick sim'}
            sub="Result at once"
            disabled={playing === 'loading'}
            onPress={() => play(false)}
            style={styles.flex}
          />
          <Btn
            kind="green"
            icon="timer"
            label="Live match"
            sub="0' → 90', half-time"
            disabled={playing === 'loading'}
            onPress={() => play(true)}
            style={styles.flex}
          />
        </View>
      )}
      {playing === 'loading' && <ActivityIndicator color={C.green} />}
    </>
  );
}

function TeamBox({
  name,
  rating,
  chip,
  chipColor,
  you,
}: {
  name: string;
  rating: number | null;
  chip: string;
  chipColor: string;
  you?: boolean;
}) {
  return (
    <View style={styles.team}>
      <View style={[styles.crest, { backgroundColor: you ? alpha(C.blue, 0.2) : C.surface4 }]}>
        <Icon name="shield" size={24} color={you ? C.blueLight : C.textMuted} />
        {rating !== null && (
          <View style={[styles.crestBadge, { backgroundColor: you ? C.blue : C.divider }]}>
            <Txt
              v="cap"
              color={you ? C.onBlue : C.text}
              style={{ fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 0 }}>
              {Math.round(rating)}
            </Txt>
          </View>
        )}
      </View>
      <Txt v="h20" numberOfLines={1} adjustsFontSizeToFit style={styles.center}>
        {name}
      </Txt>
      <View style={styles.teamChip}>
        <Txt v="cap" color={chipColor}>
          {chip}
        </Txt>
      </View>
    </View>
  );
}

/** Final score, verdict and the pre-match numbers (from your point of view). */
function Scoreboard({ played, clock }: { played: Played; clock: Clock | null }) {
  const { youAtHome, result } = played;
  const yourSide = youAtHome ? 'home' : 'away';
  // Live: only what has happened so far.
  const shown = played.events.filter((e) => e.type === 'goal' && (!clock || e.minute <= clock.minute));
  const yours = shown.filter((e) => e.side === yourSide).length;
  const theirs = shown.length - yours;
  const over = !clock || clock.phase === 'ft';
  const outcome = yours > theirs ? 'win' : yours === theirs ? 'draw' : 'loss';
  // Store cosmetic: fireworks on each of your goals during a live match.
  const celebrate = useProgress().equipped.celebration === 'celebration-fireworks';
  const live = !!clock && clock.phase !== 'ft';
  const c = result.chances;
  const win = youAtHome ? c.win : c.loss;
  const loss = youAtHome ? c.loss : c.win;
  const xgYou = youAtHome ? result.expected.home : result.expected.away;
  const xgThem = youAtHome ? result.expected.away : result.expected.home;
  const verdict = {
    win: { text: 'YOU WIN! MATCH SECURED', bg: C.greenStrong, fg: C.onGreen, icon: 'emoji_events' as const },
    draw: { text: 'DRAW · POINTS SHARED', bg: C.goldDeep, fg: C.onGold, icon: 'handshake' as const },
    loss: { text: 'DEFEAT · BACK TO THE DRAWING BOARD', bg: C.redDeep, fg: C.red, icon: 'flag' as const },
  }[outcome];

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.scoreWrap}>
      {celebrate && live && yours > 0 && <Fireworks key={yours} />}
      {clock && (
        <View style={[styles.clock, clock.phase === 'first' || clock.phase === 'second' ? styles.clockLive : null]}>
          {(clock.phase === 'first' || clock.phase === 'second') && <View style={styles.liveDot} />}
          <Txt v="num13" color={clock.phase === 'ft' ? C.textMuted : clock.phase === 'ht' ? C.gold : C.green}>
            {clock.phase === 'ht' ? 'HALF-TIME' : clock.phase === 'ft' ? "FULL-TIME 90'" : `LIVE ${clock.minute}'`}
          </Txt>
        </View>
      )}
      <View style={styles.scoreboard}>
        <Txt v="h36" color={!over ? C.text : outcome === 'loss' ? C.text : C.green}>
          {yours}
        </Txt>
        <Txt v="h20" color={C.textDim}>
          –
        </Txt>
        <Txt v="h36" color={over && outcome === 'loss' ? C.red : C.text}>
          {theirs}
        </Txt>
      </View>
      <Txt v="cap" color={C.textDim}>
        {played.neutral
          ? `${teamName()} – opponent · neutral ground`
          : youAtHome
            ? `${teamName()} (home) – opponent (away)`
            : `${teamName()} (away) – opponent (home)`}
      </Txt>
      {over && (
        <View
          style={[styles.verdict, { backgroundColor: verdict.bg, boxShadow: `0px 0px 8px ${alpha(verdict.bg, 0.4)}` }]}>
          <Icon name={verdict.icon} size={12} color={verdict.fg} />
          <Txt v="h14" color={verdict.fg} style={{ textTransform: 'uppercase' }}>
            {verdict.text}
          </Txt>
        </View>
      )}

      {over && (
        <View style={styles.meter}>
          <View style={styles.meterHead}>
            <Txt v="body" color={C.textMuted}>
              xG {xgYou.toFixed(1)} vs {xgThem.toFixed(1)}
            </Txt>
            <Txt v="cap" color={C.green}>
              Win Chance {pct(win)}
            </Txt>
          </View>
          <View style={styles.bar}>
            <View style={{ flex: win, backgroundColor: C.green }} />
            <View style={{ flex: c.draw, backgroundColor: C.divider }} />
            <View style={{ flex: loss, backgroundColor: C.redDeep }} />
          </View>
          <View style={styles.meterHead}>
            <Txt v="capBody" color={C.textDim}>
              Win: {pct(win)}
            </Txt>
            <Txt v="capBody" color={C.textDim}>
              Draw: {pct(c.draw)}
            </Txt>
            <Txt v="capBody" color={C.textDim}>
              Loss: {pct(loss)}
            </Txt>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

/** Goals (with assists) and cards in order, yours in blue; live: only what has happened so far. */
function Timeline({ played, clock }: { played: Played; clock: Clock | null }) {
  const yourSide = played.youAtHome ? 'home' : 'away';
  const events = played.events.filter((e) => !clock || e.minute <= clock.minute);
  const status = !clock || clock.phase === 'ft' ? "FT 90'" : clock.phase === 'ht' ? 'HT' : `${clock.minute}'`;
  // Running score from your point of view (yours – theirs), like the scoreboard.
  let ours = 0;
  let theirs = 0;
  return (
    <View style={styles.timeline}>
      <View style={styles.between}>
        <View style={styles.row4}>
          <Icon name="sports" size={17} color={C.green} />
          <Txt v="h20">Match Timeline</Txt>
        </View>
        <View style={styles.ft}>
          <Txt v="cap" color={clock && clock.phase !== 'ft' ? C.green : C.textMuted}>
            {status}
          </Txt>
        </View>
      </View>
      {events.length === 0 ? (
        <Txt v="body" color={C.textMuted}>
          {clock && clock.phase !== 'ft' ? 'Nothing yet…' : 'No goals. A 0–0 draw.'}
        </Txt>
      ) : (
        <View style={styles.events}>
          <View style={styles.eventsLine} />
          {events.map((e, k) => {
            const yours = e.side === yourSide;
            if (e.type === 'goal') {
              if (yours) ours++;
              else theirs++;
            }
            const team = yours ? teamName() : played.opponentName;
            const detail =
              e.type === 'goal'
                ? e.assist
                  ? `Assist: ${initialOf(e.assist)} · ${team}`
                  : `Solo goal · ${team}`
                : e.type === 'yellow'
                  ? `Yellow card · ${team}`
                  : `${e.secondYellow ? 'Second yellow – sent off' : 'Red card'} · ${team}`;
            return (
              <Animated.View key={k} entering={clock ? FadeIn.duration(400) : undefined} style={styles.event}>
                <View style={[styles.eventDot, { backgroundColor: yours ? C.blue : C.divider }]} />
                <View style={[styles.row8, styles.flexShrink]}>
                  <Txt v="num13" color={yours ? C.blueLight : C.textMuted}>
                    {e.minute}&apos;
                  </Txt>
                  {e.type === 'goal' ? (
                    <Icon name="sports_soccer" size={14} color={yours ? C.blueLight : C.textMuted} />
                  ) : (
                    <View style={[styles.bookCard, { backgroundColor: e.type === 'yellow' ? C.gold : '#E5484D' }]} />
                  )}
                  <View style={styles.flexShrink}>
                    <Txt v="h14" color={yours ? C.blueLight : C.text} numberOfLines={1}>
                      {initialOf(e.player)}
                    </Txt>
                    <Txt v="body" color={C.textMuted} numberOfLines={1} style={{ fontSize: 11, lineHeight: 16.5 }}>
                      {detail}
                    </Txt>
                  </View>
                </View>
                {e.type === 'goal' && (
                  <View style={[styles.scoreChip, { backgroundColor: yours ? alpha(C.blue, 0.2) : C.surface4 }]}>
                    <Txt v="cap" color={yours ? C.blueLight : C.text}>
                      {ours} – {theirs}
                    </Txt>
                  </View>
                )}
              </Animated.View>
            );
          })}
        </View>
      )}
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
  center: {
    textAlign: 'center',
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
  row8: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flexShrink: {
    flexShrink: 1,
  },
  banner: {
    alignItems: 'center',
    padding: 16,
    borderRadius: R.md,
    overflow: 'hidden',
    backgroundColor: C.surface,
    boxShadow: SHADOW_LG,
  },
  bannerGlow: {
    ...StyleSheet.absoluteFill,
    opacity: 0.25,
    experimental_backgroundImage: `radial-gradient(ellipse 60% 55% at 50% 0%, ${C.green} 0%, ${C.deep} 50%, ${alpha(C.deep, 0)} 100%)`,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: alpha(C.surface4, 0.6),
  },
  versus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  team: {
    flex: 3,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: R.md,
    backgroundColor: alpha(C.surface3, 0.6),
  },
  crest: {
    width: 56,
    height: 56,
    marginBottom: 4,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestBadge: {
    position: 'absolute',
    bottom: -4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: R.pill,
  },
  teamChip: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: R.xs,
    backgroundColor: C.surface4,
  },
  vs: {
    flex: 1,
    alignItems: 'center',
  },
  scoreWrap: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
    paddingTop: 24,
  },
  scoreboard: {
    width: 260,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    borderRadius: R.lg,
    backgroundColor: C.deep,
  },
  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: R.pill,
  },
  meter: {
    width: '100%',
    gap: 4,
    marginTop: 8,
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 8,
    borderRadius: R.md,
    backgroundColor: alpha(C.surface3, 0.4),
  },
  meterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bar: {
    height: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: R.pill,
    backgroundColor: C.surface4,
  },
  timeline: {
    gap: 8,
    padding: 16,
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  ft: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: R.xs,
    backgroundColor: C.surface4,
  },
  events: {
    gap: 8,
    paddingLeft: 24,
  },
  eventsLine: {
    position: 'absolute',
    left: 8,
    top: 8,
    bottom: 8,
    width: 2,
    backgroundColor: C.surface4,
  },
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: R.sm,
    backgroundColor: C.surface2,
  },
  eventDot: {
    position: 'absolute',
    left: -23,
    width: 12,
    height: 12,
    borderRadius: R.pill,
    boxShadow: `0px 0px 0px 4px ${C.surface}`,
  },
  bookCard: {
    width: 10,
    height: 14,
    borderRadius: 2,
  },
  playRow: {
    flexDirection: 'row',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: C.surface3,
  },
  clockLive: {
    backgroundColor: alpha(C.green, 0.15),
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: R.pill,
    backgroundColor: C.green,
  },
  scoreChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: R.xs,
  },
});
