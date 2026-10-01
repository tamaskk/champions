import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn } from '@/design/ui';
import { deletePack, downloadPack, packUpdateAvailable } from '@/offline/download';
import { usePack } from '@/offline/pack';

/** Profile: download the offline pack (every squad and club season) to play without a connection. */
export function OfflinePackCard() {
  const pack = usePack();
  const [note, setNote] = useState<string | null>(null);
  const downloading = pack.status === 'downloading';
  const percent = pack.total ? Math.round((pack.done / pack.total) * 100) : 0;

  const download = async () => {
    setNote(null);
    const ok = await downloadPack();
    setNote(ok ? 'Ready – you can draft and play without a connection.' : 'Download failed. Check your connection and try again.');
  };
  const checkUpdate = async () => {
    setNote('Checking…');
    const newer = await packUpdateAvailable();
    if (newer === null) return setNote("Can't check right now – no connection.");
    if (!newer) return setNote('Your pack is up to date.');
    void download();
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Icon name="download" size={22} color={pack.status === 'ready' ? C.green : C.blueLight} />
        <View style={styles.flex}>
          <Txt v="bodyBold">
            {pack.status === 'ready'
              ? `Offline pack ready${pack.downloadedAt ? ` · ${pack.downloadedAt}` : ''}`
              : downloading
                ? `Downloading… ${percent}%`
                : 'Play without a connection'}
          </Txt>
          <Txt v="cap" color={C.textMuted}>
            {pack.status === 'ready'
              ? 'Draft, match, league, cup and legends work offline. Offline results are not ranked and earn no coins.'
              : 'Downloads every squad and club season (about 8 MB to download, 55 MB on your phone). Daily, head-to-head and the leaderboard still need a connection.'}
          </Txt>
        </View>
      </View>
      {downloading && (
        <View style={styles.track}>
          <View style={[styles.bar, { width: `${percent}%` }]} />
        </View>
      )}
      {note && !downloading && (
        <Txt v="cap" color={C.gold}>
          {note}
        </Txt>
      )}
      {!downloading &&
        (pack.status === 'ready' ? (
          <View style={styles.buttons}>
            <Btn kind="dark" icon="replay" label="CHECK FOR UPDATE" height={40} onPress={checkUpdate} style={styles.flex} />
            <Btn
              kind="mid"
              icon="close"
              label="REMOVE"
              height={40}
              onPress={() => {
                deletePack();
                setNote('Offline pack removed.');
              }}
              style={styles.flex}
            />
          </View>
        ) : (
          <Btn kind="blue" icon="download" label="DOWNLOAD OFFLINE PACK" height={44} onPress={download} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 12, borderRadius: R.lg, backgroundColor: alpha(C.surface3, 0.6) },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  buttons: { flexDirection: 'row', gap: 8 },
  track: { height: 6, borderRadius: R.pill, backgroundColor: C.surface4, overflow: 'hidden' },
  bar: { height: 6, borderRadius: R.pill, backgroundColor: C.green },
});
