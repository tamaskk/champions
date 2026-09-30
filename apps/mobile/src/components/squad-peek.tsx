import { formationLayout, formationRoles, positionFit, type PositionFit } from '@champion/shared';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import type { DraftPlayer } from '@/mocks/players';
import { formatRating } from '@/utils/rating';

const FIT_COLOR: Record<Exclude<PositionFit, null>, string> = { main: C.blue, other: C.gold };

/**
 * Your XI so far, shown while you hold a player in the draft list (release to go back). The empty
 * spots the held player could take light up: blue = his main position, gold = another one.
 */
export function SquadPeek({
  formation,
  lineup,
  candidate,
}: {
  formation: string;
  lineup: readonly (DraftPlayer | null)[];
  /** The player being held, if any. */
  candidate: DraftPlayer | null;
}) {
  const { width } = useWindowDimensions();
  const pitchW = Math.min(width - 64, 360);
  const pitchH = pitchW * 1.25;
  const spots = formationLayout(formation);
  const roles = formationRoles(formation);
  const filled = lineup.filter(Boolean).length;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      pointerEvents="none"
      style={styles.backdrop}>
      <View style={styles.card}>
        <View style={styles.head}>
          <Txt v="h16">Your XI · {formation}</Txt>
          <Txt v="cap" color={C.textMuted}>
            {filled}/11 · release to go back
          </Txt>
        </View>
        {candidate && (
          <Txt v="body" color={C.textMuted}>
            <Txt v="bodyBold" color={C.gold}>
              {candidate.name}
            </Txt>{' '}
            could go on the lit spots.
          </Txt>
        )}
        <View style={[styles.pitch, { width: pitchW, height: pitchH }]}>
          <View style={[styles.halfway, { top: pitchH / 2 }]} />
          <View style={[styles.circle, { left: pitchW / 2 - 36, top: pitchH / 2 - 36 }]} />
          {spots.map((s, i) => {
            const p = lineup[i];
            const fit = !p && candidate ? positionFit(candidate, { code: s.code, role: roles[i]! }) : null;
            return (
              <View
                key={i}
                style={[styles.spot, { left: s.x * pitchW - 34, top: (1 - s.y) * pitchH - 22 }]}>
                <View
                  style={[
                    styles.dot,
                    p
                      ? styles.dotFilled
                      : fit
                        ? { backgroundColor: alpha(FIT_COLOR[fit], 0.35), borderColor: FIT_COLOR[fit] }
                        : styles.dotEmpty,
                  ]}>
                  <Txt v="tinyBold" color={p ? C.gold : fit ? C.text : C.textDim}>
                    {p ? (p.rating !== undefined ? formatRating(p.rating) : '–') : s.code}
                  </Txt>
                </View>
                <Txt v="tinyBold" color={p ? C.text : C.textDim} numberOfLines={1} style={styles.name}>
                  {p ? p.name.split(' ').slice(-1)[0] : ''}
                </Txt>
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: R.xl,
    backgroundColor: C.surface,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  pitch: {
    borderRadius: R.lg,
    backgroundColor: C.pitchDark,
    borderWidth: 1,
    borderColor: alpha('#ffffff', 0.25),
    overflow: 'hidden',
  },
  halfway: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: alpha('#ffffff', 0.25) },
  circle: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: alpha('#ffffff', 0.25) },
  spot: { position: 'absolute', width: 68, alignItems: 'center', gap: 2 },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  dotFilled: { backgroundColor: C.deep, borderColor: alpha(C.gold, 0.6) },
  dotEmpty: { backgroundColor: alpha(C.deep, 0.5), borderColor: alpha('#ffffff', 0.3), borderStyle: 'dashed' },
  name: { maxWidth: 68, textAlign: 'center' },
});
