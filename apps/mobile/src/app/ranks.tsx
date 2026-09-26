import type { LeaderboardEntry, SquadDetail, SquadResult } from '@champion/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchLeaderboard, fetchSquadDetail, squadShareUrl } from '@/api/client';
import { FormationPitch } from '@/components/formation-pitch';
import { useHideTabBar } from '@/components/pill-tabs';
import { ShareSheet } from '@/components/share-sheet';
import { LegalNote } from '@/components/legal-note';
import { MiniLeagues } from '@/components/mini-leagues';
import { Icon, type IconName } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, HEADER_HEIGHT, NAV_ROOM, R, alpha } from '@/design/tokens';
import { Btn, Chip, Glow, SHADOW_SM, ScreenHeader, ratingTint } from '@/design/ui';
import { setPendingChallenge, usePendingChallenge } from '@/game/challenge';
import { ensureUser, useUser } from '@/game/user';

type Period = 'all' | 'week' | 'leagues';
type Load = { status: 'loading' | 'error' } | { status: 'ready'; squads: LeaderboardEntry[] };

const OUTCOME: Record<SquadResult['outcome'], { icon: IconName; color: string }> = {
  champion: { icon: 'emoji_events', color: C.gold },
  top: { icon: 'military_tech', color: C.blueLight },
  win: { icon: 'check_circle', color: C.green },
  draw: { icon: 'handshake', color: C.textMuted },
  mid: { icon: 'leaderboard', color: C.textMuted },
  loss: { icon: 'flag', color: C.red },
  out: { icon: 'flag', color: C.red },
};
const MEDALS = [C.gold, '#c9d1dc', '#d08a4f'];
const surname = (name: string) => name.split(' ').slice(-1)[0] ?? name;

/** Leaderboard tab: the highest-overall saved squads; open one to see its XI and what it achieved. */
export default function RanksScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const params = useLocalSearchParams<{ squad?: string; challenge?: string }>();
  const [period, setPeriod] = useState<Period>('all');
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // Your username is generated the first time the app goes online.
  useEffect(() => {
    ensureUser().catch(() => undefined);
  }, []);

  // A link (e.g. "Saved on the leaderboard" → open) opens that squad.
  useEffect(() => {
    if (params.squad) setOpenId(params.squad);
  }, [params.squad]);

  // A shared link "Challenge this XI" (champion://ranks?challenge=ID): the squad waits for your next draft.
  useEffect(() => {
    if (!params.challenge) return;
    setOpenId(params.challenge);
    fetchSquadDetail(params.challenge)
      .then(setPendingChallenge)
      .catch(() => undefined);
  }, [params.challenge]);

  const refresh = useCallback(async (p: Period) => {
    // Mini-leagues load themselves.
    if (p === 'leagues') return;
    try {
      const { squads } = await fetchLeaderboard(p);
      setLoad({ status: 'ready', squads });
    } catch {
      setLoad({ status: 'error' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh(period);
    }, [refresh, period]),
  );

  const squads = load.status === 'ready' ? load.squads : [];

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Leaderboard" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + HEADER_HEIGHT + 8, paddingBottom: NAV_ROOM + insets.bottom + 16 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={C.green}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh(period);
              setRefreshing(false);
            }}
          />
        }
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(250)} style={styles.hero}>
          <Glow color={C.gold} opacity={0.15} size={220} style={{ right: -60, top: -80 }} />
          <Txt v="capUpper" color={C.gold}>
            GREATEST DRAFTED XIS
          </Txt>
          <Txt v="h24">Highest overall</Txt>
          <Txt v="body" color={C.textMuted}>
            Save your squad after the draft and it appears here under your username – with what it achieved.
          </Txt>
          <View style={styles.me}>
            <Icon name="person" size={14} color={C.green} />
            <Txt v="bodySemi" color={C.green}>
              {user ? `You are @${user.username}` : 'Your username is created when you go online'}
            </Txt>
          </View>
        </Animated.View>

        <View style={styles.segment}>
          {(['all', 'week', 'leagues'] as const).map((p) => (
            <Pressable
              key={p}
              onPress={() => {
                setPeriod(p);
                setLoad({ status: 'loading' });
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: period === p }}
              style={[styles.segBtn, period === p && styles.segActive]}>
              <Txt v="h14" color={period === p ? C.onGreenStrong : C.textMuted}>
                {p === 'all' ? 'All time' : p === 'week' ? 'This week' : 'Leagues'}
              </Txt>
            </Pressable>
          ))}
        </View>

        {period === 'leagues' && <MiniLeagues />}

        {period !== 'leagues' && load.status === 'loading' && <ActivityIndicator color={C.green} style={{ marginTop: 24 }} />}
        {period !== 'leagues' && load.status === 'error' && (
          <Txt v="bodySemi" color={C.red} style={styles.center}>
            Couldn&apos;t load the leaderboard. Check that the web server is running.
          </Txt>
        )}
        {period !== 'leagues' && load.status === 'ready' && squads.length === 0 && (
          <Txt v="body" color={C.textMuted} style={styles.center}>
            No squads yet. Draft an XI and save it – yours will be the first!
          </Txt>
        )}

        {period !== 'leagues' && squads.map((s, i) => {
          const mine = !!user && s.username === user.username;
          const result = s.result ? OUTCOME[s.result.outcome] : null;
          return (
            <Pressable
              key={s.id}
              onPress={() => setOpenId(s.id)}
              accessibilityRole="button"
              accessibilityLabel={`${i + 1}. @${s.username}, overall ${Math.round(s.overall)}`}
              style={({ pressed }) => [styles.row, mine && styles.rowMine, pressed && styles.pressed]}>
              <View style={[styles.rank, i < 3 && { backgroundColor: alpha(MEDALS[i]!, 0.2) }]}>
                <Txt v="num13" color={i < 3 ? MEDALS[i] : C.textMuted}>
                  {i + 1}
                </Txt>
              </View>
              <View style={styles.flex}>
                <Txt v="h14" numberOfLines={1} color={mine ? C.green : C.text}>
                  @{s.username}
                  {mine ? ' (you)' : ''}
                </Txt>
                <Txt v="capBody" color={C.textMuted} numberOfLines={1}>
                  {s.formation} · CHEM {s.chemistry}
                </Txt>
                {s.result && result && (
                  <View style={styles.resultRow}>
                    <Icon name={result.icon} size={11} color={result.color} />
                    <Txt v="capBody" color={result.color} numberOfLines={1} style={styles.flexShrink}>
                      {s.result.title} · {s.result.detail}
                    </Txt>
                  </View>
                )}
              </View>
              <View style={styles.ovr}>
                <Txt v="h24" color={ratingTint(s.overall)}>
                  {Math.round(s.overall)}
                </Txt>
                <Txt v="tinyBold" color={C.textMuted}>
                  OVR
                </Txt>
              </View>
            </Pressable>
          );
        })}
        <LegalNote />
      </ScrollView>

      {openId && (
        <SquadView
          id={openId}
          mine={(u) => !!user && u === user.username}
          onClose={() => {
            setOpenId(null);
            if (params.squad || params.challenge) router.setParams({ squad: undefined, challenge: undefined });
          }}
        />
      )}
    </View>
  );
}

/** A saved squad: numbers, the XI on the pitch, the players, and every result. */
function SquadView({ id, mine, onClose }: { id: string; mine: (username: string) => boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [squad, setSquad] = useState<SquadDetail | null | 'error'>(null);
  const [sharing, setSharing] = useState(false);
  const pending = usePendingChallenge();
  useHideTabBar(true);

  useEffect(() => {
    let live = true;
    setSquad(null);
    fetchSquadDetail(id)
      .then((s) => live && setSquad(s))
      .catch(() => live && setSquad('error'));
    return () => {
      live = false;
    };
  }, [id]);

  const s = squad && squad !== 'error' ? squad : null;
  const pitchWidth = Math.min(width - 32, 420);

  return (
    <View style={styles.overlay}>
      <ScreenHeader title={s ? `@${s.username}` : 'Squad'} onBack={onClose} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + HEADER_HEIGHT + 8, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}>
        {squad === null && <ActivityIndicator color={C.green} style={{ marginTop: 24 }} />}
        {squad === 'error' && (
          <Txt v="bodySemi" color={C.red} style={styles.center}>
            Couldn&apos;t load this squad.
          </Txt>
        )}
        {s && (
          <>
            <Animated.View entering={FadeIn.duration(250)} style={styles.hero}>
              <View style={styles.between}>
                <View style={styles.flex}>
                  <Txt v="capUpper" color={C.green}>
                    {mine(s.username) ? 'YOUR SQUAD' : 'SAVED SQUAD'} · {new Date(s.createdAt).toLocaleDateString()}
                  </Txt>
                  <Txt v="h24">@{s.username}</Txt>
                  <Txt v="body" color={C.textMuted}>
                    {s.formation} formation
                  </Txt>
                </View>
                <Icon name="workspace_premium" size={28} color={C.gold} />
              </View>
              <View style={styles.tiles}>
                <Tile label="OVERALL" value={String(Math.round(s.overall))} color={C.gold} />
                <Tile label="RATING" value={s.rating.toFixed(1)} color={C.blueLight} />
                <Tile label="CHEM" value={String(s.chemistry)} color={C.green} />
              </View>
            </Animated.View>

            <View style={styles.pitchWrap}>
              <FormationPitch
                live={false}
                formation={s.formation}
                width={pitchWidth}
                pressable={s.players.map(() => false)}
                labels={s.players.map((p) => surname(p.name))}
                ratings={s.players.map((p) => p.rating)}
                tag={`@${s.username}`}
              />
            </View>

            <View style={styles.card}>
              <View style={styles.row4}>
                <Icon name="emoji_events" size={16} color={C.gold} />
                <Txt v="h16">What it achieved</Txt>
              </View>
              {s.results.length === 0 ? (
                <Txt v="body" color={C.textMuted}>
                  Not played yet.
                </Txt>
              ) : (
                [...s.results].reverse().map((r, k) => {
                  const o = OUTCOME[r.outcome];
                  return (
                    <View key={k} style={styles.result}>
                      <Icon name={o.icon} size={16} color={o.color} />
                      <View style={styles.flex}>
                        <Txt v="bodySemi">{r.title}</Txt>
                        <Txt v="capBody" color={o.color}>
                          {r.detail}
                        </Txt>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.row4}>
                <Icon name="groups" size={16} color={C.blueLight} />
                <Txt v="h16">Starting XI</Txt>
              </View>
              {s.players.map((p, i) => (
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
              ))}
            </View>
            {s.results.length === 0 && (
              <Chip
                label="THIS SQUAD HASN'T PLAYED A TOURNAMENT YET"
                color={C.textMuted}
                bg={C.surface3}
                radius={R.pill}
              />
            )}
            {!mine(s.username) &&
              (pending?.id === s.id ? (
                <View style={styles.waiting}>
                  <Icon name="swords" size={16} color={C.gold} />
                  <Txt v="bodySemi" color={C.gold} style={styles.flex}>
                    Challenge accepted – draft your XI, then pick &quot;Challenge&quot; in the tournament list.
                  </Txt>
                </View>
              ) : (
                <Btn
                  kind="blue"
                  icon="swords"
                  label="Challenge this XI"
                  sub="Draft your squad, then play against it"
                  onPress={() => {
                    setPendingChallenge(s);
                    onClose();
                    router.push('/');
                  }}
                />
              ))}
            <Btn kind="dark" icon="share" label="Share this squad" onPress={() => setSharing(true)} />
            {sharing && (
              <ShareSheet
                onClose={() => setSharing(false)}
                data={{
                  username: s.username,
                  formation: s.formation,
                  overall: s.overall,
                  rating: s.rating,
                  chemistry: s.chemistry,
                  players: s.players,
                  results: s.results,
                  link: squadShareUrl(s.id),
                  getLink: async () => squadShareUrl(s.id),
                }}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.tile}>
      <Txt v="capUpper" color={C.textMuted}>
        {label}
      </Txt>
      <Txt v="h24" color={color}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: alpha(C.gold, 0.4),
    backgroundColor: alpha(C.gold, 0.08),
  },
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    backgroundColor: C.bg,
  },
  content: {
    gap: 12,
    paddingHorizontal: 16,
  },
  hero: {
    gap: 6,
    padding: 16,
    overflow: 'hidden',
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  me: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: alpha(C.green, 0.12),
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: R.pill,
    backgroundColor: C.surface,
  },
  segBtn: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.pill,
  },
  segActive: {
    backgroundColor: C.greenStrong,
  },
  center: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: R.md,
    backgroundColor: C.surface,
  },
  rowMine: {
    borderWidth: 1,
    borderColor: alpha(C.green, 0.5),
  },
  pressed: {
    opacity: 0.8,
  },
  rank: {
    width: 32,
    height: 32,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface3,
  },
  flex: {
    flex: 1,
  },
  flexShrink: {
    flexShrink: 1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ovr: {
    alignItems: 'center',
    minWidth: 44,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tiles: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: R.sm,
    backgroundColor: C.surface3,
  },
  pitchWrap: {
    alignItems: 'center',
  },
  card: {
    gap: 8,
    padding: 16,
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  row4: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: R.sm,
    backgroundColor: C.surface2,
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.divider,
  },
  spot: {
    width: 36,
    alignItems: 'center',
    paddingVertical: 2,
    borderRadius: R.xs,
    backgroundColor: C.surface4,
  },
});
