import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { SHADOW_LG } from '@/design/ui';
import { dismissToast, useToasts } from '@/game/progress';

const SHOW_MS = 2600;
const TONE = {
  xp: { color: C.green, bg: alpha(C.green, 0.15) },
  achievement: { color: C.gold, bg: alpha(C.gold, 0.15) },
  level: { color: C.blueLight, bg: alpha(C.blue, 0.2) },
  coin: { color: C.goldLight, bg: alpha(C.goldDeep, 0.25) },
} as const;

/** "+150 XP", "Achievement unlocked", "Level 4" notices at the top of the screen, one at a time. */
export function ProgressToast() {
  const insets = useSafeAreaInsets();
  const toasts = useToasts();
  const toast = toasts[0];

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => dismissToast(toast.id), SHOW_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  const tone = TONE[toast.tone];
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <Animated.View
        key={toast.id}
        entering={FadeInUp.duration(250)}
        exiting={FadeOutUp.duration(200)}
        accessibilityLiveRegion="polite"
        style={[styles.toast, { borderColor: alpha(tone.color, 0.4) }]}>
        <View style={[styles.icon, { backgroundColor: tone.bg }]}>
          <Icon name={toast.icon} size={18} color={tone.color} />
        </View>
        <View style={styles.text}>
          <Txt v="h14" color={tone.color}>
            {toast.title}
          </Txt>
          <Txt v="body" color={C.textMuted} numberOfLines={2}>
            {toast.detail}
          </Txt>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 100 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: 420,
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: R.lg,
    borderWidth: 1,
    backgroundColor: C.surface2,
    boxShadow: SHADOW_LG,
  },
  icon: { width: 36, height: 36, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
});
