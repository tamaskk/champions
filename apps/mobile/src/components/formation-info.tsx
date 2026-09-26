import type { PlayerRole, PositionCode, PositionFit } from '@champion/shared';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { ratingTint } from '@/design/ui';

type Spot = { code: PositionCode; role: PlayerRole };

type Props = {
  formation: string;
  spots: Spot[];
  /** Index-aligned with `spots`: the placed player (name, rating) or null. */
  players: ({ name: string; rating?: number } | null)[];
  /** How each placed player fits his spot. */
  fits: PositionFit[];
  chemistry: number;
  onClose: () => void;
};

const ROLE_TITLE: Record<PlayerRole, string> = { GK: 'Goalkeeper', DF: 'Defence', MF: 'Midfield', FW: 'Attack' };
const ROLE_ORDER: PlayerRole[] = ['FW', 'MF', 'DF', 'GK'];
const FIT = {
  main: { label: 'MAIN POSITION', color: C.green },
  other: { label: 'OTHER POSITION', color: C.gold },
  out: { label: 'OUT OF POSITION', color: C.red },
} as const;

/** The spun formation: its shape and every spot with who is on it. Fixed for the whole draft. */
export function FormationInfo({ formation, spots, players, fits, chemistry, onClose }: Props) {
  const [shape, ...rest] = formation.split(' ');
  const variant = rest.join(' ');
  const count = (role: PlayerRole) => spots.filter((s) => s.role === role).length;
  const open = players.filter((p) => !p).length;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close formation info" />
      <View style={styles.sheet}>
        <View style={styles.head}>
          <View style={styles.flex}>
            <Txt v="capUpper" color={C.green}>
              ACTIVE TACTIC · SPUN, FIXED FOR THIS DRAFT
            </Txt>
            <Txt v="h24">{shape}</Txt>
            {variant ? (
              <Txt v="bodySemi" color={C.gold}>
                {variant}
              </Txt>
            ) : null}
          </View>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
            <Icon name="close" size={16} color={C.text} />
          </Pressable>
        </View>

        <View style={styles.summary}>
          {(['DF', 'MF', 'FW'] as PlayerRole[]).map((role) => (
            <View key={role} style={styles.stat}>
              <Txt v="h20">{count(role)}</Txt>
              <Txt v="capUpper" color={C.textMuted}>
                {ROLE_TITLE[role]}
              </Txt>
            </View>
          ))}
          <View style={styles.stat}>
            <Txt v="h20" color={C.gold}>
              {chemistry}
            </Txt>
            <Txt v="capUpper" color={C.textMuted}>
              Chemistry
            </Txt>
          </View>
        </View>
        <Txt v="cap" color={C.textMuted}>
          {open ? `${open} of ${spots.length} spots still open.` : 'All spots filled.'} Green = main position, gold =
          another of his positions; out of position costs chemistry.
        </Txt>

        <ScrollView contentContainerStyle={styles.list}>
          {ROLE_ORDER.map((role) => (
            <View key={role} style={styles.group}>
              <Txt v="h14" color={C.textMuted}>
                {ROLE_TITLE[role].toUpperCase()}
              </Txt>
              {spots.map((spot, i) => {
                if (spot.role !== role) return null;
                const p = players[i];
                const fit = p ? FIT[fits[i] ?? 'out'] : null;
                return (
                  <View key={i} style={styles.row}>
                    <View style={[styles.code, fit && { backgroundColor: alpha(fit.color, 0.15) }]}>
                      <Txt v="num13" color={fit ? fit.color : C.textMuted}>
                        {spot.code}
                      </Txt>
                    </View>
                    <View style={styles.flex}>
                      <Txt v="bodyBold" color={p ? C.text : C.textDim}>
                        {p ? p.name : 'Empty'}
                      </Txt>
                      {fit ? (
                        <Txt v="tinyBold" color={fit.color}>
                          {fit.label}
                        </Txt>
                      ) : null}
                    </View>
                    {p?.rating !== undefined && (
                      <Txt v="num13" color={ratingTint(p.rating)}>
                        {Math.round(p.rating)}
                      </Txt>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
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
    top: '12%',
    maxHeight: '78%',
    gap: 12,
    padding: 16,
    borderRadius: R.xl,
    backgroundColor: C.surface,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  close: { width: 32, height: 32, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface3 },
  flex: { flex: 1 },
  summary: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: R.lg, backgroundColor: C.surface2 },
  list: { gap: 12, paddingBottom: 4 },
  group: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: R.md, backgroundColor: C.surface2 },
  code: { width: 44, height: 32, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface3 },
});
