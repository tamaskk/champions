import { TOURNAMENT_MODES, type Formation, type TournamentMode } from '@champion/shared';
import { StyleSheet, View } from 'react-native';

import { ChallengeMatch } from '@/components/challenge-match';
import { CupTournament } from '@/components/cup-tournament';
import { H2HMatch } from '@/components/h2h-match';
import { LeagueTournament } from '@/components/league-tournament';
import { LegendsTournament } from '@/components/legends-tournament';
import { MatchSetup } from '@/components/match-setup';
import { TournamentPicker } from '@/components/tournament-picker';
import { TournamentShell } from '@/components/tournament-shell';
import { Txt } from '@/design/text';
import { C, R } from '@/design/tokens';
import { reportResult } from '@/game/online';

import type { Draft } from './use-draft';

const TOURNAMENT_LABELS = Object.fromEntries(TOURNAMENT_MODES.map((m) => [m.id, m.label])) as Record<
  TournamentMode,
  string
>;

/** The finished squad's tournament (arcade): the mode picker, then the chosen mode's screen. */
export function TournamentStage({ d, formation }: { d: Draft; formation: Formation }) {
  const {
    benchPlayers,
    challenge,
    challenged,
    chemistry,
    closeGame,
    endTournament,
    finished,
    lineupPlayers,
    overall,
    setChallenged,
    setShowTournaments,
    setTournament,
    squadId,
    startGame,
    tournament,
    tournamentOver,
  } = d;

  // The same for every mode: the squad, and how its screen ends.
  const common = {
    formation,
    lineup: lineupPlayers,
    overall,
    chemistry: chemistry?.team ?? 0,
    onBack: () => (finished ? endTournament() : setTournament(null)),
    onFinished: tournamentOver,
    onNewGame: () => {
      closeGame();
      startGame();
    },
    onExit: closeGame,
    onResult: reportResult,
  };
  // Switching between match / league / cup from inside a mode, until one is played.
  const onMode = finished
    ? undefined
    : (m: 'match' | 'league' | 'cup') =>
        setTournament(m === 'match' ? 'match' : m === 'cup' ? 'champions-league' : 'league');

  if (tournament === 'random-league' || tournament === 'league')
    return (
      <LeagueTournament
        key={tournament}
        {...common}
        mode={tournament === 'random-league' ? 'random' : 'pick'}
        bench={benchPlayers}
        squadId={squadId}
        onMode={onMode}
        onRandom={(random) => setTournament(random ? 'random-league' : 'league')}
      />
    );
  if (tournament === 'champions-league' || tournament === 'random-champions-league')
    return (
      <CupTournament
        key={tournament}
        {...common}
        mode={tournament === 'random-champions-league' ? 'random' : 'pick'}
        onMode={onMode}
        onRandom={(random) => setTournament(random ? 'random-champions-league' : 'champions-league')}
      />
    );
  if (tournament === 'match') return <MatchSetup {...common} onMode={onMode} />;
  if (tournament === 'legends') return <LegendsTournament {...common} />;
  if (tournament === 'challenge' && challenged) return <ChallengeMatch {...common} squad={challenged} />;
  if (tournament === 'h2h') return <H2HMatch {...common} />;
  if (tournament)
    return (
      <TournamentShell title={TOURNAMENT_LABELS[tournament]} onBack={() => setTournament(null)}>
        <View style={styles.soon}>
          <Txt v="h24">{TOURNAMENT_LABELS[tournament]}</Txt>
          <Txt v="body" color={C.textMuted}>
            Coming soon
          </Txt>
        </View>
      </TournamentShell>
    );
  return (
    <TournamentPicker
      overall={overall}
      chemistry={chemistry?.team ?? 0}
      onPick={(mode) => {
        if (mode === 'challenge') setChallenged(challenge);
        setTournament(mode);
      }}
      onBack={() => setShowTournaments(false)}
      challenge={challenge}
    />
  );
}

const styles = StyleSheet.create({
  soon: {
    alignItems: 'center',
    gap: 4,
    padding: 24,
    borderRadius: R.md,
    backgroundColor: C.surface,
  },
});
