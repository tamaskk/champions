import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const SPARKS = ['🎆', '🎇', '✨', '⚽', '🎉', '🎆', '✨', '🎇', '🎉', '✨'];
const DURATION = 900;

function Spark({ glyph, angle }: { glyph: string; angle: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) });
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.7 ? 1 : 1 - (t.value - 0.7) / 0.3,
    transform: [
      { translateX: Math.cos(angle) * 70 * t.value },
      { translateY: Math.sin(angle) * 50 * t.value },
      { scale: 0.4 + t.value * 0.9 },
    ],
  }));
  return (
    <Animated.View style={[styles.spark, style]}>
      <Text style={styles.glyph}>{glyph}</Text>
    </Animated.View>
  );
}

/** Goal celebration (store cosmetic): a burst of fireworks. Remount it (new `key`) per goal. */
export function Fireworks() {
  const fade = useSharedValue(1);
  useEffect(() => {
    fade.value = withDelay(DURATION, withTiming(0, { duration: 250 }));
  }, [fade]);
  const style = useAnimatedStyle(() => ({ opacity: fade.value }));
  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, style]}>
      <View style={styles.center}>
        {SPARKS.map((g, i) => (
          <Spark key={i} glyph={g} angle={(i / SPARKS.length) * Math.PI * 2} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  center: { width: 1, height: 1, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute' },
  glyph: { fontSize: 22 },
});
