import { dailyChecks, dailyScore, dailyShareText, legendById, type DailyScoreResponse, type DailyResponse, type LegendResponse } from '@champion/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { fetchLegend, submitDailyScore } from '@/api/client';
import { MatchPlay, playLocally } from '@/components/match-play';
import { SaveSquadButton } from '@/components/save-squad';
import { TournamentShell } from '@/components/tournament-shell';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn, Glow, SHADOW_SM } from '@/design/ui';
import type { ResultReport } from '@/game/online';
import { dailyMatch, finishDailyAttempt, saveDailyMatch } from '@/game/daily';
import { shareText } from '@/game/share';
import { ensureUser } from '@/game/user';
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
  // The official score on the server (mini-leagues): sending, sent, or offline.
  const [posted, setPosted] = useState<DailyScoreResponse | 'sending' | 'offline' | null>(null);

  useEffect(() => {
    if (!legend) return;
    fetchLegend(legend.id)
      .then(setLegendXI)
      .catch(() => setLegendMissing(true));
  }, [legend]);

  // Without a playable legend the match counts as not won (offline / squad not imported).
  const final = !legend || match !== null || legendMissing;
  const outcome = useMemo(() => ({ chemistry, overall, match: legend ? match : undefined }), [chemistry, overall, legend, match]);
  const checks = dailyChecks(challenge, outcome);
  const success = final && checks.every((c) => c.ok);
  const share = dailyShareText(challenge, date, outcome);
  const score = dailyScore(challenge, outcome).score;

  const recorded = useRef(false);
  useEffect(() => {
    if (!final || recorded.current || practice) return;
    recorded.current = true;
    finishDailyAttempt(date, success, share);
    // Mini-leagues: the day's official score (the server checks it against the real challenge).
    setPosted('sending');
    ensureUser()
      .then((u) => submitDailyScore({ userId: u.userId, date, challengeId: challenge.id, outcome }))
      .then(setPosted)
      .catch(() => setPosted('offline'));
    onResult?.({
      mode: 'daily',
      title: `Daily ${date}: ${challenge.title}`,
      detail: `${checks.filter((c) => c.ok).length}/${checks.length} targets`,
      outcome: success ? 'win' : 'loss',
    });
  }, [final, success, checks, share, date, challenge, onResult, practice, outcome]);

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
            // The day's match is decided at kick-off and kept: leaving mid-match shows the same one again.
            const kept = practice ? null : dailyMatch(date);
            if (kept) return kept;
            const opp = legendXI ?? (await fetchLegend(legend.id));
            const played = playLocally(you, { name: legend.nickname, xi: opp.xi });
            if (!practice) saveDailyMatch(date, played);
            return played;
          }}
          onFinished={() => undefined}
          onNewGame={onHome}
          onExit={onHome}
          hideEndBar
          onResult={(r) => setMatch({ yours: r.yours, theirs: r.theirs })}
        />
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
                {posted && typeof posted === 'object' ? posted.score : score}
                <Txt v="bodySemi" color={C.textDim}>
                  {' '}
                  / 300
                </Txt>
              </Txt>
              <Txt v="capBody" color={C.textMuted} style={styles.center}>
                {posted === 'sending'
                  ? 'Sending to your mini-leagues…'
                  : posted === 'offline'
                    ? 'Offline – the score couldn’t be sent to your mini-leagues.'
                    : posted && !posted.counted
                      ? 'Your first result today already counts in the mini-leagues.'
                      : posted && posted.leagues > 0
                        ? `Counts in your ${posted.leagues} mini-league${posted.leagues === 1 ? '' : 's'} this week.`
                        : 'Start a mini-league with friends on the Ranks tab – this score counts there.'}
              </Txt>
            </View>
          )}
          <View style={styles.shareBox}>
            <Txt v="body" style={styles.mono}>
              {share}
            </Txt>
          </View>
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
