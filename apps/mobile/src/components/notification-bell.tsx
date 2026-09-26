import { todayKey } from '@champion/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { useDailyAttempts } from '@/game/daily';
import { clearNotices, markAllRead, timeAgo, useNotices, type NoticeTone } from '@/game/notifications';

const TONE: Record<NoticeTone, string> = {
  achievement: C.gold,
  level: C.blueLight,
  coin: C.goldLight,
  info: C.textMuted,
};

/** Header bell: unread count, and the inbox (plus today's Daily Challenge if it is still open). */
export function NotificationBell() {
  const insets = useSafeAreaInsets();
  const notices = useNotices();
  const attempts = useDailyAttempts();
  const [open, setOpen] = useState(false);
  const dailyWaiting = !attempts[todayKey()];
  const unread = notices.filter((n) => !n.read).length + (dailyWaiting ? 1 : 0);

  const close = () => {
    markAllRead();
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={unread ? `Notifications, ${unread} new` : 'Notifications'}
        style={({ pressed }) => [styles.bell, pressed && styles.pressed]}>
        <Icon name="notifications" size={20} color={C.text} />
        {unread > 0 && (
          <View style={styles.badge}>
            <Txt v="tinyBold" color="#ffffff" style={styles.badgeText}>
              {unread > 9 ? '9+' : unread}
            </Txt>
          </View>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button" accessibilityLabel="Close notifications" />
        <View style={[styles.sheet, { top: insets.top + 64 }]}>
          <View style={styles.head}>
            <Txt v="h16">Notifications</Txt>
            {notices.length > 0 && (
              <Pressable onPress={clearNotices} hitSlop={8} accessibilityRole="button">
                <Txt v="capUpper" color={C.textMuted}>
                  Clear all
                </Txt>
              </Pressable>
            )}
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {dailyWaiting && (
              <Pressable
                onPress={() => {
                  close();
                  router.navigate('/');
                }}
                accessibilityRole="button"
                style={[styles.row, styles.pinned]}>
                <View style={[styles.icon, { backgroundColor: alpha(C.green, 0.15) }]}>
                  <Icon name="calendar_month" size={18} color={C.green} />
                </View>
                <View style={styles.flex}>
                  <Txt v="bodyBold">Today&apos;s Daily Challenge is waiting</Txt>
                  <Txt v="cap" color={C.textMuted}>
                    One attempt a day – tap to go to Home
                  </Txt>
                </View>
                <Icon name="chevron_right" size={16} color={C.textDim} />
              </Pressable>
            )}
            {notices.map((n) => (
              <View key={n.id} style={[styles.row, !n.read && styles.unread]}>
                <View style={[styles.icon, { backgroundColor: alpha(TONE[n.tone], 0.15) }]}>
                  <Icon name={n.icon} size={18} color={TONE[n.tone]} />
                </View>
                <View style={styles.flex}>
                  <Txt v="bodyBold">{n.title}</Txt>
                  {n.detail ? (
                    <Txt v="cap" color={C.textMuted}>
                      {n.detail}
                    </Txt>
                  ) : null}
                </View>
                <Txt v="cap" color={C.textDim}>
                  {timeAgo(n.at)}
                </Txt>
              </View>
            ))}
            {!dailyWaiting && notices.length === 0 && (
              <Txt v="body" color={C.textMuted} style={styles.empty}>
                Nothing new. Achievements, level-ups and coins you earn show up here.
              </Txt>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  badge: {
    position: 'absolute',
    top: 6,
    right: 5,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5484D',
  },
  badgeText: { fontSize: 9, lineHeight: 11, letterSpacing: 0 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    maxHeight: '70%',
    borderRadius: R.xl,
    backgroundColor: C.surface,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  list: { paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: R.md, backgroundColor: C.surface2 },
  pinned: { borderWidth: 1, borderColor: alpha(C.green, 0.4) },
  unread: { borderLeftWidth: 3, borderLeftColor: C.green },
  icon: { width: 36, height: 36, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  empty: { padding: 12, textAlign: 'center' },
});
