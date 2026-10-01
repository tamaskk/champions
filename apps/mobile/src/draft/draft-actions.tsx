import { DRAFT_BOOSTS } from '@champion/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn } from '@/design/ui';

import { BENCH_SIZE } from './constants';
import type { Draft } from './use-draft';

/** Boosts and the main buttons of the draft: spin, autocomplete, auto-bench, complete. */
export function DraftActions({ d }: { d: Draft }) {
  const {
    activateBoost,
    activatingBoost,
    autoBench,
    autocomplete,
    autofilling,
    benchCount,
    benchOpen,
    boost,
    complete,
    daily,
    moving,
    nextSpot,
    ownedBoosts,
    pending,
    spin,
    squadReady,
    sub,
  } = d;
  return (
    <>
    {/* Boosts you own: one tap uses one for this draft (not in the Daily). */}
    {!daily && !boost && !pending && !moving && !sub && !squadReady && ownedBoosts.star + ownedBoosts.legend > 0 && (
      <Animated.View entering={FadeIn.duration(200)} style={styles.boostRow}>
        <Icon name="bolt" size={16} color={C.gold} />
        <Txt v="capBody" color={C.textMuted} style={styles.flex}>
          Use a boost for this draft – clubs with top-rated players come up more often.
        </Txt>
        {(['star', 'legend'] as const).map((b) =>
          ownedBoosts[b] > 0 ? (
            <Pressable
              key={b}
              onPress={() => void activateBoost(b)}
              disabled={activatingBoost !== null}
              accessibilityRole="button"
              accessibilityLabel={`Use ${DRAFT_BOOSTS[b].name} for this draft (${ownedBoosts[b]} left)`}
              style={({ pressed }) => [styles.boostChip, pressed && { opacity: 0.7 }]}>
              <Txt v="capUpper" color={C.onGold}>
                {activatingBoost === b ? '…' : `${DRAFT_BOOSTS[b].minRating}+ ×${ownedBoosts[b]}`}
              </Txt>
            </Pressable>
          ) : null,
        )}
      </Animated.View>
    )}
    {boost && !squadReady && (
      <View style={styles.boostActive}>
        <Icon name="bolt" size={14} color={C.gold} />
        <Txt v="capBody" color={C.gold}>
          {DRAFT_BOOSTS[boost].name} on – clubs with {DRAFT_BOOSTS[boost].minRating}+ rated players come up more often
        </Txt>
      </View>
    )}

    {!pending && !moving && !sub && (
      <Animated.View entering={FadeIn.duration(200)} style={squadReady && benchOpen ? styles.actionsColumn : styles.actions}>
        {squadReady ? (
          <>
            {benchOpen && (
              <View style={styles.actions}>
                <Btn
                  kind="gold"
                  icon="auto_awesome"
                  label={autofilling ? 'FILLING…' : 'AUTO-BENCH'}
                  sub={`${BENCH_SIZE - benchCount} subs in one tap`}
                  disabled={autofilling}
                  onPress={autoBench}
                  style={styles.flex}
                />
                <Btn
                  kind="dark"
                  icon="casino"
                  label="SPIN A SUB"
                  sub="BENCH"
                  disabled={autofilling}
                  onPress={spin}
                  style={styles.flex}
                />
              </View>
            )}
            <Btn
              kind="blue"
              icon="check_circle"
              label="COMPLETE SQUAD"
              sub={daily ? 'Check the challenge' : benchCount ? 'Summary & tournaments' : 'No bench · summary & tournaments'}
              disabled={autofilling}
              onPress={complete}
              style={benchOpen ? undefined : styles.flex}
            />
          </>
        ) : (
          <>
            {!daily && (
              <Btn
                kind="dark"
                icon="auto_awesome"
                label={autofilling ? 'FILLING…' : 'AUTOCOMPLETE'}
                accessibilityLabel="Autocomplete: fill all empty spots with random players"
                disabled={autofilling}
                onPress={autocomplete}
                style={styles.flex}
              />
            )}
            <Btn
              kind="blue"
              icon="casino"
              label="⚡ SPIN DRAFT"
              sub={nextSpot ? `SLOT REEL ${nextSpot}` : benchOpen ? 'BENCH' : undefined}
              disabled={autofilling}
              onPress={spin}
              style={styles.flex}
            />
          </>
        )}
      </Animated.View>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  boostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: alpha(C.gold, 0.35),
    backgroundColor: alpha(C.gold, 0.08),
  },
  flex: {
    flex: 1,
  },
  boostChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: R.pill,
    backgroundColor: C.gold,
  },
  boostActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionsColumn: {
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
});
