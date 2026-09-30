import { useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn } from '@/design/ui';
import { dismissReminderOffer, setPushSetting, useOfferReminder, usePushSettings } from '@/game/push';

const DENIED = 'Notifications are off for Spinvincible in your phone settings.';

/** Profile: the two notification switches (both at most one a day). */
export function NotificationSettings() {
  const settings = usePushSettings();
  const [note, setNote] = useState<string | null>(null);
  if (Platform.OS === 'web') return null;

  const toggle = async (key: 'dailyReminder' | 'beaten', on: boolean) => {
    setNote(null);
    if (!(await setPushSetting(key, on))) setNote(DENIED);
  };

  return (
    <View style={styles.gap8}>
      <View style={styles.item}>
        <View style={styles.flex}>
          <Txt v="bodyBold">Daily reminder</Txt>
          <Txt v="cap" color={C.textMuted}>
            19:00, only on days you haven&apos;t played the Daily yet
          </Txt>
        </View>
        <Switch
          value={settings.dailyReminder}
          onValueChange={(v) => void toggle('dailyReminder', v)}
          trackColor={{ true: C.greenStrong, false: C.surface4 }}
          accessibilityLabel="Daily reminder"
        />
      </View>
      <View style={styles.item}>
        <View style={styles.flex}>
          <Txt v="bodyBold">When your XI is beaten</Txt>
          <Txt v="cap" color={C.textMuted}>
            Someone beat your saved squad in a challenge – at most once a day
          </Txt>
        </View>
        <Switch
          value={settings.beaten}
          onValueChange={(v) => void toggle('beaten', v)}
          trackColor={{ true: C.greenStrong, false: C.surface4 }}
          accessibilityLabel="Notify me when my XI is beaten"
        />
      </View>
      {note && (
        <Txt v="cap" color={C.gold}>
          {note}
        </Txt>
      )}
    </View>
  );
}

/** After a Daily: a one-time offer to turn on the reminder. */
export function ReminderOffer() {
  const offer = useOfferReminder();
  const [note, setNote] = useState<string | null>(null);
  if (!offer) return note ? <Txt v="cap" color={C.textMuted}>{note}</Txt> : null;
  return (
    <View style={styles.offer}>
      <Icon name="notifications" size={20} color={C.gold} />
      <View style={styles.flex}>
        <Txt v="bodyBold">Remind me tomorrow?</Txt>
        <Txt v="cap" color={C.textMuted}>
          One notification at 19:00 if you haven&apos;t played. Change it any time in Profile.
        </Txt>
      </View>
      <View style={styles.offerButtons}>
        <Btn
          kind="gold"
          label="YES"
          height={36}
          onPress={async () => {
            const ok = await setPushSetting('dailyReminder', true);
            setNote(ok ? 'Reminder on – see you tomorrow.' : DENIED);
          }}
        />
        <Btn kind="dark" label="NO" height={36} onPress={dismissReminderOffer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gap8: { gap: 8 },
  flex: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: R.lg,
    backgroundColor: alpha(C.surface3, 0.6),
  },
  offer: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: R.sm,
    backgroundColor: alpha(C.gold, 0.08),
  },
  offerButtons: { gap: 6 },
});
