import { formationLayout, type LinkResult, type PositionFit } from '@champion/shared';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Icon } from '@/design/icon';
import { TYPE } from '@/design/text';
import { C, F, R, alpha } from '@/design/tokens';
import { ratingTint } from '@/design/ui';
import { useProgress } from '@/game/progress';

// Pitch card proportions (design: 4:5) and the pitch markings inside it.
const ASPECT = 5 / 4;
const STRIPES = 8;
const LINE = 'rgba(255,255,255,0.28)';
const NODE = 44;
const EMPTY = 40;
const LABEL_MAX = 64;

type Props = {
  /** Fill of placed players' nodes: the kit colour chosen on the profile. */
  kitColor?: string;
  formation: string;
  width: number;
  /** While placing or moving a player: how well he fits each spot (main = blue, other = gold,
   * out = red: allowed when moving, costs chemistry). Empty spots that don't fit are dimmed. */
  highlighted?: readonly (PositionFit | 'out')[];
  /** Which spots react to a tap. Defaults to the highlighted ones. */
  pressable?: readonly boolean[];
  /** Spot of the player being moved (ringed). */
  selected?: number | null;
  /** Spot of the captain (armband badge). */
  captain?: number;
  /** Name shown under each spot once it is filled (index-aligned with the layout). */
  labels?: readonly (string | null)[];
  /** Rating of each filled spot (small badge). */
  ratings?: readonly (number | null | undefined)[];
  /** Spots whose name tag is gold (the pillars of a legends partnership). */
  pillars?: readonly boolean[];
  onPlayerPress?: (index: number) => void;
  /** Chemistry links between filled spots (drawn under the players, coloured by strength). */
  links?: readonly LinkResult[];
  /** Chemistry 0–3 of each filled spot (small badge). */
  chemistry?: readonly (number | null)[];
  /** While placing a player: team chemistry gained on each spot he fits ("+3" above the spot). */
  gains?: readonly (number | null)[];
  /** Small HUD tag in the top right corner of the pitch. */
  tag?: string;
  /** "LIVE SYNERGY" chip: on while drafting; off on read-only pitches (a saved squad). */
  live?: boolean;
};

/** Link colour and thickness by value: none, compatriots / league era, club / era, team-mates, legends. */
const LINK_STYLE = [
  { color: 'rgba(255,255,255,0.22)', width: 2 },
  { color: 'rgba(255,255,255,0.45)', width: 2 },
  { color: alpha(C.goldDeep, 0.85), width: 3 },
  { color: C.green, width: 3 },
  { color: C.gold, width: 4 },
];
export const LINK_COLORS = LINK_STYLE.map((l) => l.color);

/** Chemistry badge fill and text by points (−1 … 3); pillars get the bright gold one. */
function chemBadge(points: number, pillar: boolean) {
  if (points < 0) return { bg: '#E5484D', fg: '#ffffff' };
  if (pillar && points >= 3) return { bg: C.gold, fg: C.onGoldDark };
  if (points >= 2) return { bg: C.greenStrong, fg: C.onGreen };
  if (points === 1) return { bg: C.goldDeep, fg: C.onGold };
  return { bg: C.surface4, fg: C.textMuted };
}

const initials = (name: string) =>
  name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

const SEVENTIES_STRIPES = ['#6b7a2f', '#56642a'];

export function FormationPitch({
  formation,
  width,
  highlighted,
  pressable,
  selected,
  labels,
  ratings,
  pillars,
  onPlayerPress,
  links,
  chemistry,
  gains,
  tag = 'ARCADE MODE',
  live = true,
  kitColor,
  captain,
}: Props) {
  // "70s pitch" (store cosmetic): worn, muddy stripes.
  const stripes = useProgress().equipped.pitch === 'pitch-seventies' ? SEVENTIES_STRIPES : [C.pitchLight, C.pitchDark];
  const height = width * ASPECT;
  const spots = useMemo(() => formationLayout(formation), [formation]);
  // Spread the lines over the card (goalkeeper at 86 %, the front line at 18 %), so nodes and
  // their name tags fit between the HUD tags and the bottom edge.
  const [minY, maxY] = useMemo(() => {
    const ys = spots.map((s) => s.y);
    return [Math.min(...ys), Math.max(...ys)];
  }, [spots]);
  const pos = (s: { x: number; y: number }) => ({
    x: (0.06 + s.x * 0.88) * width,
    y: (0.86 - ((s.y - minY) / (maxY - minY || 1)) * 0.68) * height,
  });

  return (
    <Animated.View entering={FadeIn.duration(400)} style={[styles.pitch, { width, height }]}>
      {Array.from({ length: STRIPES }, (_, i) => (
        <View
          key={i}
          style={[
            styles.stripe,
            {
              top: (height / STRIPES) * i,
              height: height / STRIPES + 1,
              backgroundColor: i % 2 ? stripes[0] : stripes[1],
            },
          ]}
        />
      ))}
      <Markings width={width} height={height} />

      {links?.map((link) => {
        const a = pos(spots[link.a]);
        const b = pos(spots[link.b]);
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        const ls = LINK_STYLE[link.value] ?? LINK_STYLE[0];
        return (
          <Animated.View
            key={`link-${link.a}-${link.b}`}
            entering={FadeIn.duration(300)}
            pointerEvents="none"
            style={[
              styles.link,
              {
                width: length,
                height: ls.width,
                left: (a.x + b.x) / 2 - length / 2,
                top: (a.y + b.y) / 2 - ls.width / 2,
                backgroundColor: ls.color,
                boxShadow: link.value >= 4 ? `0px 0px 6px ${alpha(C.gold, 0.6)}` : undefined,
                transform: [{ rotate: `${Math.atan2(b.y - a.y, b.x - a.x)}rad` }],
              },
            ]}
          />
        );
      })}

      {live && (
        <View style={[styles.hud, { left: 10 }]}>
          <View style={styles.hudDot} />
          <Text style={[TYPE.tinyBold, styles.upper, { color: C.green }]}>LIVE SYNERGY</Text>
        </View>
      )}
      <View style={[styles.hud, { right: 10 }]}>
        <Icon name="shield" size={11} color={C.gold} />
        <Text style={[TYPE.tinyBold, styles.upper, { color: C.text, letterSpacing: 0 }]}>{tag}</Text>
      </View>

      {spots.map((spot, i) => {
        const p = pos(spot);
        const name = labels?.[i] ?? null;
        const fit = highlighted?.[i] ?? null;
        const filled = !!name;
        const pillar = !!pillars?.[i];
        const rating = ratings?.[i];
        const chem = chemistry?.[i];
        const size = filled || fit ? NODE : EMPTY;
        const dim = !!highlighted && !fit && !filled;
        const target = fit && !filled ? fit : null;
        const tint = target === 'main' ? C.blue : target === 'other' ? C.gold : target === 'out' ? '#E5484D' : null;
        return (
          <Animated.View
            key={`${formation}-${i}`}
            entering={ZoomIn.delay(200 + i * 60)}
            style={[
              styles.spot,
              { left: p.x - LABEL_MAX / 2, top: p.y - size / 2, zIndex: filled || target ? 2 : 1 },
              dim && styles.dim,
            ]}>
            <Pressable
              onPress={() => onPlayerPress?.(i)}
              disabled={pressable ? !pressable[i] : !fit}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={filled ? `${name}, ${spot.code}` : `Position ${spot.code}`}
              style={[
                styles.node,
                { width: size, height: size, borderRadius: size / 2 },
                filled
                  ? [styles.nodeFilled, kitColor ? { backgroundColor: kitColor } : null]
                  : tint
                    ? { backgroundColor: alpha(tint, 0.15), boxShadow: `0px 0px 16px ${alpha(tint, 0.4)}` }
                    : styles.nodeEmpty,
                filled &&
                  fit && {
                    borderWidth: 2,
                    borderColor: fit === 'main' ? C.green : fit === 'other' ? C.gold : '#E5484D',
                  },
                selected === i && styles.selected,
              ]}>
              {filled ? (
                <Text style={[TYPE.num13, { color: C.text }]}>{initials(name)}</Text>
              ) : (
                <Text
                  style={[
                    tint ? TYPE.num13 : { fontFamily: F.displaySemi, fontSize: 12, lineHeight: 18 },
                    { color: tint ? (target === 'main' ? C.blueLight : tint) : alpha(C.textMuted, 0.7) },
                  ]}>
                  {spot.code}
                </Text>
              )}

              {filled && chem != null && (
                <View style={[styles.chemBadge, { backgroundColor: chemBadge(chem, pillar).bg }]}>
                  <Text style={[TYPE.tiny, { color: chemBadge(chem, pillar).fg, fontFamily: F.bold }]}>{chem}</Text>
                </View>
              )}
              {!filled && target && (
                <View style={[styles.plus, { backgroundColor: target === 'main' ? C.blueLight : tint! }]}>
                  <Icon name="add" size={9} color={C.onBlue} />
                </View>
              )}
              {filled && captain === i && (
                <View style={styles.captainBadge} accessibilityLabel="Captain">
                  <Text style={[TYPE.tiny, { color: C.onGoldDark, fontFamily: F.bold }]}>C</Text>
                </View>
              )}
              {filled && rating != null && (
                <View style={styles.ratingBadge}>
                  <Text style={[TYPE.num9, { color: ratingTint(rating) }]}>{Math.round(rating)}</Text>
                </View>
              )}
            </Pressable>

            {gains?.[i] != null && (
              <Text pointerEvents="none" style={[styles.gain, gains[i]! < 0 && styles.loss]}>
                {gains[i]! < 0 ? `−${-gains[i]!}` : `+${gains[i]}`}
              </Text>
            )}

            <View
              pointerEvents="none"
              style={[
                styles.label,
                filled
                  ? { backgroundColor: pillar ? alpha(C.goldDeep, 0.3) : alpha(C.deep, 0.8) }
                  : target
                    ? { backgroundColor: alpha(target === 'main' ? C.blue : tint!, 0.4) }
                    : { backgroundColor: alpha(C.deep, 0.5) },
              ]}>
              <Text
                numberOfLines={1}
                style={[
                  filled
                    ? pillar
                      ? TYPE.tinyBold
                      : TYPE.tiny
                    : target
                      ? [TYPE.tinyBold, styles.upper]
                      : { fontFamily: F.body, fontSize: 8, lineHeight: 12 },
                  {
                    color: filled ? (pillar ? C.goldLight : C.text) : target ? C.blueSoft : C.textMuted,
                    letterSpacing: filled ? 0 : 0.45,
                  },
                ]}>
                {filled ? name : target ? `DRAFT ${spot.code}` : 'Empty'}
              </Text>
            </View>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

/** Pitch markings: outline, halfway line, centre circle, both penalty and goal areas. */
function Markings({ width, height }: { width: number; height: number }) {
  const inset = 10;
  const w = width - inset * 2;
  const h = height - inset * 2;
  const circle = w * 0.27;
  const box = (bw: number, bh: number, top: boolean) => ({
    width: w * bw,
    height: h * bh,
    left: inset + (w - w * bw) / 2,
    ...(top ? { top: inset, borderTopWidth: 0 } : { bottom: inset, borderBottomWidth: 0 }),
  });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.line, { left: inset, top: inset, width: w, height: h }]} />
      <View style={[styles.fill, { left: inset, width: w, top: height / 2 - 0.75, height: 1.5 }]} />
      <View
        style={[
          styles.line,
          {
            width: circle,
            height: circle,
            borderRadius: circle / 2,
            left: width / 2 - circle / 2,
            top: height / 2 - circle / 2,
          },
        ]}
      />
      {[true, false].map((top) => (
        <View key={String(top)} style={StyleSheet.absoluteFill}>
          <View style={[styles.line, box(0.56, 0.16, top)]} />
          <View style={[styles.line, box(0.26, 0.06, top)]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pitch: {
    overflow: 'hidden',
    borderRadius: R.md,
    backgroundColor: C.deep,
    boxShadow: '0px 25px 50px -12px rgba(0,0,0,0.25)',
  },
  stripe: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  line: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: LINE,
  },
  fill: {
    position: 'absolute',
    backgroundColor: LINE,
  },
  link: {
    position: 'absolute',
    borderRadius: 2,
  },
  hud: {
    position: 'absolute',
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: alpha(C.deep, 0.85),
  },
  hudDot: {
    width: 8,
    height: 8,
    borderRadius: R.pill,
    backgroundColor: C.green,
  },
  upper: {
    textTransform: 'uppercase',
  },
  spot: {
    position: 'absolute',
    width: LABEL_MAX,
    alignItems: 'center',
  },
  dim: {
    opacity: 0.35,
  },
  node: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeFilled: {
    backgroundColor: C.surface4,
    boxShadow: '0px 20px 25px -5px rgba(0,0,0,0.1), 0px 8px 10px -6px rgba(0,0,0,0.1)',
  },
  nodeEmpty: {
    backgroundColor: alpha(C.surface3, 0.6),
  },
  selected: {
    borderWidth: 2,
    borderColor: C.gold,
    boxShadow: `0px 0px 12px ${alpha(C.gold, 0.6)}`,
  },
  chemBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captainBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 16,
    height: 16,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.gold,
  },
  ratingBadge: {
    position: 'absolute',
    bottom: -4,
    left: -4,
    paddingHorizontal: 4,
    height: 13.5,
    borderRadius: R.xs,
    backgroundColor: alpha(C.deep, 0.9),
    justifyContent: 'center',
  },
  gain: {
    position: 'absolute',
    top: -18,
    fontFamily: F.bold,
    fontSize: 12,
    color: C.green,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  loss: {
    color: '#FF8A8A',
  },
  label: {
    marginTop: 3,
    maxWidth: LABEL_MAX,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: R.xs,
  },
});
