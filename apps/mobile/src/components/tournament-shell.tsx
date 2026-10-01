import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SaveSquadButton } from '@/components/save-squad';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, HEADER_HEIGHT, R } from '@/design/tokens';
import { Btn, SHADOW_SM, ScreenHeader } from '@/design/ui';
import { showInterstitialAfterGame } from '@/game/ads';

export type ShellMode = 'match' | 'league' | 'cup';

/** Full-screen page for the tournament flow: header with back, optional Match / League switcher. */
export function TournamentShell({
  title,
  onBack,
  mode,
  onMode,
  children,
}: {
  title: string;
  onBack: () => void;
  mode?: ShellMode;
  onMode?: (mode: ShellMode) => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <ScreenHeader title={title} onBack={onBack} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + HEADER_HEIGHT + 8, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {mode && onMode && (
          <View style={styles.switcher}>
            {(
              [
                { id: 'match', label: 'Match', icon: 'sports_soccer' },
                { id: 'league', label: 'League', icon: 'leaderboard' },
                { id: 'cup', label: 'Champions', icon: 'emoji_events' },
              ] as const
            ).map((m) => {
              const active = m.id === mode;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => onMode(m.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.tab, active && styles.tabActive]}>
                  <Icon name={m.icon} size={15} color={active ? C.onGreenStrong : C.textMuted} />
                  <Txt v="h14" color={active ? C.onGreenStrong : C.textMuted}>
                    {m.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        )}
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * "One more" after a tournament (arcade games only): draft again with the same formation, or take
 * this XI to another mode – that is the Second chance item, so it uses one (or opens the shop).
 */
export type EndActions = {
  formation: string;
  onDraftAgain: () => void;
  onAnotherMode: () => void;
  secondChances: number;
};
export const EndActionsContext = createContext<EndActions | null>(null);

/**
 * Shown once a tournament has been played: a squad plays one competition, one time. To play
 * again you start a new game, draft again with the same formation, use a Second chance for
 * another mode (or go back home).
 */
export function EndBar({ onNewGame, onExit }: { onNewGame: () => void; onExit: () => void }) {
  const more = useContext(EndActionsContext);
  // The end bar appears when a tournament has been played (and watched) to the end: the moment for
  // the interstitial – never earlier, so no ad during a live match or between matchdays.
  useEffect(() => {
    showInterstitialAfterGame();
  }, []);
  return (
    <View style={styles.end}>
      <SaveSquadButton />
      <Txt v="body" color={C.textMuted} style={styles.endNote}>
        {more
          ? 'This squad has played its tournament. Go again:'
          : 'This squad has played its tournament. Draft a new XI to play again.'}
      </Txt>
      {more && (
        <Btn
          kind="gold"
          icon="replay"
          label="Play in another mode"
          sub={
            more.secondChances > 0
              ? `Same XI · uses a Second chance (you have ${more.secondChances})`
              : 'Same XI · needs a Second chance – get one in the shop'
          }
          onPress={more.onAnotherMode}
        />
      )}
      <View style={styles.endRow}>
        <Btn kind="dark" icon="sports_soccer" label="Home" onPress={onExit} style={styles.endHome} />
        <Btn
          kind={more ? 'mid' : 'green'}
          icon="restart_alt"
          label="New game"
          sub={more ? 'New formation' : undefined}
          onPress={onNewGame}
          style={styles.endNew}
        />
        {more && (
          <Btn
            kind="green"
            icon="casino"
            label="Draft again"
            sub={`Same ${more.formation}`}
            onPress={more.onDraftAgain}
            style={styles.endNew}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  end: {
    gap: 8,
  },
  endNote: {
    textAlign: 'center',
  },
  endRow: {
    flexDirection: 'row',
    gap: 8,
  },
  endHome: {
    flex: 2,
  },
  endNew: {
    flex: 3,
  },
  screen: {
    ...StyleSheet.absoluteFill,
    // Above the game screen's header.
    zIndex: 20,
    backgroundColor: C.bg,
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  switcher: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: R.pill,
    backgroundColor: C.surface2,
    boxShadow: SHADOW_SM,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: R.pill,
  },
  tabActive: {
    backgroundColor: C.green,
  },
});
