import { DRAFT_BOOSTS, STORE_ITEMS, type DraftBoostId } from '@champion/shared';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn } from '@/design/ui';
import { setSetting, useProgress } from '@/game/progress';

type Props = {
  /** null in the Daily Challenge (its own re-spin rules; no restart). */
  respins: { freeLeft: number; bought: number } | null;
  onRestart?: () => void;
  /** Draft boosts (casual drafts only): the active one, how many you own, and activation. */
  boosts?: { active: DraftBoostId | null; owned: Record<DraftBoostId, number>; onActivate: (b: DraftBoostId) => Promise<boolean> };
  onClose: () => void;
};

/** Draft settings behind the tune button: spin speed, chemistry lines, re-spins, restart. */
export function DraftSettings({ respins, onRestart, boosts, onClose }: Props) {
  const { settings } = useProgress();
  const reducedMotion = useReducedMotion();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [activating, setActivating] = useState<DraftBoostId | null>(null);
  const [boostNote, setBoostNote] = useState<string | null>(null);

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
            <Txt v="bodyBold">Dramatic spins</Txt>
            <Txt v="cap" color={C.textMuted}>
              {reducedMotion
                ? 'Off while Reduce Motion is on in your phone settings: reels show their result without spinning.'
                : 'Reels spin twice as long. Tap a spinning reel to stop it at once either way.'}
            </Txt>
          </View>
          <Switch
            value={settings.dramaticReels && !reducedMotion}
            disabled={reducedMotion}
            onValueChange={(v) => setSetting('dramaticReels', v)}
            trackColor={{ true: C.greenStrong, false: C.surface4 }}
            accessibilityLabel="Dramatic spins"
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

        {boosts &&
          (boosts.active ? (
            <View style={[styles.item, { backgroundColor: alpha(C.gold, 0.12) }]}>
              <Icon name="bolt" size={20} color={C.gold} />
              <View style={styles.flex}>
                <Txt v="bodyBold" color={C.gold}>
                  {DRAFT_BOOSTS[boosts.active].name} active
                </Txt>
                <Txt v="cap" color={C.textMuted}>
                  For the rest of this draft the club reel lands more often on clubs with{' '}
                  {DRAFT_BOOSTS[boosts.active].minRating}+ rated players.
                </Txt>
              </View>
            </View>
          ) : (
            (['star', 'legend'] as const).map((b) => {
              const cfg = DRAFT_BOOSTS[b];
              const price = STORE_ITEMS.find((i) => i.id === cfg.itemId)?.price ?? 0;
              const owned = boosts.owned[b];
              return (
                <View key={b} style={styles.item}>
                  <Icon name="bolt" size={20} color={b === 'legend' ? C.gold : C.blueLight} />
                  <View style={styles.flex}>
                    <Txt v="bodyBold">
                      {cfg.name} · {cfg.minRating}+
                    </Txt>
                    <Txt v="cap" color={C.textMuted}>
                      {owned > 0 ? `You have ${owned} · for this draft` : `${price} coins in Profile → Shop`}
                    </Txt>
                  </View>
                  <Btn
                    kind={owned > 0 ? 'gold' : 'dark'}
                    label={activating === b ? '…' : 'USE'}
                    height={36}
                    disabled={owned < 1 || activating !== null}
                    onPress={async () => {
                      setActivating(b);
                      const ok = await boosts.onActivate(b);
                      setActivating(null);
                      setBoostNote(ok ? null : 'Couldn’t use the boost – check your connection.');
                    }}
                  />
                </View>
              );
            })
          ))}
        {boostNote && (
          <Txt v="capBody" color={C.red}>
            {boostNote}
          </Txt>
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
