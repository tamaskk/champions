import { FORMATIONS, formationLayout, formationRoles, type PlayerRole } from '@champion/shared';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';

const ROLE_COLOR: Record<PlayerRole, string> = { GK: C.gold, DF: C.blueLight, MF: C.green, FW: '#ff8a80' };
const PITCH_W = 150;
const PITCH_H = 190;


export type FormationInfo = { id: string; shape: string; variant: string; back: number; counts: Record<PlayerRole, number> };

export function formationInfo(id: string): FormationInfo {
  const [shape, ...rest] = id.split(' ');
  const roles = formationRoles(id);
  const counts = { GK: 0, DF: 0, MF: 0, FW: 0 } as Record<PlayerRole, number>;
  for (const r of roles) counts[r]++;
  return { id, shape: shape!, variant: rest.join(' '), back: Number(shape!.split('-')[0]), counts };
}

/** Small pitch drawing: one dot per spot, coloured by line (attack at the top). */
export function MiniPitch({ formation, width = PITCH_W, height = PITCH_H }: { formation: string; width?: number; height?: number }) {
  const spots = formationLayout(formation);
  const roles = formationRoles(formation);
  const dot = Math.max(8, Math.round(width / 11));
  return (
    <View style={[styles.pitch, { width, height }]} accessibilityLabel={`${formation} on a pitch`}>
      <View style={[styles.halfway, { top: height / 2 }]} />
      {spots.map((s, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              left: s.x * width - dot / 2,
              top: (1 - s.y) * height - dot / 2,
              backgroundColor: ROLE_COLOR[roles[i]!],
            },
          ]}
        />
      ))}
    </View>
  );
}

/** All formations the reel can land on, filterable by the number at the back. */
export function FormationsSheet({ onClose, initial }: { onClose: () => void; /** Opened on this formation. */ initial?: string }) {
  const insets = useSafeAreaInsets();
  const all = useMemo(() => FORMATIONS.map(formationInfo), []);
  const backs = useMemo(() => [...new Set(all.map((f) => f.back))].sort((a, b) => a - b), [all]);
  // Opened from a formation card: filter to its back line (so it's near the top) and expand it.
  const [back, setBack] = useState<number | null>(initial ? formationInfo(initial).back : null);
  const [open, setOpen] = useState<string | null>(initial ?? null);
  const shown = back === null ? all : all.filter((f) => f.back === back);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.head}>
          <View style={styles.flex}>
            <Txt v="h20">Formations</Txt>
            <Txt v="cap" color={C.textMuted}>
              {FORMATIONS.length} formations – the draft&apos;s first reel lands on one of them
            </Txt>
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close formations">
            <Txt v="bodySemi" color={C.green}>
              Close
            </Txt>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {[null, ...backs].map((b) => (
            <Pressable
              key={String(b)}
              onPress={() => setBack(b)}
              accessibilityRole="button"
              accessibilityState={{ selected: back === b }}
              style={[styles.filter, back === b && styles.filterActive]}>
              <Txt v="bodySemi" color={back === b ? C.onGreenStrong : C.textMuted}>
                {b === null ? `All (${all.length})` : `${b} at the back (${all.filter((f) => f.back === b).length})`}
              </Txt>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}>
          {shown.map((f) => {
            const expanded = open === f.id;
            const layout = expanded ? formationLayout(f.id) : [];
            const roles = expanded ? formationRoles(f.id) : [];
            return (
              <View key={f.id} style={styles.card}>
                <Pressable
                  onPress={() => setOpen(expanded ? null : f.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${f.id}: ${f.counts.DF} defenders, ${f.counts.MF} midfielders, ${f.counts.FW} forwards`}
                  style={styles.row}>
                  <View style={styles.flex}>
                    <Txt v="h16">{f.shape}</Txt>
                    {f.variant ? (
                      <Txt v="cap" color={C.gold}>
                        {f.variant}
                      </Txt>
                    ) : null}
                  </View>
                  {(['DF', 'MF', 'FW'] as PlayerRole[]).map((r) => (
                    <View key={r} style={[styles.count, { backgroundColor: alpha(ROLE_COLOR[r], 0.15) }]}>
                      <Txt v="tinyBold" color={ROLE_COLOR[r]}>
                        {f.counts[r]} {r}
                      </Txt>
                    </View>
                  ))}
                  <Icon name="expand_more" size={18} color={C.textMuted} />
                </Pressable>
                {expanded && (
                  <View style={styles.detail}>
                    <MiniPitch formation={f.id} />
                    <View style={[styles.flex, styles.codes]}>
                      {(['FW', 'MF', 'DF', 'GK'] as PlayerRole[]).map((r) => {
                        const codes = layout.filter((_, i) => roles[i] === r).map((s) => s.code);
                        return codes.length ? (
                          <View key={r} style={styles.codeLine}>
                            <Txt v="tinyBold" color={ROLE_COLOR[r]}>
                              {r}
                            </Txt>
                            <Txt v="cap" color={C.text}>
                              {codes.join(' · ')}
                            </Txt>
                          </View>
                        ) : null;
                      })}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  flex: { flex: 1 },
  filters: { gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  filter: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill, backgroundColor: C.surface3 },
  filterActive: { backgroundColor: C.greenStrong },
  list: { paddingHorizontal: 16, gap: 8 },
  card: { borderRadius: R.lg, backgroundColor: C.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12 },
  count: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: R.xs },
  detail: { flexDirection: 'row', gap: 14, paddingHorizontal: 12, paddingBottom: 12 },
  pitch: {
    borderRadius: R.md,
    backgroundColor: C.pitchDark,
    borderWidth: 1,
    borderColor: alpha('#ffffff', 0.25),
  },
  halfway: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: alpha('#ffffff', 0.25) },
  dot: { position: 'absolute', borderWidth: 1.5, borderColor: C.deep },
  codes: { gap: 8, justifyContent: 'center' },
  codeLine: { gap: 2 },
});
