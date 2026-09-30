import {
  dailyChecks,
  dailyScore,
  dailyShareText,
  legendById,
  scoreOf,
  type DailyResponse,
  type LegendResponse,
  type PlayResponse,
} from '@champion/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { fetchLegend } from '@/api/client';
import { MatchPlay, playLocally } from '@/components/match-play';
import { SaveSquadButton } from '@/components/save-squad';
import { TournamentShell } from '@/components/tournament-shell';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn, Glow, SHADOW_SM } from '@/design/ui';
import { ReminderOffer } from '@/components/notification-settings';
import { playOnline, type ResultReport } from '@/game/online';
import { finishDailyAttempt } from '@/game/daily';
import { shareText } from '@/game/share';
import type { DraftPlayer } from '@/mocks/players';

type Props = {
  daily: DailyResponse;
  formation: string;
  lineup: readonly (DraftPlayer | null)[];
  overall: number;
  chemistry: number;
  onHome: () => void;
  onResult?: (r: ResultReport) => void;
  /** Practice try (store item): the verdict is shown but nothing is recorded or ranked. */
  practice?: boolean;
};

/** Daily challenge verdict: every rule checked (and the legend match, if any), then share. */
export function DailyResult({ daily, formation, lineup, overall, chemistry, onHome, onResult, practice = false }: Props) {
  const { challenge, date } = daily;
  const legend = challenge.rules.opponentLegend ? legendById(challenge.rules.opponentLegend) : null;
  const [match, setMatch] = useState<{ yours: number; theirs: number } | null>(null);
  const [legendXI, setLegendXI] = useState<LegendResponse | null>(null);
  const [legendMissing, setLegendMissing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // The official result, played and scored on the server (not for a practice try).
  const [server, setServer] = useState<Extract<PlayResponse, { mode: 'daily' }> | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!legend) return;
    fetchLegend(legend.id)
      .then(setLegendXI)
      .catch(() => setLegendMissing(true));
  }, [legend]);

  const playDaily = async () => {
    const r = await playOnline({ mode: 'daily', date });
    if (r.mode !== 'daily') throw new Error('Unexpected answer from the server');
    setServer(r);
    return r;
  };
  // No legend: the server checks the targets straight away.
  useEffect(() => {
    if (practice || legend) return;
    let live = true;
    playOnline({ mode: 'daily', date })
      .then((r) => live && r.mode === 'daily' && setServer(r))
      .catch((e) => live && setServerError(e instanceof Error ? e.message : 'No connection to the server'));
    return () => {
      live = false;
    };
  }, [practice, legend, date]);

  // Practice: checked here (nothing is recorded). Official: the server's verdict.
  const serverMatch = server?.played ? scoreOf(server.played) : null;
  const final = practice ? !legend || match !== null || legendMissing : !!server;
  const outcome = useMemo(
    () => ({
      chemistry,
      overall,
      match: legend ? (practice ? match : serverMatch ? { yours: serverMatch.yours, theirs: serverMatch.theirs } : match) : undefined,
    }),
    [chemistry, overall, legend, practice, match, serverMatch],
  );
  const checks = server?.checks ?? dailyChecks(challenge, outcome);
  const success = final && (server ? server.success : checks.every((c) => c.ok));
  const share = dailyShareText(challenge, date, outcome);
  const score = server?.score ?? dailyScore(challenge, outcome).score;

  const recorded = useRef(false);
  useEffect(() => {
    if (!server || recorded.current || practice) return;
    recorded.current = true;
    finishDailyAttempt(date, server.success, share);
    onResult?.(server.report);
  }, [server, share, date, onResult, practice]);

  const rating = legendXI?.xi.length
    ? legendXI.xi.reduce((s, p) => s + (p.rating ?? 50), 0) / legendXI.xi.length
    : null;

  return (
    <TournamentShell title="Daily Challenge" onBack={onHome}>
      <Animated.View entering={FadeIn.duration(250)} style={styles.hero}>
        <Glow color={success ? C.green : C.gold} opacity={0.18} size={220} style={{ right: -60, top: -80 }} />
        <Txt v="capUpper" color={C.gold}>
          {date} · {challenge.tier}
        </Txt>
        <Txt v="h24">{challenge.title}</Txt>
        <Txt v="body" color={C.textMuted}>
          {challenge.description}
        </Txt>
        <View style={styles.checks}>
          {checks.map((c) => {
            const pending = !final && c.label.startsWith('Beat');
            return (
              <View key={c.label} style={styles.check}>
                <View
                  style={[styles.box, { backgroundColor: pending ? C.surface4 : c.ok ? C.greenStrong : C.redDeep }]}>
                  <Icon
                    name={pending ? 'hourglass_empty' : c.ok ? 'check' : 'close'}
                    size={14}
                    color={pending ? C.textMuted : c.ok ? C.onGreen : C.red}
                  />
                </View>
                <Txt v="bodySemi" style={styles.flex}>
                  {c.label}
                </Txt>
              </View>
            );
          })}
        </View>
      </Animated.View>

      {legend && !legendMissing && (
        <MatchPlay
          formation={formation}
          lineup={lineup}
          overall={overall}
          chemistry={chemistry}
          opponentName={legend.nickname}
          opponentRating={rating}
          opponentChip="DAILY BOSS"
          meta={`${legend.club} ${legend.season} · DAILY CHALLENGE`}
          metaPlayed={`${legend.club} ${legend.season}`}
          simulate={async (you) => {
            if (practice) {
              const opp = legendXI ?? (await fetchLegend(legend.id));
              return playLocally(you, { name: legend.nickname, xi: opp.xi });
            }
            // Official: played on the server, which keeps it – asking again shows the same match.
            const r = await playDaily();
            if (!r.played) throw new Error('The legend’s squad isn’t available – the match counts as lost.');
            return r.played;
          }}
          onFinished={() => undefined}
          onNewGame={onHome}
          onExit={onHome}
          hideEndBar
          onResult={(r) => setMatch({ yours: r.yours, theirs: r.theirs })}
        />
      )}
      {serverError && !server && (
        <Txt v="bodySemi" color={C.red} style={styles.center}>
          {serverError}
        </Txt>
      )}
      {legendMissing && (
        <Txt v="bodySemi" color={C.red} style={styles.center}>
          The legend&apos;s squad couldn&apos;t be loaded – the match counts as lost.
        </Txt>
      )}

      {final && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.verdict, { borderColor: success ? C.green : C.red }]}>
          <Icon name={success ? 'emoji_events' : 'flag'} size={28} color={success ? C.gold : C.red} />
          <Txt v="h24" color={success ? C.green : C.red}>
            {success ? 'Challenge complete!' : 'Challenge failed'}
          </Txt>
          <Txt v="body" color={C.textMuted} style={styles.center}>
            {success ? `${challenge.tier} challenge done · ` : ''}One attempt a day – a new challenge tomorrow.
          </Txt>
          {!practice && (
            <View style={styles.scoreBox}>
              <Txt v="capUpper" color={C.textMuted}>
                DAILY SCORE
              </Txt>
              <Txt v="h28" color={C.gold}>
                {score}
                <Txt v="bodySemi" color={C.textDim}>
                  {' '}
                  / 300
                </Txt>
              </Txt>
              <Txt v="capBody" color={C.textMuted} style={styles.center}>
                {server && !server.counted
                  ? 'Your first result today already counts in the mini-leagues.'
                  : server && server.leagues > 0
                    ? `Counts in your ${server.leagues} mini-league${server.leagues === 1 ? '' : 's'} this week.`
                    : 'Start a mini-league with friends on the Ranks tab – this score counts there.'}
              </Txt>
            </View>
          )}
          <View style={styles.shareBox}>
            <Txt v="body" style={styles.mono}>
              {share}
            </Txt>
          </View>
          {!practice && <ReminderOffer />}
          <View style={styles.row}>
            <Btn kind="dark" icon="sports_soccer" label="Home" onPress={onHome} style={styles.flex} />
            <Btn
              kind="gold"
              icon="share"
              label="Share"
              onPress={async () => {
                const r = await shareText(share);
                setNote(r === 'copied' ? 'Copied to the clipboard.' : r === 'failed' ? 'Sharing failed.' : null);
              }}
              style={styles.flex}
            />
          </View>
          {note && (
            <Txt v="capBody" color={C.textMuted}>
              {note}
            </Txt>
          )}
          <View style={styles.save}>
            <SaveSquadButton />
          </View>
        </Animated.View>
      )}
    </TournamentShell>
  );
}

const styles = StyleSheet.create({
  scoreBox: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    borderRadius: R.sm,
    backgroundColor: alpha(C.gold, 0.08),
  },
  hero: {
    gap: 6,
    padding: 16,
    overflow: 'hidden',
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  checks: {
    gap: 6,
    marginTop: 6,
  },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  verdict: {
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: R.md,
    borderWidth: 1,
    backgroundColor: C.surface,
  },
  shareBox: {
    alignSelf: 'stretch',
    padding: 12,
    borderRadius: R.sm,
    backgroundColor: alpha(C.deep, 0.8),
  },
  mono: {
    fontFamily: 'Inter_400Regular',
  },
  save: {
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'stretch',
  },
});
