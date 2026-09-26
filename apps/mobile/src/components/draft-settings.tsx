import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn } from '@/design/ui';
import { setSetting, useProgress } from '@/game/progress';

type Props = {
  /** null in the Daily Challenge (its own re-spin rules; no restart). */
  respins: { freeLeft: number; bought: number } | null;
  onRestart?: () => void;
  onClose: () => void;
};

/** Draft settings behind the tune button: spin speed, chemistry lines, re-spins, restart. */
export function DraftSettings({ respins, onRestart, onClose }: Props) {
  const { settings } = useProgress();
  const [confirmRestart, setConfirmRestart] = useState(false);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close settings" />
      <View style={styles.sheet}>
        <View style={styles.head}>
          <View style={styles.row8}>
            <Icon name="tune" size={18} color={C.green} />
            <Txt v="h16">Draft settings</Txt>
          </View>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
            <Icon name="close" size={16} color={C.text} />
          </Pressable>
        </View>

        <View style={styles.item}>
          <View style={styles.flex}>
            <Txt v="bodyBold">Fast spins</Txt>
            <Txt v="cap" color={C.textMuted}>
              Every reel stops in half the time
            </Txt>
          </View>
          <Switch
            value={settings.fastReels}
            onValueChange={(v) => setSetting('fastReels', v)}
            trackColor={{ true: C.greenStrong, false: C.surface4 }}
            accessibilityLabel="Fast spins"
          />
        </View>

        <View style={styles.item}>
          <View style={styles.flex}>
            <Txt v="bodyBold">Chemistry lines</Txt>
            <Txt v="cap" color={C.textMuted}>
              Show the links between players on the pitch
            </Txt>
          </View>
          <Switch
            value={settings.showLinks}
            onValueChange={(v) => setSetting('showLinks', v)}
            trackColor={{ true: C.greenStrong, false: C.surface4 }}
            accessibilityLabel="Chemistry lines"
          />
        </View>

        {respins ? (
          <View style={styles.item}>
            <Icon name="autorenew" size={20} color={C.gold} />
            <View style={styles.flex}>
              <Txt v="bodyBold">
                {respins.freeLeft} free re-spin{respins.freeLeft === 1 ? '' : 's'} left
                {respins.bought ? ` · ${respins.bought} bought` : ''}
              </Txt>
              <Txt v="cap" color={C.textMuted}>
                Free re-spins reset with every new draft; buy more in Profile → Shop.
              </Txt>
            </View>
          </View>
        ) : (
          <View style={styles.item}>
            <Icon name="calendar_month" size={20} color={C.gold} />
            <Txt v="cap" color={C.textMuted} style={styles.flex}>
              Daily Challenge: its own re-spin rules, one attempt – no restart.
            </Txt>
          </View>
        )}

        {onRestart && (
          <Btn
            kind={confirmRestart ? 'gold' : 'dark'}
            icon="restart_alt"
            label={confirmRestart ? 'TAP AGAIN: THIS XI IS LOST' : 'RESTART DRAFT'}
            sub={confirmRestart ? undefined : 'New formation, empty squad'}
            height={48}
            onPress={() => (confirmRestart ? onRestart() : setConfirmRestart(true))}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '22%',
    gap: 10,
    padding: 16,
    borderRadius: R.xl,
    backgroundColor: C.surface,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  close: { width: 32, height: 32, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface3 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: R.lg,
    backgroundColor: alpha(C.surface3, 0.6),
  },
  flex: { flex: 1 },
});
