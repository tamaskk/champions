import { Pressable, StyleSheet, View } from 'react-native';

import type { DraftPick } from '@/components/draft-spin';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { ratingTint } from '@/design/ui';

type Props = {
  bench: (DraftPick | null)[];
  /** Minimum substitutes to complete the squad. */
  min: number;
  /** A drafted player is waiting: empty slots take him. */
  placing: boolean;
  /** Substitute picked up to come on (tap a starter to swap). */
  selected?: number | null;
  /** A starter is picked up: the substitutes he can swap with. */
  swapTargets?: boolean[];
  onPress: (index: number) => void;
};

/** The substitutes' bench under the pitch: filled slots open the player card, empty ones take the waiting pick. */
export function BenchRow({ bench, min, placing, selected = null, swapTargets, onPress }: Props) {
  const filled = bench.filter(Boolean).length;
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Txt v="capUpper" color={C.textMuted}>
          BENCH
        </Txt>
        <Txt v="cap" color={filled < min ? C.gold : filled ? C.green : C.textMuted}>
          {filled}/{bench.length} · {min > 0 ? `min ${min}` : 'optional'}
        </Txt>
      </View>
      <View style={styles.row}>
        {bench.map((p, i) => {
          const target = placing && !p;
          const swap = !!swapTargets?.[i];
          return (
            <Pressable
              key={i}
              onPress={() => onPress(i)}
              disabled={placing ? !!p : swapTargets ? !swap : !p}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === i }}
              accessibilityLabel={
                p
                  ? swap
                    ? `Swap with substitute ${p.player.name}`
                    : `Substitute ${p.player.name}: bring him on`
                  : target
                    ? 'Put him on the bench'
                    : 'Empty bench slot'
              }
              style={[
                styles.slot,
                p ? styles.filled : styles.empty,
                (target || swap) && styles.target,
                selected === i && styles.picked,
                swapTargets && !swap && !!p && styles.dimmed,
              ]}>
              {p ? (
                <>
                  <Txt v="tinyBold" color={C.textMuted}>
                    {p.player.position}
                  </Txt>
                  <Txt v="bodyBold" numberOfLines={1}>
                    {p.player.name.split(' ').slice(-1)[0]}
                  </Txt>
                  {p.player.rating !== undefined && (
                    <Txt v="num9" color={ratingTint(p.player.rating)}>
                      {Math.round(p.player.rating)}
                    </Txt>
                  )}
                </>
              ) : (
                <Txt v="tinyBold" color={target ? C.blueLight : C.textDim}>
                  {target ? 'SUB +' : 'SUB'}
                </Txt>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  picked: { borderWidth: 2, borderColor: C.gold, backgroundColor: alpha(C.gold, 0.15) },
  dimmed: { opacity: 0.4 },
  wrap: { gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 6 },
  slot: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 2,
    borderRadius: R.md,
  },
  filled: { backgroundColor: C.surface3 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: C.surface4 },
  target: { borderStyle: 'solid', borderColor: C.blue, backgroundColor: alpha(C.blue, 0.15) },
});
