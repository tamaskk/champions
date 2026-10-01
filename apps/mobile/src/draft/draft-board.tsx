import { DRAFT_BOOSTS, type Formation } from '@champion/shared';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BenchRow } from '@/components/bench-row';
import { FormationPitch } from '@/components/formation-pitch';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, HEADER_HEIGHT, NAV_ROOM, R, alpha } from '@/design/tokens';
import { Btn, Chip, SHADOW_SM } from '@/design/ui';
import { kitColor, useProgress } from '@/game/progress';
import { usePack } from '@/offline/pack';
import { formatRating } from '@/utils/rating';

import { BENCH_MIN } from './constants';
import { DraftActions } from './draft-actions';
import { DraftHint } from './draft-hint';
import type { Draft } from './use-draft';

/** Team building: the tactic bar, the squad's numbers, the pitch, the bench and the buttons. */
export function DraftBoard({ d, formation }: { d: Draft; formation: Formation }) {
  const {
    arcadeTag,
    bench,
    boost,
    canSwapWithBench,
    captainSpot,
    chemistry,
    closeGame,
    daily,
    fits,
    lineup,
    moveFits,
    moveGains,
    moving,
    pending,
    pendingPreview,
    pillars,
    pitchPressable,
    placed,
    pressBench,
    pressSpot,
    ratingTotal,
    selected,
    setCard,
    setSelected,
    setShowFormation,
    setShowSettings,
    setSubbing,
    showLinks,
    sub,
    subFits,
    subGains,
    subbing,
    toggleCaptain,
    useBench,
  } = d;
  // Running from the offline pack: nothing of this draft is ranked.
  const offline = usePack().offline;
  // Kit colour chosen on the profile, for the placed players on the pitch.
  const kit = kitColor(useProgress());
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Header, top bar, stats and badges above the pitch; helper, buttons and tab bar below.
  const pitchWidth = Math.min(
    width - 32,
    (height - insets.top - insets.bottom - HEADER_HEIGHT - 130 - 110 - NAV_ROOM) / 1.25,
  );
  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: insets.top + HEADER_HEIGHT, paddingBottom: NAV_ROOM + insets.bottom }}
      showsVerticalScrollIndicator={false}>
      <View style={styles.top}>
        <View style={styles.between}>
          <Pressable
            onPress={closeGame}
            accessibilityRole="button"
            accessibilityLabel="Back to home"
            style={styles.roundBtn}>
            <Icon name="close" size={18} color={C.text} />
          </Pressable>
          <Pressable
            onPress={() => setShowFormation(true)}
            accessibilityRole="button"
            accessibilityLabel={`Formation ${formation}: show spots and players`}
            style={({ pressed }) => [{ alignItems: 'center' }, pressed && { opacity: 0.7 }]}>
            <Txt v="capUpper" color={C.green} style={{ letterSpacing: 1 }}>
              ACTIVE TACTIC
            </Txt>
            <View style={styles.row4}>
              <Txt v="h24" style={{ letterSpacing: 1.2 }}>
                {formation}
              </Txt>
              <Icon name="expand_more" size={16} color={C.green} />
            </View>
          </Pressable>
          <Pressable
            onPress={() => setShowSettings(true)}
            accessibilityRole="button"
            accessibilityLabel="Draft settings"
            style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.7 }]}>
            <Icon name="tune" size={18} color={C.text} />
          </Pressable>
        </View>

        <View style={styles.ticker}>
          <View style={styles.row4}>
            <Txt v="capUpper" color={C.textMuted} style={{ letterSpacing: 0.6 }}>
              RATING
            </Txt>
            <View style={[styles.tick, { backgroundColor: alpha(C.blue, 0.2) }]}>
              <Txt v="num13" color={C.blueLight} style={{ lineHeight: 13 }}>
                {formatRating(ratingTotal)}
              </Txt>
            </View>
          </View>
          <View style={styles.tickDot} />
          <View style={styles.row4}>
            <Txt v="capUpper" color={C.textMuted} style={{ letterSpacing: 0.6 }}>
              SQUAD
            </Txt>
            <View style={[styles.tick, { backgroundColor: C.surface4 }]}>
              <Txt v="num13" style={{ lineHeight: 13 }}>
                {placed.length}/{lineup.length}
              </Txt>
            </View>
          </View>
          <View style={styles.tickDot} />
          <View style={styles.row4}>
            <Txt v="capUpper" color={C.textMuted} style={{ letterSpacing: 0.6 }}>
              CHEM
            </Txt>
            <View style={[styles.tick, styles.row2, { backgroundColor: alpha(C.gold, 0.15) }]}>
              <Icon name="bolt" size={11} color={C.gold} />
              <Txt v="num13" color={C.gold} style={{ lineHeight: 13 }}>
                {chemistry?.team ?? 0}
              </Txt>
            </View>
          </View>
        </View>

        {!!chemistry?.bonuses.length && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badges}>
            {chemistry.bonuses.map((b) =>
              b.id === 'dynasty' ? (
                <Chip
                  key={b.id}
                  label={b.label}
                  icon="stars"
                  color={C.goldLight}
                  bg={alpha(C.goldDeep, 0.2)}
                  radius={R.pill}
                />
              ) : (
                <Chip
                  key={b.id}
                  label={b.label}
                  icon="stars"
                  color={C.greenLight}
                  bg={alpha(C.greenStrong, 0.2)}
                  radius={R.pill}
                />
              ),
            )}
          </ScrollView>
        )}
      </View>

      <View style={styles.pitchWrap}>
        <FormationPitch
          kitColor={kit}
          formation={formation}
          width={pitchWidth}
          highlighted={pending ? fits : sub ? subFits : moving ? moveFits : undefined}
          pressable={pitchPressable}
          selected={selected}
          captain={captainSpot >= 0 ? captainSpot : undefined}
          labels={lineup.map((p) => p?.player.name.split(' ').slice(-1)[0] ?? null)}
          ratings={lineup.map((p) => p?.player.rating ?? null)}
          pillars={pillars}
          onPlayerPress={pressSpot}
          links={showLinks ? chemistry?.links : undefined}
          chemistry={chemistry?.players}
          gains={
            pendingPreview
              ? pendingPreview.bySpot.map((team) => (team === null ? null : team - pendingPreview.current))
              : sub
                ? subGains
                : moveGains
          }
          tag={
            daily
              ? 'DAILY CHALLENGE'
              : `${offline ? 'OFFLINE · UNRANKED · ' : ''}${arcadeTag}${boost ? ` · ⚡ ${DRAFT_BOOSTS[boost].name.toUpperCase()}` : ''}`
          }
        />
      </View>

      <View style={styles.bottom}>
        <DraftHint d={d} formation={formation} />

        {useBench && (
          <BenchRow
            bench={bench}
            min={BENCH_MIN}
            placing={!!pending}
            selected={subbing}
            swapTargets={
              selected !== null ? bench.map((b) => canSwapWithBench(selected, b)) : undefined
            }
            onPress={pressBench}
          />
        )}

        {sub && subbing !== null && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.actions}>
            <Btn
              kind="dark"
              icon="person"
              label="PLAYER CARD"
              onPress={() => {
                setCard({ kind: 'bench', index: subbing });
                setSubbing(null);
              }}
              style={styles.flex}
            />
            <Btn kind="mid" icon="close" label="CANCEL" onPress={() => setSubbing(null)} style={styles.flex} />
          </Animated.View>
        )}

        {moving && selected !== null && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.actions}>
            <Btn
              kind="dark"
              icon="person"
              label="PLAYER CARD"
              onPress={() => {
                setCard({ kind: 'xi', index: selected });
                setSelected(null);
              }}
              style={styles.flex}
            />
            <Btn
              kind="gold"
              icon="military_tech"
              label={captainSpot === selected ? 'REMOVE ARMBAND' : 'MAKE CAPTAIN'}
              sub="+1 chemistry to his neighbours"
              onPress={toggleCaptain}
              style={styles.flex}
            />
          </Animated.View>
        )}

        <DraftActions d={d} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  top: {
    gap: 4,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: R.pill,
    backgroundColor: C.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: SHADOW_SM,
  },
  row4: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ticker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: alpha(C.surface, 0.9),
    boxShadow: '0px 10px 15px -3px rgba(0,0,0,0.1), 0px 4px 6px -4px rgba(0,0,0,0.1)',
  },
  tick: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: R.xs,
  },
  tickDot: {
    width: 4,
    height: 4,
    borderRadius: R.pill,
    backgroundColor: C.divider,
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  badges: {
    gap: 6,
    paddingVertical: 2,
  },
  pitchWrap: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  bottom: {
    gap: 4,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
});
