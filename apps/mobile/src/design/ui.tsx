import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationBell } from '@/components/notification-bell';
import { useTabBarHidden } from '@/components/pill-tabs';
import { useUser } from '@/game/user';

import { Icon, type IconName } from './icon';
import { Txt, type TypeName } from './text';
import { C, HEADER_HEIGHT, IMAGES, R, alpha } from './tokens';

export const SHADOW_SM = '0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1)';
export const SHADOW_LG = '0px 20px 25px -5px rgba(0,0,0,0.1), 0px 8px 10px -6px rgba(0,0,0,0.1)';

/** Soft coloured light spot (the design's blurred circles), drawn as a radial gradient. */
export function Glow({
  color,
  opacity,
  size,
  style,
}: {
  color: string;
  opacity: number;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          experimental_backgroundImage: `radial-gradient(circle, ${alpha(color, opacity)} 0%, ${alpha(color, opacity * 0.6)} 35%, ${alpha(color, 0)} 70%)`,
        },
        style,
      ]}
    />
  );
}

/** Username initials: "RoyalCaptain86" → "RC", "zizou_master" → "ZM", "Pele" → "PE". */
const initialsOf = (username: string) => {
  const parts = username.replace(/[0-9_]+/g, ' ').match(/[A-Z][a-z]*|[a-z]+/g) ?? [];
  const letters = parts.length >= 2 ? parts[0]![0]! + parts[1]![0]! : username.slice(0, 2);
  return letters.toUpperCase();
};

/**
 * The profile bubble on the right of every header: your initials, opens the Profile tab. On the
 * Profile tab it is the highlighted current page. Hidden in full-screen flows (draft, summary,
 * tournaments), where the tab bar is hidden too and leaving would strand the flow.
 */
export function Avatar() {
  const user = useUser();
  const pathname = usePathname();
  const tabBarHidden = useTabBarHidden();
  if (tabBarHidden) return null;

  const here = pathname === '/profile';
  const label = user?.username ? `Profile of @${user.username}` : 'Profile';
  const content = user?.username ? (
    <Txt v="tinyBold" color={C.onGreen} style={styles.avatarText}>
      {initialsOf(user.username)}
    </Txt>
  ) : (
    <Icon name="person" size={16} color={C.onGreen} />
  );

  if (here) {
    return (
      <View style={[styles.avatar, styles.avatarHere]} accessibilityLabel={label} accessibilityState={{ selected: true }}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => router.navigate('/profile')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${label} – open`}
      style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

/**
 * Top bar. `home` = app icon + "CHAMPION DRAFT" + title, bell and profile; `back` = back arrow,
 * app icon and title, profile. Sits over the content (translucent), below the status bar.
 */
export function ScreenHeader({
  title,
  onBack,
  showBell = true,
}: {
  title: string;
  onBack?: () => void;
  showBell?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top, height: insets.top + HEADER_HEIGHT }]}>
      <View style={styles.headerLeft}>
        {onBack && (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}>
            <Icon name="arrow_back_ios_new" size={20} color={C.text} />
          </Pressable>
        )}
        <Image source={IMAGES.appIcon} style={styles.appIcon} />
        <View style={styles.headerText}>
          {!onBack && showBell && (
            <Txt v="capUpper" color={C.green}>
              CHAMPION DRAFT
            </Txt>
          )}
          <Txt v="h20" style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Txt>
        </View>
      </View>
      <View style={styles.headerRight}>
        {showBell && !onBack && <NotificationBell />}
        <Avatar />
      </View>
    </View>
  );
}

type BtnKind = 'blue' | 'green' | 'dark' | 'gold' | 'mid';
const BTN: Record<BtnKind, { bg: string; fg: string; shadow?: string }> = {
  blue: { bg: C.blue, fg: C.onBlue, shadow: `0px 8px 12px ${alpha(C.blue, 0.35)}` },
  green: { bg: C.greenStrong, fg: C.onGreenStrong, shadow: `0px 6px 12px ${alpha(C.greenStrong, 0.4)}` },
  gold: { bg: C.gold, fg: C.onGoldDark, shadow: `0px 0px 6px ${alpha(C.gold, 0.3)}` },
  dark: { bg: C.surface3, fg: C.text, shadow: SHADOW_SM },
  mid: { bg: C.surface4, fg: C.text },
};

/** Pill button (56 high by default), optional icon and a small second line. */
export function Btn({
  kind = 'blue',
  label,
  sub,
  icon,
  iconRight,
  onPress,
  disabled,
  height = 56,
  radius = R.pill,
  labelType = 'h14',
  style,
  accessibilityLabel,
  children,
}: {
  kind?: BtnKind;
  label: string;
  sub?: string;
  icon?: IconName;
  iconRight?: IconName;
  onPress?: () => void;
  disabled?: boolean;
  height?: number;
  radius?: number;
  labelType?: TypeName;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  children?: ReactNode;
}) {
  const k = BTN[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.btn,
        { height, borderRadius: radius, backgroundColor: k.bg, boxShadow: k.shadow },
        (pressed || disabled) && styles.pressed,
        style,
      ]}>
      {icon && <Icon name={icon} size={18} color={k.fg} />}
      <View style={styles.btnText}>
        <Txt v={labelType} color={k.fg} numberOfLines={1}>
          {label}
        </Txt>
        {sub && (
          <Txt v="tiny" color={alpha(k.fg === C.text ? '#dce3f1' : k.fg, 0.8)} style={styles.btnSub}>
            {sub}
          </Txt>
        )}
      </View>
      {children}
      {iconRight && <Icon name={iconRight} size={16} color={k.fg} />}
    </Pressable>
  );
}

/** Small rounded label: `bg` fill, `color` text, optional leading icon or dot. */
export function Chip({
  label,
  color,
  bg,
  icon,
  dot,
  type = 'cap',
  radius = R.xs,
  style,
}: {
  label: string;
  color: string;
  bg: string;
  icon?: IconName;
  dot?: string;
  type?: TypeName;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: bg, borderRadius: radius }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
      {icon && <Icon name={icon} size={12} color={color} />}
      <Txt v={type} color={color} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

/** Section heading: icon + uppercase Space Grotesk title, optional right-side note. */
export function SectionTitle({
  icon,
  iconColor,
  title,
  right,
  rightColor,
}: {
  icon?: IconName;
  iconColor?: string;
  title: string;
  right?: string;
  rightColor?: string;
}) {
  return (
    <View style={styles.sectionTitle}>
      <View style={styles.row4}>
        {icon && <Icon name={icon} size={16} color={iconColor ?? C.gold} />}
        <Txt v="h14" style={styles.upper}>
          {title}
        </Txt>
      </View>
      {right && (
        <Txt v="cap" color={rightColor ?? C.textMuted}>
          {right}
        </Txt>
      )}
    </View>
  );
}

/** Rating number colour on the design's scale: blue elite, gold world class, green good, muted rest. */
export function ratingTint(rating: number): string {
  if (rating >= 95) return C.blueLight;
  if (rating >= 90) return C.gold;
  if (rating >= 70) return C.green;
  return C.textMuted;
}

export const styles = StyleSheet.create({
  avatarText: {
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.3,
  },
  avatarHere: {
    borderWidth: 2,
    borderColor: C.greenLight,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: R.pill,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0px 0px 6px ${alpha(C.green, 0.35)}`,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    // Opaque: scrolled content must not show through under the status bar and the title.
    backgroundColor: C.bg,
    boxShadow: '0px 1px 8px rgba(0,0,0,0.25)',
  },
  headerLeft: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  headerRight: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    flexShrink: 1,
  },
  headerTitle: {
    lineHeight: 25,
  },
  back: {
    width: 36,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  appIcon: {
    width: 32,
    height: 32,
    borderRadius: 7,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
  },
  btnText: {
    alignItems: 'flex-start',
  },
  btnSub: {
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: R.pill,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  row4: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  upper: {
    textTransform: 'uppercase',
  },
});
