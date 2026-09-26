import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ShareSheet } from '@/components/share-sheet';
import { Txt } from '@/design/text';
import { C } from '@/design/tokens';
import { Btn } from '@/design/ui';
import { squadShareUrl } from '@/api/client';
import { currentSquadLink, saveCurrentSquad, useOnline } from '@/game/online';
import { useUser } from '@/game/user';

/** "Save to leaderboard" and "Share" for the current squad (under your generated username). */
export function SaveSquadButton() {
  const online = useOnline();
  const user = useUser();
  const [sharing, setSharing] = useState(false);
  if (!online.squad) return null;
  const saved = online.status === 'saved';

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Btn
          kind={saved ? 'mid' : 'gold'}
          icon={saved ? 'check_circle' : 'leaderboard'}
          label={saved ? 'On the leaderboard' : online.status === 'saving' ? 'Saving…' : 'Save to leaderboard'}
          sub={
            saved
              ? `@${user?.username ?? ''} · tap to open`
              : online.status === 'error'
                ? 'Offline – tap to try again'
                : user
                  ? `As @${user.username}`
                  : 'Under a generated username'
          }
          height={52}
          disabled={online.status === 'saving'}
          onPress={() =>
            saved ? router.push({ pathname: '/ranks', params: { squad: online.onlineId } }) : saveCurrentSquad()
          }
          style={styles.flex}
        />
        <Btn kind="dark" icon="share" label="Share" height={52} onPress={() => setSharing(true)} style={styles.share} />
      </View>
      {online.status === 'error' && (
        <Txt v="capBody" color={C.red} style={styles.center}>
          Couldn&apos;t reach the server.
        </Txt>
      )}
      {sharing && (
        <ShareSheet
          onClose={() => setSharing(false)}
          data={{
            username: user?.username ?? null,
            formation: online.squad.formation,
            overall: online.squad.overall,
            rating: online.squad.rating,
            chemistry: online.squad.chemistry,
            players: online.squad.players,
            results: online.results,
            link: online.onlineId ? squadShareUrl(online.onlineId) : null,
            getLink: currentSquadLink,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  share: {
    width: 112,
  },
  center: {
    textAlign: 'center',
  },
});
