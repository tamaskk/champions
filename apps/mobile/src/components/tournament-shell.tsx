import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SaveSquadButton } from '@/components/save-squad';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, HEADER_HEIGHT, R } from '@/design/tokens';
import { Btn, SHADOW_SM, ScreenHeader } from '@/design/ui';

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
 * Shown once a tournament has been played: a squad plays one competition, one time. To play
 * again you start a new game (or go back home).
 */
export function EndBar({ onNewGame, onExit }: { onNewGame: () => void; onExit: () => void }) {
  return (
    <View style={styles.end}>
      <SaveSquadButton />
      <Txt v="body" color={C.textMuted} style={styles.endNote}>
        This squad has played its tournament. Draft a new XI to play again.
      </Txt>
      <View style={styles.endRow}>
        <Btn kind="dark" icon="sports_soccer" label="Home" onPress={onExit} style={styles.endHome} />
        <Btn kind="green" icon="restart_alt" label="New game" onPress={onNewGame} style={styles.endNew} />
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
