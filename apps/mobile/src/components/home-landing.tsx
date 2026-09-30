import { FORMATIONS, STARTER_OFFER_DAYS, STARTER_PACK, seasonOf, type DailyResponse } from '@champion/shared';
import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DailyCard } from '@/components/daily-card';
import { Shop } from '@/components/shop';
import { useWallet } from '@/game/wallet';
import { setPendingChallenge, usePendingChallenge } from '@/game/challenge';
import { leagueSeasonTitle, useLeagueSeason } from '@/game/league-season';
import { useRecords } from '@/game/session';
import { LegalNote } from '@/components/legal-note';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, HEADER_HEIGHT, IMAGES, NAV_ROOM, R, alpha } from '@/design/tokens';
import { Chip, Glow, SHADOW_LG, SHADOW_SM, ScreenHeader, SectionTitle } from '@/design/ui';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
/** The live Season Pass season (a calendar month): "SEP 2026 SEASON". */
const seasonLabel = () => {
  const [year, month] = seasonOf().split('-');
  return `${MONTHS[Number(month) - 1]} ${year} SEASON`;
};

const STEPS = [
  {
    color: C.green,
    title: 'Spin Formation',
    text: `Slot reel picks one of ${FORMATIONS.length} formations: classics like 4-3-3 and 3-4-2-1, and wild ones like 2-3-5.`,
  },
  {
    color: C.gold,
    title: 'Draft Era, League & Club',
    text: 'Spin 3 reels to reveal genuine retro club rosters and assign iconic footballers position by position.',
  },
  {
    color: C.blueLight,
    title: 'Simulate & Go 38-0',
    text: 'Test your chemistry against historical European juggernauts and claim arcade trophies.',
  },
];

/** Home tab before a game: hero, "Regular game", daily challenge, your records, how it works. */
export function HomeLanding({
  onStart,
  onDaily,
  onPractice,
  onContinueSeason,
}: {
  onStart: () => void;
  /** Opens the saved league season (played matchday by matchday). */
  onContinueSeason?: () => void;
  onDaily: (d: DailyResponse) => void;
  onPractice?: (d: DailyResponse) => void;
}) {
  // Starter pack: advertised during the account's first days, until bought.
  const { wallet } = useWallet();
  const starterOffer =
    !!wallet && !wallet.entitlements.starterPack && wallet.accountAgeDays < STARTER_OFFER_DAYS;
  const [showShop, setShowShop] = useState(false);
  const insets = useSafeAreaInsets();
  const records = useRecords();
  const last = records.squads[0];
  const run = records.bestRun;
  const challenge = usePendingChallenge();
  const season = useLeagueSeason();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Home" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + HEADER_HEIGHT, paddingBottom: NAV_ROOM + insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <PitchLines />
          <Glow color={C.green} opacity={0.2} size={220} style={{ right: -70, top: -70 }} />
          <Glow color={C.gold} opacity={0.15} size={200} style={{ left: -60, bottom: -60 }} />
          <View style={styles.gap8}>
            <View style={styles.between}>
              <View style={styles.seasonPill}>
                <View style={styles.greenDot} />
                <Txt v="capUpper" color={C.textMuted}>
                  {seasonLabel()}
                </Txt>
              </View>
              <View style={styles.row4}>
                <Icon name="bolt" size={14} color={C.gold} />
                <Txt v="capUpper" color={C.gold} style={{ letterSpacing: 1 }}>
                  ARCADE MODE
                </Txt>
              </View>
            </View>
            <View style={styles.titleRow}>
              <View style={styles.emblem}>
                <Image source={IMAGES.appIcon} style={styles.emblemImage} />
              </View>
              <View>
                <View style={styles.baseline}>
                  <Txt v="h28" style={styles.upper}>
                    SPINVINCIBLE
                  </Txt>
                </View>
                <Txt v="bodySemi" color={C.green}>
                  Build an all-time XI. Go unbeaten.
                </Txt>
              </View>
            </View>
            <View style={styles.viral}>
              <Icon name="emoji_events" size={14} color={C.gold} style={{ marginTop: 1 }} />
              <Txt v="body" color={C.textMuted} style={styles.flex}>
                Spin the reels, draft legends, chase the unbeaten season. Top 5 European leagues from 1960 to
                today.
              </Txt>
            </View>
          </View>
        </View>

        {/* A shared squad waiting to be challenged */}
        {challenge && (
          <View style={styles.challengeBanner}>
            <Icon name="swords" size={18} color={C.gold} />
            <View style={styles.flex}>
              <Txt v="capUpper" color={C.gold}>
                CHALLENGE WAITING
              </Txt>
              <Txt v="bodySemi">
                @{challenge.username}&apos;s XI · OVR {Math.round(challenge.overall)} – draft your squad, then pick
                &quot;Challenge&quot;.
              </Txt>
            </View>
            <Pressable
              onPress={() => setPendingChallenge(null)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Dismiss challenge">
              <Icon name="close" size={16} color={C.textMuted} />
            </Pressable>
          </View>
        )}

        {/* A league season in progress (saved after every matchday) */}
        {season && onContinueSeason && (
          <Pressable
            onPress={onContinueSeason}
            accessibilityRole="button"
            accessibilityLabel={`${season.recorded ? 'See the result of' : 'Continue'} ${leagueSeasonTitle(season)}`}
            style={({ pressed }) => [styles.seasonBanner, pressed && { opacity: 0.8 }]}>
            <Icon name={season.recorded ? 'emoji_events' : 'play_arrow'} size={20} color={C.green} />
            <View style={styles.flex}>
              <Txt v="capUpper" color={C.green}>
                {season.recorded ? 'SEASON FINISHED' : 'SEASON IN PROGRESS'}
              </Txt>
              <Txt v="bodySemi" numberOfLines={1}>
                {leagueSeasonTitle(season)} ·{' '}
                {season.recorded ? 'see the final table' : `matchday ${season.revealed}/${season.rounds}`}
              </Txt>
            </View>
            <Txt v="bodyBold" color={C.green}>
              {season.recorded ? 'View' : 'Continue'}
            </Txt>
            <Icon name="chevron_right" size={18} color={C.green} />
          </Pressable>
        )}

        {/* Regular game */}
        <Pressable
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel="Regular game: spin formation and build your dream XI"
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <View style={styles.ctaSweep} />
          <View style={styles.ctaLeft}>
            <View style={styles.ctaIcon}>
              <Icon name="play_arrow" size={26} color={C.green} />
            </View>
            <View>
              <View style={styles.row8}>
                <Txt v="h20" color={C.onGreen} style={[styles.upper, { letterSpacing: 0.5 }]}>
                  REGULAR GAME
                </Txt>
                <Chip label="FREE" color={C.green} bg={C.onGreen} type="capBody" style={styles.freeChip} />
              </View>
              <Txt v="body" color={alpha(C.onGreen, 0.8)}>
                Spin formation & build your dream XI
              </Txt>
            </View>
          </View>
          <View style={styles.ctaArrow}>
            <Icon name="arrow_forward" size={16} color={C.onGreen} />
          </View>
        </Pressable>

        <DailyCard onPlay={onDaily} onPractice={onPractice} />

        {starterOffer && (
          <Pressable
            onPress={() => setShowShop(true)}
            accessibilityRole="button"
            accessibilityLabel="Starter pack offer"
            style={styles.starter}>
            <Icon name="stars" size={24} color={C.gold} />
            <View style={{ flex: 1 }}>
              <Txt v="h14">STARTER PACK · €{STARTER_PACK.eur.toFixed(2)}</Txt>
              <Txt v="cap" color={C.textMuted}>
                {STARTER_PACK.coins} coins + an exclusive card frame · only in your first {STARTER_OFFER_DAYS} days
              </Txt>
            </View>
            <Icon name="chevron_right" size={18} color={C.textMuted} />
          </Pressable>
        )}

        {/* Your records (this session) */}
        <View style={styles.gap4}>
          <SectionTitle title="YOUR RECORDS" right={`${records.draftsPlayed} Drafts Played`} />
          <View style={styles.records}>
            <Record
              label="BEST RUN"
              value={run ? `${run.won}-${run.lost}` : '–'}
              color={C.green}
              note={run ? (run.lost === 0 ? 'Invincibles' : `${run.drawn} draws`) : 'No season yet'}
            />
            <Record
              label="PEAK OVR"
              value={records.peakOverall !== null ? String(Math.round(records.peakOverall)) : '–'}
              color={C.gold}
              note="Squad Rating"
            />
            <Record
              label="MAX CHEM"
              value={records.maxChemistry !== null ? String(records.maxChemistry) : '–'}
              color={C.blueLight}
              note={records.maxChemistry === 100 ? 'Full Green' : 'Team chemistry'}
            />
          </View>
        </View>

        {/* How it works */}
        <View style={styles.how}>
          <View style={styles.row4}>
            <Icon name="casino" size={15} color={C.green} />
            <Txt v="h14" style={styles.upper}>
              HOW IT WORKS
            </Txt>
          </View>
          <View style={{ gap: 16 }}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={styles.step}>
                <View style={styles.stepNum}>
                  <Txt v="h20" color={s.color}>
                    {i + 1}
                  </Txt>
                </View>
                <View style={styles.flex}>
                  <Txt v="bodySemi">{s.title}</Txt>
                  <Txt v="body" color={C.textMuted}>
                    {s.text}
                  </Txt>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Your latest draft */}
        {last && (
          <View style={styles.feed}>
            <View style={styles.greenDot} />
            <Txt v="body" color={C.textMuted} style={styles.flex} numberOfLines={1}>
              <Txt v="bodySemi" style={{ letterSpacing: 0 }}>
                You
              </Txt>{' '}
              just completed a{' '}
              <Txt v="bodySemi" color={C.gold} style={{ letterSpacing: 0 }}>
                {Math.round(last.overall)} OVR {last.formation}
              </Txt>{' '}
              draft!
            </Txt>
          </View>
        )}
        <LegalNote />
      </ScrollView>
      {showShop && <Shop initialTab="coins" onClose={() => setShowShop(false)} />}
    </View>
  );
}

function Record({ label, value, color, note }: { label: string; value: string; color: string; note: string }) {
  return (
    <View style={styles.record}>
      <Txt v="capUpper" color={C.textMuted} style={{ letterSpacing: 0.6 }}>
        {label}
      </Txt>
      <Txt v="h20" color={color} style={{ marginTop: 2 }}>
        {value}
      </Txt>
      <Txt v="body" color={alpha(C.textMuted, 0.8)} numberOfLines={1}>
        {note}
      </Txt>
    </View>
  );
}

/** Faint pitch markings in the hero card (centre circle, halfway line, boxes). */
function PitchLines() {
  const line = alpha(C.green, 0.1);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.pl, { left: '50%', top: 0, bottom: 0, width: 1.4, backgroundColor: line }]} />
      <View style={[styles.pl, { left: '11%', right: '11%', top: 0, height: 1.4, backgroundColor: line }]} />
      <View style={[styles.pl, { left: '11%', right: '11%', bottom: 0, height: 1.4, backgroundColor: line }]} />
      <View style={[styles.pl, styles.circle, { borderColor: line }]} />
      <View
        style={[
          styles.pl,
          {
            left: '11%',
            width: '11.6%',
            top: '20%',
            bottom: '20%',
            borderWidth: 1.4,
            borderLeftWidth: 0,
            borderColor: line,
          },
        ]}
      />
      <View
        style={[
          styles.pl,
          {
            right: '11%',
            width: '11.6%',
            top: '20%',
            bottom: '20%',
            borderWidth: 1.4,
            borderRightWidth: 0,
            borderColor: line,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  starter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: R.xl,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: alpha(C.gold, 0.45),
  },
  seasonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: alpha(C.green, 0.45),
    backgroundColor: alpha(C.green, 0.08),
  },
  challengeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: alpha(C.gold, 0.45),
    backgroundColor: alpha(C.gold, 0.08),
  },
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    paddingHorizontal: 16,
    gap: 24,
  },
  hero: {
    backgroundColor: C.surface,
    borderRadius: R.md,
    padding: 16,
    overflow: 'hidden',
    boxShadow: SHADOW_LG,
  },
  pl: {
    position: 'absolute',
  },
  circle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.4,
    left: '50%',
    top: '50%',
    marginLeft: -42,
    marginTop: -42,
  },
  gap8: {
    gap: 8,
  },
  gap4: {
    gap: 4,
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
  row8: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  upper: {
    textTransform: 'uppercase',
  },
  seasonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: C.surface3,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: R.pill,
    backgroundColor: C.green,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 4,
  },
  emblem: {
    width: 56,
    height: 56,
    borderRadius: R.sm,
    backgroundColor: C.deep,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: SHADOW_SM,
  },
  emblemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  baseline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  viral: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    padding: 10,
    borderRadius: R.sm,
    backgroundColor: alpha(C.surface4, 0.6),
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: R.md,
    overflow: 'hidden',
    backgroundColor: C.greenStrong,
    boxShadow: `0px 10px 25px ${alpha(C.greenStrong, 0.35)}`,
  },
  ctaSweep: {
    ...StyleSheet.absoluteFill,
    experimental_backgroundImage: `linear-gradient(to right, ${alpha(C.greenLight, 0.2)}, ${alpha(C.greenLight, 0)} 50%, ${alpha(C.gold, 0.2)})`,
  },
  ctaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexShrink: 1,
  },
  ctaIcon: {
    width: 48,
    height: 48,
    borderRadius: R.sm,
    backgroundColor: C.onGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ctaArrow: {
    width: 36,
    height: 36,
    borderRadius: R.pill,
    backgroundColor: alpha(C.onGreen, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  records: {
    flexDirection: 'row',
    gap: 4,
  },
  record: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: R.md,
    backgroundColor: C.surface2,
  },
  how: {
    gap: 8,
    padding: 16,
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: R.pill,
    backgroundColor: C.surface4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: R.md,
    backgroundColor: C.surface2,
  },
});
