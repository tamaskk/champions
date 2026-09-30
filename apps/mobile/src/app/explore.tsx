import { FORMATIONS, type LeaderboardEntry } from '@champion/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchLeaderboard } from '@/api/client';
import { FormationsSheet, MiniPitch, formationInfo } from '@/components/formations-sheet';
import { SearchSheet } from '@/components/search-sheet';
import { HallOfFameDetail } from '@/components/hall-of-fame-detail';
import { useRecords, type SavedSquad } from '@/game/session';
import { LegalNote } from '@/components/legal-note';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, HEADER_HEIGHT, NAV_ROOM, R, alpha } from '@/design/tokens';
import { Chip, Glow, SHADOW_LG, SHADOW_SM, ScreenHeader } from '@/design/ui';

const FILTERS = ['All', 'Chemistry Guide', 'Hall of Fame', 'Leaderboard', 'Formations'] as const;
type Filter = (typeof FILTERS)[number];

const TIERS: { stars: string; title: string; bonus: string; text: string; dot: string }[] = [
  { stars: '4★', title: 'Legends', bonus: '+4 Chem Bonus', text: '5+ seasons together at one club', dot: C.gold },
  {
    stars: '3★',
    title: 'Team-mates',
    bonus: '+3 Chem Bonus',
    text: 'Same club, same season – shared the dressing room',
    dot: C.green,
  },
  {
    stars: '2★',
    title: 'Club / Era',
    bonus: '+2 Chem Bonus',
    text: 'Same club in another era, or compatriots whose careers overlap',
    dot: C.blue,
  },
  {
    stars: '1★',
    title: 'Compatriots',
    bonus: '+1 Chem Bonus',
    text: 'Same nation, or the same league in the same decade',
    dot: C.textMuted,
  },
];

// Four well-known shapes from the real formation list (details come from the formation itself).
const FORMATION_CARDS = [
  { id: '4-3-3', tag: 'CLASSIC' },
  { id: '4-4-2 diamond', tag: 'DIAMOND' },
  { id: '4-2-3-1', tag: 'MODERN' },
  { id: '3-5-2', tag: 'BACK THREE' },
] as const;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const records = useRecords();
  const [filter, setFilter] = useState<Filter>('All');
  const [searching, setSearching] = useState(false);
  // Real top 3 of the online leaderboard, reloaded whenever the tab comes into view.
  const [leaders, setLeaders] = useState<LeaderboardEntry[] | null | 'error'>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      fetchLeaderboard('all')
        .then((r) => live && setLeaders(r.squads.slice(0, 3)))
        .catch(() => live && setLeaders('error'));
      return () => {
        live = false;
      };
    }, []),
  );
  const [hallSquad, setHallSquad] = useState<SavedSquad | null>(null);
  // true = the full list; a formation id = the list opened on that formation.
  const [showFormations, setShowFormations] = useState<boolean | string>(false);
  const show = (f: Filter) => filter === 'All' || filter === f;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Explore" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + HEADER_HEIGHT + 4, paddingBottom: NAV_ROOM + insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Title + filters */}
        <View style={styles.gap8}>
          <View style={styles.between}>
            <View style={styles.row4}>
              <Txt v="h20">Explore & Vault</Txt>
            </View>
            <Pressable
              onPress={() => setSearching(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Search players or clubs"
              style={({ pressed }) => [styles.search, pressed && { opacity: 0.7 }]}>
              <Icon name="search" size={16} color={C.text} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.filter, filter === f && styles.filterActive]}>
                <Txt v="bodySemi" color={filter === f ? C.onGreenStrong : C.textMuted}>
                  {f}
                </Txt>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Chemistry guide */}
        {show('Chemistry Guide') && (
          <View style={styles.chemCard}>
            <Glow color={C.green} opacity={0.1} size={160} style={{ right: -50, top: -50 }} />
            <View style={styles.between}>
              <View style={styles.flexShrink}>
                <View style={styles.row4}>
                  <Icon name="bolt" size={12} color={C.gold} />
                  <Txt v="capUpper" color={C.gold}>
                    FIELD MECHANICS
                  </Txt>
                </View>
                <Txt v="h24">Master Chemistry (0–100)</Txt>
              </View>
              <View style={styles.max}>
                <Txt v="h20" color={C.gold} style={styles.center}>
                  MAX{'\n'}100
                </Txt>
              </View>
            </View>
            <Txt v="body" color={C.textMuted} style={{ lineHeight: 19.5 }}>
              Place players next to each other who share a club, an era or a nation to lift your pitch rating with
              chemistry links.
            </Txt>

            <View style={styles.topology}>
              <View style={styles.between}>
                <Txt v="cap" color={C.textMuted}>
                  HOW LINKS WORK
                </Txt>
                <Chip label="EXAMPLE" color={C.textMuted} bg={C.surface3} type="capUpper" radius={R.pill} />
              </View>
              {/* A worked example with real careers, scored by the rules in @champion/shared chemistry.ts. */}
              <View style={styles.nodes}>
                <Node color={C.gold} pos="LB" name="Maldini" note="Milan" />
                <Connector color={C.gold} label={'+4 LEGENDS\nMILAN 1985–97'} />
                <Node color={C.gold} pos="CB" name="Baresi" note="Milan" />
                <Connector color={C.blueLight} label={'+2 NATION\n& ERA'} />
                <Node color={C.blueLight} pos="GK" name="Buffon" note="Parma" />
              </View>
              <Txt v="capBody" color={C.textMuted}>
                Your own links show on the pitch while you draft – tap Chemistry lines in the draft settings.
              </Txt>
            </View>

            <View style={styles.tiers}>
              {TIERS.map((t) => (
                <View key={t.title} style={styles.tier}>
                  <View style={styles.row6}>
                    <View
                      style={[
                        styles.tierDot,
                        { backgroundColor: t.dot, boxShadow: `0px 0px 6px ${alpha(t.dot, 0.6)}` },
                      ]}
                    />
                    <Txt v="h20" style={styles.flexShrink}>
                      {t.stars} {t.title}
                    </Txt>
                  </View>
                  <Txt
                    v="bodyBold"
                    color={t.dot === C.textMuted ? C.text : t.dot === C.blue ? C.blueLight : t.dot}
                    style={{ marginTop: 2 }}>
                    {t.bonus}
                  </Txt>
                  <Txt v="body" color={C.textMuted} style={{ marginTop: 2 }}>
                    {t.text}
                  </Txt>
                </View>
              ))}
            </View>

            <View style={styles.row8}>
              <View style={[styles.multiplier, { backgroundColor: alpha(C.goldDeep, 0.2) }]}>
                <Icon name="groups" size={16} color={C.gold} />
                <View style={styles.flexShrink}>
                  <Txt v="capUpper" color={C.gold}>
                    DYNASTY BONUS
                  </Txt>
                  <Txt v="body" color={C.text}>
                    +5 Chem (3+ from one club)
                  </Txt>
                </View>
              </View>
              <View style={[styles.multiplier, { backgroundColor: alpha(C.greenStrong, 0.2) }]}>
                <Icon name="auto_awesome" size={16} color={C.green} />
                <View style={styles.flexShrink}>
                  <Txt v="capUpper" color={C.green}>
                    GOLDEN GEN
                  </Txt>
                  <Txt v="body" color={C.text}>
                    +5 Chem (4+ nation, one era)
                  </Txt>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Hall of fame (this session's squads) */}
        {show('Hall of Fame') && (
          <View style={styles.gap8}>
            <View style={[styles.between, { paddingHorizontal: 4 }]}>
              <View style={styles.row4}>
                <Icon name="workspace_premium" size={18} color={C.gold} />
                <Txt v="h20">Hall of Fame</Txt>
              </View>
              <Txt v="capUpper" color={C.green}>
                {records.squads.length} SAVED ROSTERS
              </Txt>
            </View>
            {records.squads.length === 0 && (
              <View style={styles.squadCard}>
                <Txt v="body" color={C.textMuted}>
                  Finish a draft and it shows up here with its rating, chemistry and best league season.
                </Txt>
              </View>
            )}
            {records.squads.map((s) => {
              const invincible = s.season && s.season.lost === 0;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setHallSquad(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.formation} squad, overall ${Math.round(s.overall)} – open`}
                  style={({ pressed }) => [styles.squadCard, pressed && { opacity: 0.8 }]}>
                  <View style={styles.between}>
                    <View style={styles.flexShrink}>
                      <Txt v="h20" numberOfLines={1}>
                        {Math.round(s.overall)} {s.names.slice(0, 2).join(' & ')}
                      </Txt>
                      <Txt v="body" color={C.textMuted}>
                        {s.season ? `${s.season.label} · ${ordinalPlace(s.season.position)}` : 'No league season yet'} ·{' '}
                        {s.formation}
                      </Txt>
                    </View>
                    {s.season && (
                      <Chip
                        label={`${s.season.won}-${s.season.drawn}-${s.season.lost}${invincible ? ' INVINCIBLE' : ''}`}
                        color={invincible ? C.onGoldDark : C.textMuted}
                        bg={invincible ? C.gold : C.surface4}
                        type="capUpper"
                        radius={R.pill}
                      />
                    )}
                  </View>
                  <View style={styles.statsRow}>
                    <Stat label="RATING" value={String(Math.round(s.overall))} unit="OVR" color={C.text} />
                    <Stat
                      label="CHEMISTRY"
                      value={String(s.chemistry)}
                      unit={s.chemistry === 100 ? 'MAX' : 'CHEM'}
                      color={C.gold}
                    />
                    <Stat label="RECORD" value={s.season ? String(s.season.points) : '–'} unit="PTS" color={C.text} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Leaderboard preview: the real top 3 from the online leaderboard (Ranks tab) */}
        {show('Leaderboard') && (
          <View style={styles.board}>
            <View style={styles.between}>
              <View style={styles.row4}>
                <Icon name="emoji_events" size={20} color={C.gold} />
                <Txt v="h20">Top squads</Txt>
              </View>
              <Chip label="LIVE" dot={C.green} color={C.green} bg={C.surface3} type="capUpper" radius={R.pill} />
            </View>
            {leaders === null && <ActivityIndicator color={C.green} />}
            {leaders === 'error' && (
              <Txt v="body" color={C.textMuted}>
                Couldn&apos;t load the leaderboard – check your connection.
              </Txt>
            )}
            {Array.isArray(leaders) && leaders.length === 0 && (
              <Txt v="body" color={C.textMuted}>
                No saved squads yet – finish a draft and save it to be the first.
              </Txt>
            )}
            {Array.isArray(leaders) && (
              <View style={styles.gap8}>
                {leaders.map((l, i) => (
                  <Pressable
                    key={l.id}
                    onPress={() => router.navigate({ pathname: '/ranks', params: { squad: l.id } })}
                    accessibilityRole="button"
                    accessibilityLabel={`Number ${i + 1}: @${l.username}, overall ${Math.round(l.overall)} – open`}
                    style={({ pressed }) => [styles.leader, pressed && { opacity: 0.8 }]}>
                    <View style={[styles.rank, i === 0 && { backgroundColor: alpha(C.goldDeep, 0.3) }]}>
                      <Txt v="h14" color={i === 0 ? C.gold : C.text}>
                        {i + 1}
                      </Txt>
                    </View>
                    <View style={styles.flex}>
                      <Txt v="h16" numberOfLines={1}>
                        @{l.username}
                      </Txt>
                      <Txt v="body" color={C.textMuted} numberOfLines={1}>
                        {l.formation}
                        {l.result ? ` · ${l.result.detail}` : ' · not played yet'}
                      </Txt>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Txt v="h20" color={C.gold}>
                        {Math.round(l.overall)}{' '}
                        <Txt v="cap" color={C.textMuted}>
                          OVR
                        </Txt>
                      </Txt>
                      <Txt v="capBody" color={C.textMuted}>
                        CHEM {l.chemistry}
                      </Txt>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable
              onPress={() => router.navigate('/ranks')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.openRanks, pressed && { opacity: 0.8 }]}>
              <Txt v="bodyBold" color={C.green}>
                Open the full leaderboard
              </Txt>
              <Icon name="chevron_right" size={16} color={C.green} />
            </Pressable>
          </View>
        )}

        {/* Formations */}
        {show('Formations') && (
          <View style={styles.gap8}>
            <View style={[styles.between, { paddingHorizontal: 4 }]}>
              <View style={styles.row4}>
                <Icon name="grid_view" size={17} color={C.green} />
                <Txt v="h20">Tactical Formations (~{FORMATIONS.length})</Txt>
              </View>
              <Pressable
                onPress={() => setShowFormations(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`See all ${FORMATIONS.length} formations`}>
                <Txt v="bodyBold" color={C.green}>
                  See All
                </Txt>
              </Pressable>
            </View>
            <View style={styles.grid}>
              {FORMATION_CARDS.map((card) => {
                const f = formationInfo(card.id);
                return (
                  <Pressable
                    key={card.id}
                    onPress={() => setShowFormations(card.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${card.id}: ${f.counts.DF} defenders, ${f.counts.MF} midfielders, ${f.counts.FW} forwards – open`}
                    style={({ pressed }) => [styles.formation, pressed && { opacity: 0.8 }]}>
                    <View style={styles.between}>
                      <Chip
                        label={card.tag}
                        color={card.tag === 'CLASSIC' ? C.onGreenStrong : C.text}
                        bg={card.tag === 'CLASSIC' ? C.greenStrong : C.surface4}
                        type="capUpper"
                      />
                    </View>
                    <View style={[styles.between, { marginTop: 8, alignItems: 'flex-start' }]}>
                      <View style={{ flex: 1 }}>
                        <Txt v="h20">{f.shape}</Txt>
                        <Txt v="body" color={f.variant ? C.gold : C.textMuted}>
                          {f.variant || 'flat lines'}
                        </Txt>
                      </View>
                      <MiniPitch formation={card.id} width={46} height={58} />
                    </View>
                    <View style={[styles.between, { marginTop: 10 }]}>
                      <Txt v="capBody" color={C.textMuted}>
                        {f.counts.DF} DF · {f.counts.MF} MF · {f.counts.FW} FW
                      </Txt>
                      <Icon name="chevron_right" size={16} color={C.textMuted} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        <LegalNote />
      </ScrollView>
      {searching && <SearchSheet onClose={() => setSearching(false)} />}
      {hallSquad && <HallOfFameDetail squad={hallSquad} onClose={() => setHallSquad(null)} />}
      {showFormations !== false && (
        <FormationsSheet
          initial={typeof showFormations === 'string' ? showFormations : undefined}
          onClose={() => setShowFormations(false)}
        />
      )}
    </View>
  );
}

const ordinalPlace = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th')}`;

function Node({ color, pos, name, note }: { color: string; pos: string; name: string; note: string }) {
  return (
    <View style={styles.node}>
      <View style={styles.nodeBox}>
        <Txt v="h20" color={color} style={{ lineHeight: 20 }}>
          {pos}
        </Txt>
        <Txt v="tiny" color={C.textMuted}>
          {note}
        </Txt>
      </View>
      <Txt v="capBody" style={{ fontFamily: 'Inter_600SemiBold', marginTop: 4 }}>
        {name}
      </Txt>
    </View>
  );
}

function Connector({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.connector}>
      <View style={[styles.connectorLine, { backgroundColor: color, boxShadow: `0px 0px 8px ${alpha(color, 0.7)}` }]} />
      <Txt v="tinyBold" color={color} style={{ textTransform: 'uppercase', textAlign: 'center' }}>
        {label}
      </Txt>
    </View>
  );
}

function Stat({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <View>
      <Txt v="cap" color={C.textMuted}>
        {label}
      </Txt>
      <Txt v="h24" color={color}>
        {value}{' '}
        <Txt v="cap" color={color === C.gold ? C.gold : C.textMuted}>
          {unit}
        </Txt>
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    paddingHorizontal: 16,
    gap: 24,
  },
  gap8: {
    gap: 8,
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
    gap: 6,
  },
  row6: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  row8: {
    flexDirection: 'row',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  flexShrink: {
    flexShrink: 1,
  },
  center: {
    textAlign: 'center',
  },
  search: {
    width: 32,
    height: 32,
    borderRadius: R.pill,
    backgroundColor: C.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: {
    gap: 6,
  },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: R.pill,
    backgroundColor: C.surface3,
  },
  filterActive: {
    backgroundColor: C.green,
    boxShadow: `0px 0px 6px ${alpha(C.green, 0.35)}`,
  },
  chemCard: {
    gap: 12,
    padding: 16,
    borderRadius: R.md,
    overflow: 'hidden',
    backgroundColor: C.surface2,
    boxShadow: SHADOW_LG,
  },
  max: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: R.md,
    backgroundColor: alpha(C.goldDeep, 0.25),
  },
  topology: {
    gap: 4,
    padding: 8,
    borderRadius: R.sm,
    backgroundColor: C.deep,
  },
  nodes: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: R.sm,
    backgroundColor: C.surface,
  },
  node: {
    alignItems: 'center',
  },
  nodeBox: {
    width: 40,
    height: 48,
    borderRadius: R.xs,
    backgroundColor: C.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: SHADOW_SM,
  },
  connector: {
    flex: 1,
    gap: 4,
    alignItems: 'center',
    paddingHorizontal: 6,
    marginBottom: 18,
  },
  connectorLine: {
    width: '100%',
    height: 4,
    borderRadius: R.pill,
  },
  tiers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tier: {
    width: '48%',
    flexGrow: 1,
    padding: 12,
    borderRadius: R.md,
    backgroundColor: C.surface,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: R.pill,
  },
  multiplier: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: R.md,
  },
  squadCard: {
    gap: 12,
    padding: 16,
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  board: {
    gap: 12,
    padding: 16,
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  openRanks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 4,
  },
  leader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: R.md,
    backgroundColor: C.surface2,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: R.pill,
    backgroundColor: C.surface4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formation: {
    width: '48%',
    flexGrow: 1,
    padding: 12,
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
});
