import { StyleSheet, View } from 'react-native';

import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R } from '@/design/tokens';
import { Btn } from '@/design/ui';

import type { Draft } from './use-draft';

/** Leaving a finished tournament with a Second chance in the wallet: one more with this XI? */
export function SecondChanceOffer({ d }: { d: Draft }) {
  const { closeGame, secondChances, takeSecondChance } = d;
  return (
    <View style={styles.offer}>
      <View style={styles.offerCard}>
        <Icon name="replay" size={28} color={C.gold} />
        <Txt v="h20">Second chance?</Txt>
        <Txt v="body" color={C.textMuted} style={{ textAlign: 'center' }}>
          This XI can play one more tournament. You have {secondChances}.
        </Txt>
        <Btn kind="gold" label="PLAY ANOTHER TOURNAMENT" height={48} onPress={takeSecondChance} style={{ alignSelf: 'stretch' }} />
        <Btn kind="dark" label="NO, NEW GAME" height={44} onPress={closeGame} style={{ alignSelf: 'stretch' }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  offer: {
    ...StyleSheet.absoluteFill,
    zIndex: 70,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  offerCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderRadius: R.xl,
    backgroundColor: C.surface,
  },
});
