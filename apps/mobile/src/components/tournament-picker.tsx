import { TOURNAMENT_MODES, type SquadDetail, type TournamentMode } from '@champion/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { TournamentShell } from '@/components/tournament-shell';
import { Icon, type IconName } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Chip, Glow, SHADOW_SM } from '@/design/ui';

type Props = {
  /** Squad numbers shown on top, so the player remembers what he is entering with. */
  overall: number;
  chemistry: number;
  onPick: (mode: TournamentMode) => void;
  onBack: () => void;
  /** A shared squad waiting to be challenged ("Challenge this XI"). */
  challenge?: SquadDetail | null;
};

/** Playable modes, in this order, on top. Everything else is shown as "coming soon". */
const PLAYABLE: { id: TournamentMode; icon: IconName; text: string; tint: string }[] = [
  { id: 'match', icon: 'sports_soccer', text: 'Your XI against one real club season', tint: C.blueLight },
  { id: 'league', icon: 'emoji_events', text: 'Pick a league season, replace the last club, go 38-0', tint: C.green },
  { id: 'random-league', icon: 'casino', text: 'The reels pick the league and the season', tint: C.gold },
  {
    id: 'champions-league',
    icon: 'emoji_events',
    text: "Europe's 31 strongest clubs of a season – groups, knockouts, final",
    tint: C.gold,
  },
  {
    id: 'random-champions-league',
    icon: 'casino',
    text: 'The reel picks the season – can you lift the trophy?',
    tint: C.blueLight,
  },
  { id: 'legends', icon: 'crown', text: '40 legendary club seasons – beat them and collect them', tint: C.gold },
  { id: 'h2h', icon: 'swords', text: 'A random player who is looking for an opponent right now', tint: C.red },
];
const label = (id: TournamentMode) => TOURNAMENT_MODES.find((m) => m.id === id)!.label;
const COMING_SOON = TOURNAMENT_MODES.filter((m) => m.id !== 'challenge' && !PLAYABLE.some((p) => p.id === m.id));

/** A teaser for every mode that is not playable yet. */
const TEASERS: Partial<Record<TournamentMode, { icon: IconName; text: string }>> = {
  'champions-league': { icon: 'emoji_events', text: "Europe's elite, from the group stage to the final" },
  'random-champions-league': { icon: 'casino', text: 'A random European Cup season – can you lift the trophy?' },
  'world-cup': { icon: 'explore', text: 'Take on the national teams of a World Cup you pick' },
  'random-world-cup': { icon: 'casino', text: 'A random World Cup year, groups to final' },
};

/** Choose the competition the finished squad plays in. */
export function TournamentPicker({ overall, chemistry, onPick, onBack, challenge }: Props) {
  return (
    <TournamentShell title="Start Tournament" onBack={onBack}>
      <Animated.View entering={FadeIn.duration(250)} style={styles.hero}>
        <Glow color={C.gold} opacity={0.15} size={180} style={{ right: -50, top: -50 }} />
        <Txt v="capUpper" color={C.green}>
          YOUR XI IS READY
        </Txt>
        <Txt v="h24">Choose a competition</Txt>
        <View style={styles.row8}>
          <Chip label={`OVR ${Math.round(overall)}`} color={C.gold} bg={alpha(C.gold, 0.15)} type="cap" />
          <Chip label={`CHEM ${chemistry}`} color={C.green} bg={alpha(C.green, 0.15)} type="cap" />
        </View>
      </Animated.View>

      {challenge && (
        <Pressable
          onPress={() => onPick('challenge')}
          accessibilityRole="button"
          accessibilityLabel={`Challenge @${challenge.username}'s XI`}
          style={({ pressed }) => [styles.option, styles.challenge, pressed && styles.pressed]}>
          <View style={[styles.optionIcon, { backgroundColor: alpha(C.gold, 0.2) }]}>
            <Icon name="swords" size={20} color={C.gold} />
          </View>
          <View style={styles.flex}>
            <Txt v="capUpper" color={C.gold}>
              CHALLENGE WAITING
            </Txt>
            <Txt v="h16">@{challenge.username}&apos;s XI</Txt>
            <Txt v="body" color={C.textMuted}>
              {challenge.formation} · OVR {Math.round(challenge.overall)} · CHEM {challenge.chemistry}
            </Txt>
          </View>
          <Icon name="chevron_right" size={20} color={C.gold} />
        </Pressable>
      )}

      <View style={styles.list}>
        {PLAYABLE.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => onPick(m.id)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
            <View style={[styles.optionIcon, { backgroundColor: alpha(m.tint, 0.15) }]}>
              <Icon name={m.icon} size={20} color={m.tint} />
            </View>
            <View style={styles.flex}>
              <Txt v="h16">{label(m.id)}</Txt>
              <Txt v="body" color={C.textMuted}>
                {m.text}
              </Txt>
            </View>
            <Icon name="chevron_right" size={20} color={C.textMuted} />
          </Pressable>
        ))}
      </View>

      <View style={styles.soonHeader}>
        <View style={styles.rule} />
        <View style={styles.row4}>
          <Icon name="lock" size={13} color={C.textMuted} />
          <Txt v="capUpper" color={C.textMuted}>
            Coming soon
          </Txt>
        </View>
        <View style={styles.rule} />
      </View>
      <View style={styles.list}>
        {COMING_SOON.map((mode) => {
          const teaser = TEASERS[mode.id];
          return (
            <View key={mode.id} accessibilityLabel={`${mode.label}, coming soon`} style={styles.soonCard}>
              <View style={[styles.optionIcon, { backgroundColor: C.surface3 }]}>
                <Icon name={teaser?.icon ?? 'star'} size={18} color={C.textMuted} />
              </View>
              <View style={styles.flex}>
                <Txt v="bodyBold">{mode.label}</Txt>
                {teaser && (
                  <Txt v="body" color={C.textMuted}>
                    {teaser.text}
                  </Txt>
                )}
              </View>
              <Chip label="SOON" color={C.onGoldDark} bg={C.gold} type="capUpper" radius={R.pill} />
            </View>
          );
        })}
      </View>
    </TournamentShell>
  );
}

const styles = StyleSheet.create({
  challenge: {
    borderWidth: 1,
    borderColor: alpha(C.gold, 0.5),
  },
  hero: {
    gap: 6,
    padding: 16,
    borderRadius: R.md,
    overflow: 'hidden',
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  row4: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  row8: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  flex: {
    flex: 1,
  },
  list: {
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: R.lg,
    backgroundColor: C.surface2,
    boxShadow: SHADOW_SM,
  },
  pressed: {
    backgroundColor: C.surface3,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: C.surface3,
  },
  soonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: R.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.surface4,
    backgroundColor: alpha(C.surface, 0.6),
  },
});
