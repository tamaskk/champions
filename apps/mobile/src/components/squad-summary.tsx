import { linkLabel, squadSummary, formationRoles, type PlayerRole } from '@champion/shared';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DraftPick } from '@/components/draft-spin';
import { SaveSquadButton } from '@/components/save-squad';
import { Icon, type IconName } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, HEADER_HEIGHT, IMAGES, R, alpha } from '@/design/tokens';
import { Btn, Chip, Glow, SHADOW_SM, ScreenHeader } from '@/design/ui';
import { formatRating } from '@/utils/rating';

const MAX_PARTNERSHIPS = 4;
const LINES: { role: PlayerRole; tag: string; color: string; note: string }[] = [
  { role: 'FW', tag: 'ATT', color: C.red, note: 'Front line' },
  { role: 'MF', tag: 'MID', color: C.blueLight, note: 'Engine room' },
  { role: 'DF', tag: 'DEF', color: C.green, note: 'Back line' },
  { role: 'GK', tag: 'GK', color: C.gold, note: 'Last line' },
];

const grade = (overall: number) =>
  overall >= 90
    ? 'Legendary Tier S'
    : overall >= 82
      ? 'Elite Tier A'
      : overall >= 74
        ? 'Contender Tier B'
        : 'Underdog Tier C';

type Props = {
  formation: string;
  lineup: readonly (DraftPick | null)[];
  onClose: () => void;
  onNewGame: () => void;
  onStartTournament: () => void;
  /** Label of the main button (daily challenge: "Check challenge"). */
  startLabel?: string;
};

/** End-of-draft summary ("Card Details"): rating, chemistry, overall and what they are made of. */
export function SquadSummary({
  formation,
  lineup,
  onClose,
  onNewGame,
  onStartTournament,
  startLabel = 'Start tournament',
}: Props) {
  const insets = useSafeAreaInsets();
  const summary = useMemo(
    () =>
      squadSummary(
        formation,
        lineup.map((p) => p?.player ?? null),
      ),
    [formation, lineup],
  );
  const roles = useMemo(() => formationRoles(formation), [formation]);
  const { chemistry } = summary;
  const nameOf = (spot: number) => lineup[spot]?.player.name.split(' ').slice(-1)[0] ?? '?';
  const boost = Math.round((chemistry.strengthFactor - 1) * 100);
  const placed = lineup.filter(Boolean).length;

  return (
    <View style={styles.screen}>
      <Glow color={C.greenStrong} opacity={0.2} size={300} style={{ alignSelf: 'center', top: 0 }} />
      <Glow color={C.gold} opacity={0.15} size={260} style={{ right: -40, top: 250 }} />
      <ScreenHeader title="Card Details" onBack={onClose} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + HEADER_HEIGHT + 8, paddingBottom: 112 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(250)} style={styles.between}>
          <View style={styles.row8}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close summary"
              style={styles.close}>
              <Icon name="close" size={16} color={C.text} />
            </Pressable>
            <View>
              <View style={styles.row6}>
                <Txt v="h24">Squad complete</Txt>
                <Chip
                  label="LOCKED"
                  color={C.green}
                  bg={alpha(C.green, 0.2)}
                  type="capUpper"
                  radius={R.pill}
                  style={{ paddingHorizontal: 6, paddingVertical: 2 }}
                />
              </View>
              <View style={styles.row4}>
                <Txt v="body" color={C.textMuted}>
                  {formation} Formation
                </Txt>
                <View style={styles.dot} />
                <Txt v="cap" color={C.green}>
                  All {placed}/{lineup.length} drafted
                </Txt>
              </View>
            </View>
          </View>
          <View style={styles.trophy}>
            <Icon name="workspace_premium" size={20} color={C.gold} />
          </View>
        </Animated.View>

        {/* Showcase banner */}
        <View style={styles.banner}>
          <Image source={IMAGES.stadium} style={styles.bannerImage} contentFit="cover" />
          <View style={styles.bannerShade} />
          <View style={styles.bannerRow}>
            <View style={styles.row8}>
              <View style={styles.bannerIcon}>
                <Icon name="stadium" size={16} color={C.text} />
              </View>
              <View>
                <Txt v="capUpper" color={C.textMuted} style={{ letterSpacing: 0.6 }}>
                  LINEUP GRADE
                </Txt>
                <Txt v="h20" style={{ lineHeight: 20 }}>
                  {grade(summary.overall)}
                </Txt>
              </View>
            </View>
            <Chip label="Ready for Cup" color={C.gold} bg={alpha(C.surface3, 0.8)} icon="verified" radius={R.pill} />
          </View>
        </View>

        {/* Three tiles */}
        <View style={styles.gap4}>
          <View style={styles.tiles}>
            <Tile
              label="RATING"
              icon="local_fire_department"
              tint={C.blueLight}
              glow={C.blue}
              value={summary.rating.toFixed(1)}
              note={summary.rating >= 85 ? 'Elite Base' : summary.rating >= 75 ? 'Strong Base' : 'Solid Base'}
              noteColor={C.blueLight}
            />
            <Tile
              label="CHEM"
              icon="link"
              tint={C.green}
              glow={C.green}
              value={String(chemistry.team)}
              note={chemistry.team >= 90 ? 'Synergy Peak' : chemistry.team >= 60 ? 'Good Synergy' : 'Low Synergy'}
              noteColor={C.greenLight}
            />
            <Tile
              label="OVERALL"
              icon="crown"
              tint={C.gold}
              glow={C.gold}
              value={formatRating(summary.overall)}
              note={boost >= 0 ? `+${boost}% Boosted` : `${boost}% Chem penalty`}
              noteColor={C.goldLight}
            />
          </View>
          <View style={styles.formula}>
            <Icon name="info" size={12} color={C.textMuted} />
            <Txt v="body" color={C.textMuted}>
              Overall = Rating × Chemistry (
              <Txt v="bodySemi" color={C.gold} style={{ letterSpacing: 0 }}>
                {boost >= 0 ? '+' : '−'}
                {Math.abs(boost)}% {boost >= 0 ? 'boost' : 'penalty'}
              </Txt>{' '}
              applied)
            </Txt>
          </View>
        </View>

        <SaveSquadButton />

        {/* Synergies */}
        <View style={styles.gap8}>
          <View style={[styles.between, { paddingHorizontal: 4 }]}>
            <Txt v="h14" style={[styles.upper, { letterSpacing: 0.35 }]}>
              CHEMISTRY SYNERGIES
            </Txt>
            <Txt v="cap" color={C.green} style={{ fontFamily: 'Inter_600SemiBold' }}>
              +{chemistry.bonuses.length * 5} Total Boost
            </Txt>
          </View>
          {chemistry.bonuses.length === 0 && (
            <View style={styles.bonus}>
              <Txt v="body" color={C.textMuted}>
                No bonus yet: 3+ players from one club (Dynasty) or 4+ compatriots of one era (Golden generation).
              </Txt>
            </View>
          )}
          {chemistry.bonuses.map((b) => {
            const [title, detail] = b.label.split(': ');
            return (
              <View key={b.id} style={[styles.bonus, styles.between]}>
                <View style={[styles.row8, styles.flexShrink]}>
                  <View style={styles.bonusIcon}>
                    <Icon name="star" size={15} color={C.gold} />
                  </View>
                  <View style={styles.flexShrink}>
                    <Txt v="bodySemi">{title}</Txt>
                    <Txt v="body" color={C.textMuted}>
                      {detail}
                    </Txt>
                  </View>
                </View>
                <Chip
                  label="+5 Chem"
                  color={C.green}
                  bg={alpha(C.green, 0.2)}
                  radius={R.pill}
                  style={{ paddingVertical: 2 }}
                />
              </View>
            );
          })}

          {summary.partnerships.length > 0 && (
            <View style={styles.partners}>
              <View style={styles.row6}>
                <Icon name="handshake" size={15} color={C.gold} />
                <Txt v="bodyBold" color={C.gold} style={[styles.upper, { letterSpacing: 0.6 }]}>
                  BEST PARTNERSHIPS
                </Txt>
              </View>
              {summary.partnerships.slice(0, MAX_PARTNERSHIPS).map((l) => {
                const legends = l.kind === 'legends';
                return (
                  <View key={`${l.a}-${l.b}`} style={styles.partner}>
                    <View
                      style={[
                        styles.partnerIcon,
                        { backgroundColor: legends ? alpha(C.goldDeep, 0.2) : alpha(C.blue, 0.2) },
                      ]}>
                      <Icon name={legends ? 'shield' : 'bolt'} size={15} color={legends ? C.gold : C.blueLight} />
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.between}>
                        <Txt v="bodyBold" numberOfLines={1} style={styles.flexShrink}>
                          {nameOf(l.a)} & {nameOf(l.b)}
                        </Txt>
                        <Txt v="cap" color={legends ? C.green : C.gold}>
                          {legends ? 'Max chem' : 'Dual Synergy'}
                        </Txt>
                      </View>
                      <Txt v="body" color={C.textMuted}>
                        {linkLabel(l)}
                      </Txt>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {summary.outOfPosition.length > 0 && (
            <View style={[styles.bonus, styles.row8]}>
              <Icon name="info" size={15} color={C.red} />
              <Txt v="bodySemi" color={C.red} style={styles.flexShrink}>
                Out of position (−1 chemistry each): {summary.outOfPosition.map(nameOf).join(', ')}
              </Txt>
            </View>
          )}
        </View>

        {/* Line averages */}
        <View style={styles.lines}>
          <View style={[styles.between, { paddingBottom: 4 }]}>
            <Txt v="h14" style={styles.upper}>
              LINE AVERAGES
            </Txt>
            <Txt v="body" color={C.textMuted}>
              Positional Balance
            </Txt>
          </View>
          {LINES.map((line) => {
            const avg = summary.lines[line.role];
            if (avg === null) return null;
            const names = lineup.flatMap((p, i) => (p && roles[i] === line.role ? [nameOf(i)] : []));
            return (
              <View key={line.role} style={[styles.lineRow, styles.between]}>
                <View style={[styles.row10, styles.flexShrink]}>
                  <View
                    style={[
                      styles.lineTag,
                      {
                        backgroundColor: alpha(
                          line.color === C.green ? C.greenStrong : line.color === C.blueLight ? C.blue : line.color,
                          0.2,
                        ),
                      },
                    ]}>
                    <Txt v="cap" color={line.color}>
                      {line.tag}
                    </Txt>
                  </View>
                  <View style={styles.flexShrink}>
                    <Txt v="bodySemi" numberOfLines={1}>
                      {names.join(' · ')}
                    </Txt>
                    <Txt v="body" color={C.textMuted}>
                      {line.note}
                    </Txt>
                  </View>
                </View>
                <View style={[styles.row6, { paddingLeft: 8 }]}>
                  <Txt v="h20">{formatRating(avg)}</Txt>
                  <Txt v="cap" color={C.textMuted}>
                    RTG
                  </Txt>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Sticky actions */}
      <View style={[styles.bar, { paddingBottom: 16 + insets.bottom }]}>
        <Btn kind="dark" icon="restart_alt" label="New game" onPress={onNewGame} style={{ flex: 2 }} />
        <Btn
          kind="blue"
          label={startLabel}
          iconRight="chevron_right"
          onPress={onStartTournament}
          style={[{ flex: 3 }, { boxShadow: `0px 0px 12px ${alpha(C.blue, 0.45)}` }]}
        />
      </View>
    </View>
  );
}

function Tile({
  label,
  icon,
  tint,
  glow,
  value,
  note,
  noteColor,
}: {
  label: string;
  icon: IconName;
  tint: string;
  glow: string;
  value: string;
  note: string;
  noteColor: string;
}) {
  return (
    <View style={styles.tile}>
      <Glow color={glow} opacity={0.2} size={64} style={{ right: -16, bottom: -16 }} />
      <View style={[styles.between, { paddingBottom: 4 }]}>
        <Txt v="capUpper" color={C.textMuted}>
          {label}
        </Txt>
        <View style={[styles.tileIcon, { backgroundColor: alpha(glow, 0.2) }]}>
          <Icon name={icon} size={12} color={tint} />
        </View>
      </View>
      <Txt v="h28" color={tint}>
        {value}
      </Txt>
      <Txt v="cap" color={noteColor} numberOfLines={1} style={{ marginTop: 6, marginBottom: 6 }}>
        {note}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    // Above the game screen's header.
    zIndex: 20,
    backgroundColor: C.bg,
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  row4: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  row6: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  row8: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  row10: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gap4: {
    gap: 4,
  },
  gap8: {
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  flexShrink: {
    flexShrink: 1,
  },
  upper: {
    textTransform: 'uppercase',
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: R.pill,
    backgroundColor: C.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: R.pill,
    backgroundColor: C.textDim,
  },
  trophy: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    backgroundColor: C.surface4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    height: 128,
    borderRadius: R.md,
    overflow: 'hidden',
    backgroundColor: C.surface,
    boxShadow: '0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)',
  },
  bannerImage: {
    ...StyleSheet.absoluteFill,
    opacity: 0.4,
  },
  bannerShade: {
    ...StyleSheet.absoluteFill,
    experimental_backgroundImage: `linear-gradient(to top, ${C.deep}, ${alpha(C.deep, 0.7)} 50%, ${alpha(C.deep, 0)})`,
  },
  bannerRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerIcon: {
    width: 32,
    height: 32,
    borderRadius: R.sm,
    backgroundColor: alpha(C.surface4, 0.9),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiles: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    padding: 12,
    borderRadius: R.md,
    backgroundColor: C.surface,
    overflow: 'hidden',
    boxShadow: SHADOW_SM,
  },
  tileIcon: {
    width: 24,
    height: 24,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formula: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: R.sm,
    backgroundColor: alpha(C.deep, 0.8),
  },
  bonus: {
    padding: 10,
    borderRadius: R.md,
    backgroundColor: C.surface,
  },
  bonusIcon: {
    width: 28,
    height: 28,
    borderRadius: R.sm,
    backgroundColor: alpha(C.gold, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  partners: {
    gap: 10,
    padding: 12,
    borderRadius: R.md,
    backgroundColor: C.surface2,
  },
  partner: {
    flexDirection: 'row',
    gap: 10,
    padding: 8,
    borderRadius: R.sm,
    backgroundColor: C.surface,
  },
  partnerIcon: {
    width: 32,
    height: 32,
    marginTop: 2,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lines: {
    gap: 10,
    padding: 14,
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  lineRow: {
    padding: 8,
    borderRadius: R.sm,
    backgroundColor: C.surface2,
  },
  lineTag: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: alpha(C.deep, 0.95),
    boxShadow: '0px 25px 50px -12px rgba(0,0,0,0.25)',
  },
});
