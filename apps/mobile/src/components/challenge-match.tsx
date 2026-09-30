import { savedSquadSide, type SquadDetail } from '@champion/shared';

import { MatchPlay } from '@/components/match-play';
import { TournamentShell } from '@/components/tournament-shell';
import { setPendingChallenge } from '@/game/challenge';
import { playOnline, type ResultReport } from '@/game/online';
import type { DraftPlayer } from '@/mocks/players';

type Props = {
  squad: SquadDetail;
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

/** "Challenge this XI": a shared squad against your drafted XI, one match. */
export function ChallengeMatch({
  squad,
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
  const opponent = savedSquadSide(squad);
  return (
    <TournamentShell title="Challenge" onBack={onBack}>
      <MatchPlay
        formation={formation}
        lineup={lineup}
        overall={overall}
        chemistry={chemistry}
        opponentName={opponent.name}
        opponentRating={squad.overall}
        opponentChip={`${squad.formation} · CHEM ${squad.chemistry}`}
        meta="SHARED XI · VENUE DRAWN AT KICK-OFF"
        metaPlayed={`@${squad.username}'s XI`}
        simulate={async () => {
          // Played on the server with both saved squads; the result is stored there.
          const r = await playOnline({ mode: 'challenge', opponentSquadId: squad.id });
          if (r.mode !== 'challenge') throw new Error('Unexpected answer from the server');
          return r.played;
        }}
        onFinished={() => {
          setPendingChallenge(null);
          onFinished();
        }}
        onNewGame={onNewGame}
        onExit={onExit}
        onResult={(r) =>
          onResult?.({
            mode: 'match',
            title: `Challenge vs @${squad.username}`,
            detail: `${r.yours}–${r.theirs} ${r.played.youAtHome ? '(home)' : '(away)'}`,
            outcome: r.outcome,
          })
        }
      />
    </TournamentShell>
  );
}
