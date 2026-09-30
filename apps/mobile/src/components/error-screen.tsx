import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C } from '@/design/tokens';
import { Btn } from '@/design/ui';
import { reportRenderError } from '@/game/analytics';

/** Route error boundary (exported from the root layout): reports the error, offers a retry. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportRenderError(error);
  }, [error]);
  return (
    <View style={styles.screen}>
      <Icon name="error" size={40} color={C.gold} />
      <Txt v="h20" style={styles.center}>
        Something went wrong
      </Txt>
      <Txt v="body" color={C.textMuted} style={styles.center}>
        The error was reported. Your saved squads and coins are safe.
      </Txt>
      <Btn kind="blue" icon="replay" label="TRY AGAIN" onPress={() => void retry()} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, backgroundColor: C.bg },
  center: { textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: 12 },
});
