import { FREE_RESPINS_PER_DRAFT } from '@champion/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DailyResult } from '@/components/daily-result';
import { DraftSettings } from '@/components/draft-settings';
import { DraftSpin } from '@/components/draft-spin';
import { FormationInfo } from '@/components/formation-info';
import { HomeLanding } from '@/components/home-landing';
import { useHideTabBar } from '@/components/pill-tabs';
import { PlayerCard } from '@/components/player-card';
import { SeasonPlayer } from '@/components/season-player';
import { Shop } from '@/components/shop';
import { SquadSummary } from '@/components/squad-summary';
import { EndActionsContext, TournamentShell } from '@/components/tournament-shell';
import { C } from '@/design/tokens';
import { ScreenHeader } from '@/design/ui';
import { DraftBoard } from '@/draft/draft-board';
import { FormationReel } from '@/draft/formation-reel';
import { SecondChanceOffer } from '@/draft/second-chance-offer';
import { TournamentStage } from '@/draft/tournament-stage';
import { useDraft } from '@/draft/use-draft';
import { leagueSeasonTitle, useLeagueSeason } from '@/game/league-season';
import { reportResult } from '@/game/online';
import { consumeItem } from '@/game/wallet';

/**
 * Home: the landing, and on top of it one draft (`useDraft`) from the formation reel through team
 * building and the summary to the tournament. The pieces live in `src/draft/`.
 */
export default function HomeScreen() {
  const d = useDraft();
  const { started, startGame, closeGame, daily, formation, lineup, lineupPlayers, chemistry, card, cardPick } = d;

  // The saved league season, opened from Home ("Continue season").
  const [resumeSeason, setResumeSeason] = useState(false);
  const savedSeason = useLeagueSeason();
  const showSeason = resumeSeason && !started && !!savedSeason;

  useHideTabBar(d.drawing || d.showSummary || d.showTournaments || showSeason);

  if (!started) {
    return (
      <>
        <HomeLanding
          onStart={() => startGame()}
          onDaily={(challenge) => startGame(challenge)}
          onPractice={async (challenge) => {
            if (await consumeItem('daily-practice')) startGame(challenge, true);
          }}
          onContinueSeason={() => setResumeSeason(true)}
        />
        {showSeason && (
          <TournamentShell title={leagueSeasonTitle(savedSeason)} onBack={() => setResumeSeason(false)}>
            <SeasonPlayer save={savedSeason} onExit={() => setResumeSeason(false)} />
          </TournamentShell>
        )}
      </>
    );
  }

  return (
    <EndActionsContext.Provider value={d.endActions}>
      <View style={styles.screen}>
        <ScreenHeader title={daily ? 'Daily Challenge' : 'Home'} />

        {!d.showPitch && <FormationReel d={d} />}
        {d.showPitch && formation && <DraftBoard d={d} formation={formation} />}

        {d.drawing && (
          <DraftSpin
            key={d.drawId}
            openSpots={d.openSpots}
            benchOpen={d.benchOpen}
            taken={[...lineup, ...d.bench].flatMap((p) => (p ? [p.player.name] : []))}
            onPick={d.handlePick}
            chemistryGain={d.chemistryGain}
            teamChemistry={chemistry?.team ?? 0}
            rules={d.dailyRules ?? d.casualRules}
            squad={formation ? { formation, lineup: lineupPlayers } : undefined}
          />
        )}

        {card && cardPick && formation && (
          <PlayerCard
            key={`${card.kind}${card.index}`}
            player={card.kind === 'xi' ? lineupPlayers[card.index]! : cardPick.player}
            drafted={{ club: cardPick.club, decade: cardPick.decade, league: cardPick.league }}
            role={card.kind === 'xi' ? `${d.spots[card.index]?.code ?? ''}` : `SUB · ${cardPick.player.position}`}
            captain={card.kind === 'xi' && card.index === d.captainSpot}
            links={d.cardLinks}
            onOpen={d.setCard}
            onClose={() => d.setCard(null)}
          />
        )}

        {d.showSummary && formation && !d.showTournaments && (
          <SquadSummary
            formation={formation}
            lineup={lineup}
            onClose={() => d.setShowSummary(false)}
            onNewGame={() => {
              closeGame();
              startGame();
            }}
            onStartTournament={() => d.setShowTournaments(true)}
            startLabel={daily ? 'Check challenge' : 'Start tournament'}
            daily={!!daily}
          />
        )}

        {d.showTournaments && formation && daily && (
          <DailyResult
            daily={daily}
            formation={formation}
            lineup={lineupPlayers}
            overall={d.overall}
            chemistry={chemistry?.team ?? 0}
            onHome={closeGame}
            onResult={d.practice ? undefined : reportResult}
            practice={d.practice}
          />
        )}

        {d.showFormation && formation && (
          <FormationInfo
            formation={formation}
            spots={d.spots}
            players={lineup.map((p) => (p ? { name: p.player.name, rating: p.player.rating } : null))}
            fits={chemistry?.fits ?? []}
            chemistry={chemistry?.team ?? 0}
            onClose={() => d.setShowFormation(false)}
          />
        )}

        {d.showSettings && (
          <DraftSettings
            boosts={daily ? undefined : { active: d.boost, owned: d.ownedBoosts, onActivate: d.activateBoost }}
            respins={
              daily
                ? null
                : { freeLeft: Math.max(0, FREE_RESPINS_PER_DRAFT - d.freeRespinsUsed), bought: d.respinTokens }
            }
            onRestart={
              daily
                ? undefined
                : () => {
                    d.setShowSettings(false);
                    closeGame();
                    startGame();
                  }
            }
            onClose={() => d.setShowSettings(false)}
          />
        )}

        {d.offerSecondChance && <SecondChanceOffer d={d} />}

        {d.showTournaments && formation && !daily && <TournamentStage d={d} formation={formation} />}
        {d.shopForSecondChance && <Shop onClose={() => d.setShopForSecondChance(false)} />}
      </View>
    </EndActionsContext.Provider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
});
