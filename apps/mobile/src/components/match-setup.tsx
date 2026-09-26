import {
  LEAGUES,
  LEAGUE_NAMES,
  lastCompleteSeason,
  leagueFirstSeason,
  seasonLabel,
  type League,
  type LeagueTableResponse,
  type MatchSide,
  type OpponentResponse,
} from '@champion/shared';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { fetchOpponent, fetchTable } from '@/api/client';
import { Select } from '@/components/select';
import { MatchPlay, playLocally } from '@/components/match-play';
import { TournamentShell, type ShellMode } from '@/components/tournament-shell';
import { Txt } from '@/design/text';
import { C, R } from '@/design/tokens';
import { Btn, SHADOW_SM } from '@/design/ui';
import type { ResultReport } from '@/game/online';
import type { DraftPlayer } from '@/mocks/players';

type Props = {
  formation: string;
  /** Your XI, in formation spot order. */
  lineup: readonly (DraftPlayer | null)[];
  overall: number;
  chemistry: number;
  onBack: () => void;
  onMode?: (mode: ShellMode) => void;
  /** Called when the result is in: the squad can't play again. */
  onFinished: () => void;
  onNewGame: () => void;
  onExit: () => void;
  /** The result, for the leaderboard and your records. */
  onResult?: (result: ResultReport) => void;
};

const seasonsOf = (league: League) => {
  const last = lastCompleteSeason();
  return Array.from({ length: last - leagueFirstSeason(league) + 1 }, (_, i) => last - i);
};
const randomOf = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
const shortSeason = (season: number) => `'${seasonLabel(season).slice(2)}`;

/** Match mode: your XI against one real club season, chosen by league, season and club. */
export function MatchSetup({
  formation,
  lineup,
  overall,
  chemistry,
  onBack,
  onMode,
  onFinished,
  onNewGame,
  onExit,
  onResult,
}: Props) {
  const [league, setLeague] = useState<League>('ENG');
  const [season, setSeason] = useState(lastCompleteSeason());
  const [clubSlug, setClubSlug] = useState<string | null>(null);
  const [open, setOpen] = useState<'league' | 'season' | 'club' | null>(null);
  const [table, setTable] = useState<LeagueTableResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const request = useRef(0);
  const wantClub = useRef<'random' | null>(null);

  // The club list is that league season's table.
  useEffect(() => {
    const id = ++request.current;
    setStatus('loading');
    fetchTable({ league, season })
      .then((t) => {
        if (id !== request.current) return;
        setTable(t);
        setStatus('ready');
        // Read the ref now: the state updater runs later, after it has been cleared.
        const random = wantClub.current === 'random';
        wantClub.current = null;
        setClubSlug((current) =>
          random ? randomOf(t.rows).clubSlug : t.rows.some((r) => r.clubSlug === current) ? current : null,
        );
      })
      .catch(() => id === request.current && setStatus('error'));
  }, [league, season]);

  const pickRandom = () => {
    const l = randomOf(LEAGUES);
    const s = randomOf(seasonsOf(l));
    setOpen(null);
    if (l === league && s === season && table) return setClubSlug(randomOf(table.rows).clubSlug);
    wantClub.current = 'random';
    setLeague(l);
    setSeason(s);
  };

  // The opponent's likely XI (for its rating) as soon as a club is chosen.
  const [opponentXI, setOpponentXI] = useState<OpponentResponse | null>(null);
  // Once the match has kicked off the choice is locked.
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    setOpponentXI(null);
    if (!clubSlug) return;
    let live = true;
    fetchOpponent({ league, season, club: clubSlug })
      .then((o) => live && setOpponentXI(o))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [league, season, clubSlug]);

  const opponent = table?.rows.find((r) => r.clubSlug === clubSlug) ?? null;
  const oppRating = opponentXI?.xi.length
    ? opponentXI.xi.reduce((s, p) => s + (p.rating ?? 50), 0) / opponentXI.xi.length
    : null;

  const simulate = async (you: MatchSide) => {
    const opp =
      opponentXI && opponentXI.clubSlug === clubSlug && opponentXI.season === season
        ? opponentXI
        : await fetchOpponent({ league, season, club: clubSlug! });
    return playLocally(you, { name: opp.club, xi: opp.xi });
  };

  return (
    <TournamentShell title="Single Match" onBack={onBack} mode="match" onMode={onMode}>
      {/* Opponent choice */}
      {!locked && (
        <View style={styles.card}>
          <Select
            label="League"
            value={`${league} · ${LEAGUE_NAMES[league]}`}
            open={open === 'league'}
            onToggle={() => setOpen(open === 'league' ? null : 'league')}
            options={LEAGUES.map((l) => ({ key: l, label: `${l} · ${LEAGUE_NAMES[l]}`, active: l === league }))}
            onSelect={(key) => {
              const l = key as League;
              setLeague(l);
              setSeason((s) => Math.max(s, leagueFirstSeason(l)));
              setOpen(null);
            }}
          />
          <Select
            label="Season"
            value={seasonLabel(season)}
            open={open === 'season'}
            onToggle={() => setOpen(open === 'season' ? null : 'season')}
            options={seasonsOf(league).map((s) => ({ key: String(s), label: seasonLabel(s), active: s === season }))}
            onSelect={(key) => {
              setSeason(Number(key));
              setOpen(null);
            }}
          />
          <Select
            label="Club"
            value={opponent?.club ?? (status === 'loading' ? 'Loading…' : status === 'error' ? 'Offline' : 'Choose')}
            open={open === 'club'}
            onToggle={() => status === 'ready' && setOpen(open === 'club' ? null : 'club')}
            options={(table?.rows ?? []).map((r) => ({
              key: r.clubSlug,
              label: `${r.club} (${r.position}.)`,
              active: r.clubSlug === clubSlug,
            }))}
            onSelect={(key) => {
              setClubSlug(key);
              setOpen(null);
            }}
          />
          <Btn kind="mid" icon="casino" label="Random opponent" height={44} radius={R.sm} onPress={pickRandom} />
          {status === 'error' && (
            <Txt v="bodySemi" color={C.red} style={styles.center}>
              Couldn&apos;t load the clubs. Check that the web server is running.
            </Txt>
          )}
        </View>
      )}

      {opponent && table && !open && (
        <MatchPlay
          key={`${table.league}-${table.season}-${opponent.clubSlug}`}
          formation={formation}
          lineup={lineup}
          overall={overall}
          chemistry={chemistry}
          opponentName={`${opponent.club} ${shortSeason(table.season)}`}
          opponentRating={oppRating}
          opponentChip={opponent.elo ? `ELO ${opponent.elo}` : `${opponent.position}. PLACE`}
          meta={`${table.league} ${seasonLabel(table.season)} · VENUE DRAWN AT KICK-OFF`}
          metaPlayed={`${table.league} ${seasonLabel(table.season)}`}
          simulate={simulate}
          onFinished={() => {
            setLocked(true);
            onFinished();
          }}
          onNewGame={onNewGame}
          onExit={onExit}
          onResult={(r) =>
            onResult?.({
              mode: 'match',
              title: `vs ${opponent.club} ${seasonLabel(table.season)}`,
              detail: `${r.yours}–${r.theirs} ${r.played.youAtHome ? '(home)' : '(away)'}`,
              outcome: r.outcome,
            })
          }
        />
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
});
