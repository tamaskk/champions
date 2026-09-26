import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormationPitch } from '@/components/formation-pitch';
import { useHideTabBar } from '@/components/pill-tabs';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, HEADER_HEIGHT, R, alpha } from '@/design/tokens';
import { ScreenHeader, ratingTint } from '@/design/ui';
import type { SavedSquad } from '@/game/session';

const surname = (name: string) => name.split(' ').slice(-1)[0] ?? name;

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.tile}>
      <Txt v="h24" color={color}>
        {value}
      </Txt>
      <Txt v="capUpper" color={C.textMuted}>
        {label}
      </Txt>
    </View>
  );
}

/** A squad from your Hall of Fame (kept on the device): pitch, numbers, best season and the XI. */
export function HallOfFameDetail({ squad, onClose }: { squad: SavedSquad; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Full-screen like the Ranks squad view: the tab bar steps aside.
  useHideTabBar(true);
  const players = squad.players ?? [];
  const season = squad.season;

  return (
    <View style={styles.overlay}>
      <ScreenHeader title={`${squad.formation} squad`} onBack={onClose} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + HEADER_HEIGHT + 8, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(250)} style={styles.card}>
          <Txt v="capUpper" color={C.green}>
            HALL OF FAME{squad.createdAt ? ` · ${new Date(squad.createdAt).toLocaleDateString('en-GB')}` : ''}
          </Txt>
          <Txt v="h24">{squad.formation}</Txt>
          <View style={styles.tiles}>
            <Tile label="OVERALL" value={String(Math.round(squad.overall))} color={C.gold} />
            <Tile label="CHEM" value={String(squad.chemistry)} color={C.green} />
            <Tile label="POINTS" value={season ? String(season.points) : '–'} color={C.blueLight} />
          </View>
        </Animated.View>

        {players.length > 0 ? (
          <View style={styles.pitchWrap}>
            <FormationPitch
              live={false}
              formation={squad.formation}
              width={Math.min(width - 32, 420)}
              pressable={players.map(() => false)}
              labels={players.map((p) => surname(p.name))}
              ratings={players.map((p) => p.rating)}
              tag="HALL OF FAME"
            />
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.row6}>
            <Icon name="emoji_events" size={16} color={C.gold} />
            <Txt v="h16">Best season</Txt>
          </View>
          {season ? (
            <Txt v="body" color={C.text}>
              {season.label}: {season.position}. place · {season.won}-{season.drawn}-{season.lost} · {season.points} pts
              {season.lost === 0 ? ' · unbeaten' : ''}
            </Txt>
          ) : (
            <Txt v="body" color={C.textMuted}>
              No league season played with this XI.
            </Txt>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.row6}>
            <Icon name="groups" size={16} color={C.blueLight} />
            <Txt v="h16">Starting XI</Txt>
          </View>
          {players.length > 0 ? (
            players.map((p, i) => (
              <View key={`${p.name}-${i}`} style={styles.player}>
                <View style={styles.spot}>
                  <Txt v="cap" color={C.textMuted}>
                    {p.spot}
                  </Txt>
                </View>
                <View style={styles.flex}>
                  <Txt v="bodySemi" numberOfLines={1}>
                    {p.name}
                  </Txt>
                  <Txt v="capBody" color={C.textMuted} numberOfLines={1}>
                    {p.club} · {p.decade}s · {p.league}
                  </Txt>
                </View>
                <Txt v="h16" color={p.rating !== null ? ratingTint(p.rating) : C.textMuted}>
                  {p.rating !== null ? Math.round(p.rating) : '–'}
                </Txt>
              </View>
            ))
          ) : (
            <>
              <Txt v="body" color={C.text}>
                {squad.names.join(', ')}
              </Txt>
              <Txt v="cap" color={C.textMuted}>
                This squad was saved before full line-ups were kept, so only the names are available.
              </Txt>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 30, backgroundColor: C.bg },
  content: { paddingHorizontal: 16, gap: 16 },
  card: { gap: 10, padding: 16, borderRadius: R.xl, backgroundColor: C.surface },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: R.lg, backgroundColor: alpha(C.surface3, 0.6) },
  pitchWrap: { alignItems: 'center' },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  spot: { width: 40, height: 28, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface3 },
  flex: { flex: 1 },
});
