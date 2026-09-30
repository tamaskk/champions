import {
  LEAGUES,
  LEAGUE_NAMES,
  lastCompleteSeason,
  leagueFirstSeason,
  seasonLabel,
  type League,
  type LeagueTableResponse,
  type OpponentResponse,
} from '@champion/shared';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { fetchOpponent, fetchTable } from '@/api/client';
import { Select } from '@/components/select';
import { MatchPlay } from '@/components/match-play';
import { TournamentShell, type ShellMode } from '@/components/tournament-shell';
import { Txt } from '@/design/text';
import { C, R } from '@/design/tokens';
import { Btn, SHADOW_SM } from '@/design/ui';
import { playOnline, type ResultReport } from '@/game/online';
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
  // The loaded table (or its error) remembers which league season it belongs to; anything else is
  // still loading – derived, so nothing needs resetting when the choice changes.
  const tableKey = `${league}-${season}`;
  const [loaded, setLoaded] = useState<{ key: string; table: LeagueTableResponse | null }>({ key: '', table: null });
  const table = loaded.key === tableKey ? loaded.table : null;
  const status: 'loading' | 'ready' | 'error' = loaded.key !== tableKey ? 'loading' : table ? 'ready' : 'error';
  const request = useRef(0);
  const wantClub = useRef<'random' | null>(null);

  // The club list is that league season's table.
  useEffect(() => {
    const id = ++request.current;
    const key = `${league}-${season}`;
    fetchTable({ league, season })
      .then((t) => {
        if (id !== request.current) return;
        setLoaded({ key, table: t });
        // Read the ref now: the state updater runs later, after it has been cleared.
        const random = wantClub.current === 'random';
        wantClub.current = null;
        setClubSlug((current) =>
          random ? randomOf(t.rows).clubSlug : t.rows.some((r) => r.clubSlug === current) ? current : null,
        );
      })
      .catch(() => id === request.current && setLoaded({ key, table: null }));
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
  const opponentKey = clubSlug ? `${league}|${season}|${clubSlug}` : null;
  const [opponentLoaded, setOpponentLoaded] = useState<{ key: string; xi: OpponentResponse } | null>(null);
  const opponentXI = opponentLoaded && opponentLoaded.key === opponentKey ? opponentLoaded.xi : null;
  // Once the match has kicked off the choice is locked.
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    if (!clubSlug) return;
    let live = true;
    const key = `${league}|${season}|${clubSlug}`;
    fetchOpponent({ league, season, club: clubSlug })
      .then((o) => live && setOpponentLoaded({ key, xi: o }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [league, season, clubSlug]);

  const opponent = table?.rows.find((r) => r.clubSlug === clubSlug) ?? null;
  const oppRating = opponentXI?.xi.length
    ? opponentXI.xi.reduce((s, p) => s + (p.rating ?? 50), 0) / opponentXI.xi.length
    : null;

  // Played on the server with the saved squad; the result is stored there.
  const simulate = async () => {
    const r = await playOnline({ mode: 'match', league, season, clubSlug: clubSlug! });
    if (r.mode !== 'match') throw new Error('Unexpected answer from the server');
    return r.played;
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
