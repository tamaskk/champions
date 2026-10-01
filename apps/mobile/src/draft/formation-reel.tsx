import { FORMATIONS } from '@champion/shared';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SlotReel } from '@/components/slot-reel';
import { Txt } from '@/design/text';
import { C, HEADER_HEIGHT, NAV_ROOM, R, alpha } from '@/design/tokens';

import type { Draft } from './use-draft';

/** First step of a draft: the reel that picks the formation (locked by some Daily challenges). */
export function FormationReel({ d }: { d: Draft }) {
  const { daily, dailyRandom, formation, handleResult, reel } = d;
  const insets = useSafeAreaInsets();
  const contentWidth = useWindowDimensions().width - 32;
  return (
    <View style={[styles.center, { paddingTop: insets.top + HEADER_HEIGHT, paddingBottom: NAV_ROOM }]}>
      <View style={[styles.spinCard, { width: contentWidth }]}>
        <Txt v="capUpper" color={C.green} style={{ letterSpacing: 1 }}>
          {daily?.challenge.rules.formation ? 'LOCKED FORMATION' : 'SPINNING FORMATION'}
        </Txt>
        <Txt v="h24">Your tactic</Txt>
        <View style={styles.chamber}>
          <SlotReel
            ref={reel}
            items={FORMATIONS}
            width={contentWidth - 48}
            rowHeight={56}
            visibleRows={5}
            fontSize={26}
            random={dailyRandom ?? undefined}
            stopAnywhere={!daily}
            onResult={handleResult}
          />
          <View pointerEvents="none" style={styles.payline}>
            <View style={styles.paylineBar} />
            <View style={styles.paylineBar} />
          </View>
        </View>
        <Txt v="h28" color={formation ? C.gold : C.textDim}>
          {formation ?? '…'}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinCard: {
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: R.xl,
    backgroundColor: alpha(C.surface, 0.95),
    boxShadow: '0px 20px 50px rgba(0,0,0,0.85)',
  },
  chamber: {
    padding: 8,
    borderRadius: R.lg,
    backgroundColor: C.deep,
    overflow: 'hidden',
    boxShadow: 'inset 0px 4px 16px rgba(0,0,0,0.9)',
  },
  payline: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 8 + 56 * 2,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderRadius: R.md,
    backgroundColor: alpha(C.gold, 0.1),
    boxShadow: `0px 0px 20px ${alpha(C.gold, 0.35)}`,
  },
  paylineBar: {
    width: 6,
    height: 24,
    borderRadius: R.pill,
    backgroundColor: C.gold,
    boxShadow: `0px 0px 8px ${C.gold}`,
  },
});
