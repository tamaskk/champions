import { TabList, TabSlot, TabTrigger, Tabs, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { useFocusEffect } from 'expo-router';
import { forwardRef, useCallback, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';

// Full-screen flows (draft, summary, tournaments, a squad page) hide the tab bar. Every screen or
// overlay that wants it hidden holds a request while it is focused; the bar shows again only when
// no request is left (one overlay closing must not bring the bar back over another screen's flow).
const requests = new Set<object>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
/** True while a full-screen flow (draft, summary, tournaments) hides the tab bar. */
export function useTabBarHidden() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => requests.size > 0,
  );
}

/** Hides the floating tab bar while `hide` is true and this screen is the focused tab. */
export function useHideTabBar(hide: boolean) {
  useFocusEffect(
    useCallback(() => {
      if (!hide) return;
      const request = {};
      requests.add(request);
      emit();
      return () => {
        requests.delete(request);
        emit();
      };
    }, [hide]),
  );
}

/** The design's floating pill tab bar: HOME, RANKS, EXPLORE and PROFILE, the active tab lit green. */
export default function PillTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <NavBar>
          <TabTrigger name="home" href="/" asChild>
            <NavButton icon="sports_soccer" label="HOME" />
          </TabTrigger>
          <TabTrigger name="ranks" href="/ranks" asChild>
            <NavButton icon="leaderboard" label="RANKS" />
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <NavButton icon="explore" label="EXPLORE" />
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <NavButton icon="person" label="PROFILE" />
          </TabTrigger>
        </NavBar>
      </TabList>
    </Tabs>
  );
}

function NavBar({ children, style, ...props }: TabListProps) {
  const insets = useSafeAreaInsets();
  const isHidden = useTabBarHidden();
  return (
    <View
      {...props}
      pointerEvents="box-none"
      style={[styles.navWrap, { paddingBottom: Math.max(insets.bottom, 16) }, isHidden && styles.hidden]}>
      <View style={styles.nav}>{children}</View>
    </View>
  );
}

const NavButton = forwardRef<View, TabTriggerSlotProps & { icon: IconName; label: string }>(function NavButton(
  { icon, label, isFocused, ...props },
  ref,
) {
  return (
    <Pressable ref={ref} {...props} style={[styles.link, isFocused && styles.linkActive]}>
      <Icon name={icon} size={18} color={isFocused ? C.green : C.textMuted} />
      <Txt v="capUpper" color={isFocused ? C.green : C.textMuted}>
        {label}
      </Txt>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  slot: {
    flex: 1,
  },
  navWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 35,
  },
  hidden: {
    display: 'none',
  },
  nav: {
    width: '100%',
    maxWidth: 360,
    flexDirection: 'row',
    padding: 6,
    borderRadius: R.pill,
    backgroundColor: alpha(C.surface, 0.95),
    boxShadow: '0px 8px 32px rgba(0,0,0,0.45)',
  },
  link: {
    flex: 1,
    height: 48,
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.pill,
  },
  linkActive: {
    backgroundColor: alpha(C.surface3, 0.9),
    boxShadow: `0px 0px 20px ${alpha(C.green, 0.25)}`,
  },
});
