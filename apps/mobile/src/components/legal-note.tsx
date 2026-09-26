import { DISCLAIMER_SHORT } from '@champion/shared';
import { StyleSheet } from 'react-native';

import { Txt } from '@/design/text';
import { C } from '@/design/tokens';

/** "Unofficial fan game…" – shown at the bottom of the main screens and on the share card. */
export function LegalNote({ compact }: { compact?: boolean }) {
  return (
    <Txt v={compact ? 'tiny' : 'capBody'} color={C.textDim} style={[styles.note, compact && styles.compact]}>
      {DISCLAIMER_SHORT}
    </Txt>
  );
}

const styles = StyleSheet.create({
  note: {
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  compact: {
    paddingTop: 0,
    paddingHorizontal: 4,
  },
});
