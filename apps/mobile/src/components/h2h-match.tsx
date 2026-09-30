import { H2H_WAIT_SECONDS, type H2HMatched, type H2HTicket } from '@champion/shared';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { h2hGhost, h2hQueue, h2hTicket } from '@/api/client';
import { MatchPlay, type Played } from '@/components/match-play';
import { TournamentShell } from '@/components/tournament-shell';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn, Chip, SHADOW_SM } from '@/design/ui';
import { ensureOnlineSquad, type ResultReport } from '@/game/online';
import { ensureUser, useUser } from '@/game/user';
import type { DraftPlayer } from '@/mocks/players';
import { claim } from '@/game/wallet';

type Props = {
  formation: string;
  lineup: readonly (DraftPlayer | null)[];
  overall: number;
  chemistry: number;
  onBack: () => void;
  onFinished: () => void;
  onNewGame: () => void;
  onExit: () => void;
  onResult?: (result: ResultReport) => void;
};

type Search =
  | { status: 'idle' }
  | { status: 'searching'; ticketId: string | null; since: number }
  | { status: 'expired'; ticketId: string }
  | { status: 'matched'; ticket: H2HMatched }
  | { status: 'error' };

const POLL_MS = 2000;

/** Head-to-head: random matchmaking with another player who is looking for an opponent right now. */
export function H2HMatch({
  formation,
  lineup,
  overall,
  chemistry,
  onBack,
  onFinished,
  onNewGame,
  onExit,
  onResult,
}: Props) {
  const user = useUser();
  const [search, setSearch] = useState<Search>({ status: 'idle' });
  const [now, setNow] = useState(() => Date.now());
  const [locked, setLocked] = useState(false);
  const userId = useRef<string | null>(null);

  const onTicket = (t: H2HTicket) => {
    if (t.status === 'matched') setSearch({ status: 'matched', ticket: t });
    else if (t.status === 'expired') setSearch({ status: 'expired', ticketId: t.ticketId });
  };

  const find = async () => {
    setSearch({ status: 'searching', ticketId: null, since: Date.now() });
    try {
      const u = await ensureUser();
      userId.current = u.userId;
      // The server builds your side from the saved squad (never from numbers the app sends).
      const t = await h2hQueue({ userId: u.userId, squadId: await ensureOnlineSquad() });
      if (t.status === 'waiting')
        setSearch({ status: 'searching', ticketId: t.ticketId, since: Date.parse(t.since) || Date.now() });
      else onTicket(t);
    } catch {
      setSearch({ status: 'error' });
    }
  };

  // While waiting: poll the ticket and count down.
  const ticketId = search.status === 'searching' ? search.ticketId : null;
  useEffect(() => {
    if (!ticketId || !userId.current) return;
    const poll = setInterval(() => {
      h2hTicket(ticketId, userId.current!)
        .then(onTicket)
        .catch(() => undefined);
    }, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [ticketId]);

  const ghost = async () => {
    if (search.status !== 'expired' || !userId.current) return;
    try {
      const t = await h2hGhost(search.ticketId, userId.current);
      if (t.status === 'matched') onTicket(t);
      else setSearch({ status: 'error' });
    } catch {
      setSearch({ status: 'error' });
    }
  };

  const ticket = search.status === 'matched' ? search.ticket : null;
  const oppName = ticket ? `@${ticket.opponent.username}` : 'Opponent';
  const left =
    search.status === 'searching' ? Math.max(0, H2H_WAIT_SECONDS - Math.floor((now - search.since) / 1000)) : 0;

  const preMatch = ticket ? undefined : (
    <Animated.View entering={FadeIn.duration(250)} style={styles.card}>
      {search.status === 'idle' || search.status === 'error' ? (
        <>
          <Txt v="body" color={C.textMuted} style={styles.center}>
            You are matched with a random player who is looking for an opponent right now
            {user ? ` · you play as @${user.username}` : ''}.
          </Txt>
          <Btn kind="blue" icon="swords" label="Find an opponent" sub="Random player searching now" onPress={find} />
          {search.status === 'error' && (
            <Txt v="bodySemi" color={C.red} style={styles.center}>
              Couldn&apos;t reach the server. Check that the web server is running.
            </Txt>
          )}
        </>
      ) : search.status === 'searching' ? (
        <View style={styles.searching}>
          <ActivityIndicator color={C.green} />
          <Txt v="h16">Looking for an opponent…</Txt>
          <Txt v="body" color={C.textMuted} style={styles.center}>
            Anyone who starts a head-to-head in the next {left}s plays your XI.
          </Txt>
          <View style={styles.timer}>
            <View style={{ width: `${(left / H2H_WAIT_SECONDS) * 100}%`, height: '100%', backgroundColor: C.green }} />
          </View>
        </View>
      ) : (
        <>
          <View style={styles.searching}>
            <Icon name="hourglass_empty" size={24} color={C.gold} />
            <Txt v="h16">Nobody came this time</Txt>
            <Txt v="body" color={C.textMuted} style={styles.center}>
              Search again, or play a squad another player saved on the leaderboard.
            </Txt>
          </View>
          <View style={styles.row}>
            <Btn kind="dark" icon="restart_alt" label="Search again" onPress={find} style={styles.flex} />
            <Btn kind="green" icon="groups" label="Play a saved XI" onPress={ghost} style={styles.flex} />
          </View>
        </>
      )}
    </Animated.View>
  );

  return (
    <TournamentShell title="Head-to-Head" onBack={onBack}>
      {ticket && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.found}>
          <Icon name="handshake" size={16} color={C.green} />
          <Txt v="bodySemi" style={styles.flex}>
            {ticket.opponent.ghost ? 'Saved XI of' : 'Matched with'} @{ticket.opponent.username}
          </Txt>
          <Chip label={ticket.opponent.formation} color={C.blueLight} bg={alpha(C.blue, 0.15)} />
        </Animated.View>
      )}
      <MatchPlay
        key={ticket?.ticketId ?? 'search'}
        formation={formation}
        lineup={lineup}
        overall={overall}
        chemistry={chemistry}
        opponentName={oppName}
        opponentRating={ticket ? ticket.opponent.overall : null}
        opponentChip={ticket ? `CHEM ${ticket.opponent.chemistry}` : 'SEARCHING'}
        meta="HEAD-TO-HEAD · RANDOM OPPONENT"
        metaPlayed={ticket?.opponent.ghost ? 'HEAD-TO-HEAD · SAVED XI' : 'HEAD-TO-HEAD'}
        preMatch={preMatch}
        simulate={async (): Promise<Played> => ({
          youAtHome: ticket!.youAtHome,
          opponentName: oppName,
          result: ticket!.result,
          events: ticket!.events,
        })}
        onFinished={() => {
          setLocked(true);
          onFinished();
        }}
        onNewGame={onNewGame}
        onExit={onExit}
        onResult={(r) => {
          onResult?.({
            mode: 'h2h',
            title: `Head-to-head vs ${oppName}${ticket?.opponent.ghost ? ' (saved XI)' : ''}`,
            detail: `${r.yours}–${r.theirs}`,
            outcome: r.outcome,
          });
          // The server checks the ticket and the result before paying.
          if (r.outcome === 'win' && ticket) void claim('h2h-win', ticket.ticketId, 'Head-to-head win');
        }}
      />
      {!locked && !ticket && (
        <Txt v="capBody" color={C.textDim} style={styles.center}>
          Both XIs and their chemistry go into one match simulated on the server – you both see the same result.
        </Txt>
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
  center: {
    textAlign: 'center',
  },
  searching: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  timer: {
    width: '100%',
    height: 4,
    overflow: 'hidden',
    borderRadius: R.pill,
    backgroundColor: C.surface4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  found: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: R.md,
    backgroundColor: alpha(C.green, 0.1),
  },
});
