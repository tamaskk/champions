import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { C, F, alpha } from '@/design/tokens';
import { useProgress } from '@/game/progress';

const DEFAULT_ROW_HEIGHT = 40;
const DEFAULT_VISIBLE_ROWS = 3;
const DEFAULT_DURATION_MS = 5000;
// Minimum rows one spin travels, so short lists still spin fast.
const MIN_TRAVEL_ROWS = 60;

export type SlotReelHandle = {
  spin: () => void;
};

type Props<T extends string> = {
  items: readonly T[];
  width: number;
  onResult: (item: T) => void;
  duration?: number;
  /** Font size of the row on the payline (the others are smaller and dimmed). */
  fontSize?: number;
  /** Max lines per row; long labels wrap before they shrink. */
  lines?: number;
  rowHeight?: number;
  visibleRows?: number;
  /** Random source of the spin (seeded for the daily challenge). */
  random?: () => number;
  ref?: Ref<SlotReelHandle>;
};

/**
 * Casino reel on the design's dark chamber: dimmed neighbours, the payline row in glowing gold
 * (a second, clipped copy of the strip), fading at the top and bottom.
 */
// Extra wait after the spin before the safety timer delivers the result itself.
const SAFETY_MS = 400;

export function SlotReel<T extends string>({
  items,
  width,
  onResult,
  duration = DEFAULT_DURATION_MS,
  fontSize = 20,
  lines = 1,
  rowHeight = DEFAULT_ROW_HEIGHT,
  visibleRows = DEFAULT_VISIBLE_ROWS,
  random = Math.random,
  ref,
}: Props<T>) {
  const progress = useProgress();
  // "Casino reels" (store cosmetic): neon red numbers on a dark red payline.
  const casino = progress.equipped.reel === 'reel-casino';
  // Spins are fast by default (half the reel's duration); the "Dramatic spins" setting plays them in full.
  const spinMs = progress.settings.dramaticReels ? duration : Math.round(duration / 2);
  const n = items.length;
  const center = Math.floor(visibleRows / 2);
  const loops = Math.max(2, Math.ceil(MIN_TRAVEL_ROWS / n));
  const strip = useMemo(
    () => Array.from({ length: n * (loops + 3) + visibleRows }, (_, j) => items[j % n]),
    [items, n, loops, visibleRows],
  );

  // topRow = strip index shown in the top slot. The reel moves down, so topRow decreases.
  const offsetY = useSharedValue(0);
  const topRow = useRef(0);
  const spinning = useRef(false);
  // Latest onResult/items, so a result delivered late still reaches the current screen.
  const latest = useRef({ onResult, items });
  useEffect(() => {
    latest.current = { onResult, items };
  });
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (safety.current) clearTimeout(safety.current);
    },
    [],
  );

  // Delivers a spin's result exactly once: from the animation callback, or from the safety timer
  // if that callback never arrives (e.g. the animation was interrupted by a reload or re-render).
  const finish = (spinId: number, index: number) => {
    if (!spinning.current || spinId !== spinCount.current) return;
    spinning.current = false;
    if (safety.current) clearTimeout(safety.current);
    safety.current = null;
    latest.current.onResult(latest.current.items[index]);
  };
  const spinCount = useRef(0);
  // The spin in progress (its result is drawn when it starts), for tap-to-stop.
  const current = useRef<{ spinId: number; index: number; endTop: number } | null>(null);

  // Tap a spinning reel: it jumps straight to the result it was already going to show.
  const stop = () => {
    const c = current.current;
    if (!spinning.current || !c) return;
    offsetY.value = -c.endTop * rowHeight; // cancels the running animation
    finish(c.spinId, c.index);
  };

  useImperativeHandle(ref, () => ({
    spin() {
      if (spinning.current) return;
      spinning.current = true;
      const spinId = ++spinCount.current;
      const index = Math.floor(random() * n);
      const endTop = index + n - center;
      const drift = (((topRow.current - endTop) % n) + n) % n;
      const startTop = endTop + loops * n + drift;
      topRow.current = endTop;
      current.current = { spinId, index, endTop };
      offsetY.value = withSequence(
        withTiming(-startTop * rowHeight, { duration: 0 }),
        withTiming(-endTop * rowHeight, { duration: spinMs, easing: Easing.out(Easing.poly(4)) }, () => {
          scheduleOnRN(finish, spinId, index);
        }),
      );
      safety.current = setTimeout(() => {
        offsetY.value = -endTop * rowHeight; // snap to the result if the animation was cut short
        finish(spinId, index);
      }, spinMs + SAFETY_MS);
    },
  }));

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offsetY.value }] }));
  const litStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offsetY.value - center * rowHeight }] }));

  const row = (lit: boolean) =>
    strip.map((item, j) => (
      <View key={j} style={[styles.row, { height: rowHeight }]}>
        <Text
          numberOfLines={lines}
          adjustsFontSizeToFit
          style={
            lit ? [styles.lit, casino && styles.litCasino, { fontSize, lineHeight: Math.round(fontSize * 1.3) }] : styles.dim
          }>
          {item}
        </Text>
      </View>
    ));

  return (
    <Pressable
      onPress={stop}
      accessibilityRole="button"
      accessibilityHint="Tap while it spins to stop the reel"
      style={[styles.window, { width, height: rowHeight * visibleRows }]}>
      <Animated.View style={stripStyle}>{row(false)}</Animated.View>
      <View
        pointerEvents="none"
        style={[styles.payline, casino && styles.paylineCasino, { top: center * rowHeight, height: rowHeight }]}>
        <Animated.View style={litStyle}>{row(true)}</Animated.View>
      </View>
      <View pointerEvents="none" style={[styles.fade, styles.fadeTop, { height: rowHeight * 0.9 }]} />
      <View pointerEvents="none" style={[styles.fade, styles.fadeBottom, { height: rowHeight * 0.9 }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  window: {
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dim: {
    fontFamily: F.semi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.24,
    color: alpha(C.textMuted, 0.4),
    textAlign: 'center',
  },
  lit: {
    fontFamily: F.display,
    color: C.gold,
    textAlign: 'center',
    letterSpacing: -0.5,
    textShadowColor: alpha(C.gold, 0.6),
    textShadowRadius: 5,
  },
  litCasino: {
    color: '#ff3b5c',
    textShadowColor: 'rgba(255,59,92,0.8)',
  },
  paylineCasino: {
    backgroundColor: '#2a0a12',
  },
  payline: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: C.surface,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  fadeTop: {
    top: 0,
    experimental_backgroundImage: `linear-gradient(to bottom, ${alpha(C.surface, 0.9)}, ${alpha(C.surface, 0)})`,
  },
  fadeBottom: {
    bottom: 0,
    experimental_backgroundImage: `linear-gradient(to top, ${alpha(C.surface, 0.9)}, ${alpha(C.surface, 0)})`,
  },
});
