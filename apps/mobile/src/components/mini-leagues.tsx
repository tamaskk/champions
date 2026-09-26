import {
  MINI_LEAGUE,
  normalizeLeagueCode,
  todayKey,
  weekDates,
  type MiniLeagueDetail,
  type MiniLeagueSummary,
} from '@champion/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  createMiniLeague,
  fetchMiniLeague,
  fetchMiniLeagues,
  joinMiniLeague,
  leaveMiniLeague,
} from '@/api/client';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn, Chip, SHADOW_SM } from '@/design/ui';
import { shareText } from '@/game/share';
import { ensureUser } from '@/game/user';

type List = { status: 'loading' | 'error' } | { status: 'ready'; leagues: MiniLeagueSummary[] };
type Form = { kind: 'create' | 'join'; text: string; busy: boolean; error: string | null } | null;

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const shiftWeek = (monday: string, weeks: number) =>
  new Date(new Date(`${monday}T00:00:00Z`).getTime() + weeks * 7 * 86_400_000).toISOString().slice(0, 10);

/**
 * Ranks → Leagues: private mini-leagues with friends. Create one (you get an invite code to
 * share) or join with a friend's code; the table is the week's Daily Challenge points.
 */
export function MiniLeagues() {
  const [list, setList] = useState<List>({ status: 'loading' });
  const [form, setForm] = useState<Form>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const user = await ensureUser();
      const { leagues } = await fetchMiniLeagues(user.userId);
      setList({ status: 'ready', leagues });
    } catch {
      setList({ status: 'error' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const submit = async () => {
    if (!form || form.busy) return;
    setForm({ ...form, busy: true, error: null });
    try {
      const user = await ensureUser();
      const { leagues } =
        form.kind === 'create'
          ? await createMiniLeague(user.userId, form.text)
          : await joinMiniLeague(user.userId, form.text);
      setList({ status: 'ready', leagues });
      setForm(null);
      // Open the league just created / joined.
      const target =
        form.kind === 'join'
          ? leagues.find((l) => l.code === normalizeLeagueCode(form.text))
          : leagues[leagues.length - 1];
      if (target) setOpenId(target.id);
    } catch (e) {
      setForm({ ...form, busy: false, error: errorText(e) });
    }
  };

  if (openId) {
    return (
      <LeagueTable
        id={openId}
        onClose={() => {
          setOpenId(null);
          void load();
        }}
        onLeft={(leagues) => {
          setList({ status: 'ready', leagues });
          setOpenId(null);
        }}
      />
    );
  }

  const leagues = list.status === 'ready' ? list.leagues : [];
  const full = leagues.length >= MINI_LEAGUE.maxPerUser;

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.gap12}>
      <View style={styles.card}>
        <View style={styles.row8}>
          <Icon name="groups" size={20} color={C.green} />
          <Txt v="h20">Mini-leagues</Txt>
        </View>
        <Txt v="body" color={C.textMuted}>
          Play the Daily Challenge against your friends: everyone gets the same reels, and every day&apos;s score (0–300)
          adds up to a weekly table. New week every Monday.
        </Txt>
        {!form && (
          <View style={styles.row8}>
            <Btn
              kind="green"
              icon="add"
              label="Create"
              height={44}
              radius={R.sm}
              disabled={full}
              onPress={() => setForm({ kind: 'create', text: '', busy: false, error: null })}
              style={styles.flex}
            />
            <Btn
              kind="mid"
              icon="link"
              label="Join with code"
              height={44}
              radius={R.sm}
              disabled={full}
              onPress={() => setForm({ kind: 'join', text: '', busy: false, error: null })}
              style={styles.flex}
            />
          </View>
        )}
        {full && !form && (
          <Txt v="capBody" color={C.textDim}>
            You are in {MINI_LEAGUE.maxPerUser} leagues – leave one to join another.
          </Txt>
        )}
        {form && (
          <View style={styles.gap8}>
            <Txt v="capUpper" color={C.textMuted}>
              {form.kind === 'create' ? 'LEAGUE NAME' : 'INVITE CODE'}
            </Txt>
            <TextInput
              value={form.text}
              onChangeText={(text) => setForm({ ...form, text, error: null })}
              placeholder={form.kind === 'create' ? 'e.g. Sunday League Legends' : 'e.g. K7M2QX'}
              placeholderTextColor={C.textDim}
              autoFocus
              autoCorrect={false}
              autoCapitalize={form.kind === 'join' ? 'characters' : 'sentences'}
              maxLength={form.kind === 'create' ? MINI_LEAGUE.nameMax : MINI_LEAGUE.codeLength + 2}
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel={form.kind === 'create' ? 'League name' : 'Invite code'}
              style={[styles.input, !!form.error && styles.inputError]}
            />
            {form.error && (
              <Txt v="capBody" color={C.red}>
                {form.error}
              </Txt>
            )}
            <View style={styles.row8}>
              <Btn kind="dark" label="Cancel" height={44} radius={R.sm} onPress={() => setForm(null)} style={styles.flex} />
              <Btn
                kind="green"
                icon={form.kind === 'create' ? 'add' : 'check'}
                label={form.busy ? '…' : form.kind === 'create' ? 'Create league' : 'Join'}
                height={44}
                radius={R.sm}
                disabled={form.busy || form.text.trim().length < 2}
                onPress={submit}
                style={styles.flex}
              />
            </View>
          </View>
        )}
      </View>

      {list.status === 'loading' && <ActivityIndicator color={C.green} />}
      {list.status === 'error' && (
        <Txt v="bodySemi" color={C.red} style={styles.center}>
          Couldn&apos;t load your leagues – check your connection.
        </Txt>
      )}
      {list.status === 'ready' && leagues.length === 0 && !form && (
        <Txt v="body" color={C.textMuted} style={styles.center}>
          No leagues yet. Create one and send the code to your friends.
        </Txt>
      )}
      {leagues.map((l) => (
        <Pressable
          key={l.id}
          onPress={() => setOpenId(l.id)}
          accessibilityRole="button"
          accessibilityLabel={`${l.name}: you are ${l.rank} of ${l.members} this week, ${l.points} points`}
          style={({ pressed }) => [styles.leagueRow, pressed && { opacity: 0.8 }]}>
          <View style={[styles.rank, l.rank === 1 && l.points > 0 && { backgroundColor: alpha(C.gold, 0.2) }]}>
            <Txt v="num13" color={l.rank === 1 && l.points > 0 ? C.gold : C.textMuted}>
              {l.rank}
            </Txt>
          </View>
          <View style={styles.flex}>
            <Txt v="h14" numberOfLines={1}>
              {l.name}
            </Txt>
            <Txt v="capBody" color={C.textMuted}>
              {l.members} member{l.members === 1 ? '' : 's'} · code {l.code}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt v="h20" color={C.gold}>
              {l.points}
            </Txt>
            <Txt v="tinyBold" color={C.textMuted}>
              THIS WEEK
            </Txt>
          </View>
          <Icon name="chevron_right" size={18} color={C.textDim} />
        </Pressable>
      ))}
    </Animated.View>
  );
}

/** One league: this week's table (or an earlier week), the invite code to share, leave. */
function LeagueTable({
  id,
  onClose,
  onLeft,
}: {
  id: string;
  onClose: () => void;
  onLeft: (leagues: MiniLeagueSummary[]) => void;
}) {
  const thisWeek = weekDates(todayKey())[0]!;
  const [week, setWeek] = useState(thisWeek);
  const [detail, setDetail] = useState<MiniLeagueDetail | null | 'error'>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      ensureUser()
        .then((u) => fetchMiniLeague(u.userId, id, week))
        .then((d) => live && setDetail(d))
        .catch(() => live && setDetail('error'));
      return () => {
        live = false;
      };
    }, [id, week]),
  );

  const d = detail && detail !== 'error' ? detail : null;
  const invite = async () => {
    if (!d) return;
    const r = await shareText(
      `Join my Champion mini-league "${d.name}" – same Daily Challenge, weekly table.\nInvite code: ${d.code}\n(Ranks → Leagues → Join with code)`,
    );
    setNote(r === 'copied' ? 'Invite copied to the clipboard.' : r === 'failed' ? 'Sharing failed.' : null);
  };
  const leave = async () => {
    try {
      const u = await ensureUser();
      onLeft((await leaveMiniLeague(u.userId, id)).leagues);
    } catch (e) {
      setNote(errorText(e));
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.gap12}>
      <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" style={styles.back}>
        <Icon name="arrow_back_ios_new" size={14} color={C.green} />
        <Txt v="bodySemi" color={C.green}>
          All leagues
        </Txt>
      </Pressable>

      {detail === null && <ActivityIndicator color={C.green} />}
      {detail === 'error' && (
        <Txt v="bodySemi" color={C.red} style={styles.center}>
          Couldn&apos;t load the league – check your connection.
        </Txt>
      )}

      {d && (
        <>
          <View style={styles.card}>
            <View style={styles.between}>
              <Txt v="h20" numberOfLines={1} style={styles.flexShrink}>
                {d.name}
              </Txt>
              <Chip label={`${d.members}/${MINI_LEAGUE.maxMembers}`} color={C.textMuted} bg={C.surface3} type="capUpper" radius={R.pill} />
            </View>
            <View style={styles.codeRow}>
              <View style={styles.flex}>
                <Txt v="capUpper" color={C.textMuted}>
                  INVITE CODE
                </Txt>
                <Txt v="h24" color={C.gold} style={{ letterSpacing: 3 }} selectable>
                  {d.code}
                </Txt>
              </View>
              <Btn kind="gold" icon="share" label="Invite" height={44} radius={R.sm} onPress={invite} />
            </View>
            {note && (
              <Txt v="capBody" color={C.textMuted}>
                {note}
              </Txt>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.between}>
              <Pressable
                onPress={() => setWeek(shiftWeek(week, -1))}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Previous week"
                style={{ transform: [{ rotate: '180deg' }] }}>
                <Icon name="chevron_right" size={22} color={C.text} />
              </Pressable>
              <View style={{ alignItems: 'center' }}>
                <Txt v="h14">{week === thisWeek ? 'THIS WEEK' : `WEEK OF ${d.dates[0]!.slice(5).replace('-', '/')}`}</Txt>
                <Txt v="capBody" color={C.textMuted}>
                  {d.dates[0]} – {d.dates[6]}
                </Txt>
              </View>
              <Pressable
                onPress={() => setWeek(shiftWeek(week, 1))}
                disabled={week >= thisWeek}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Next week"
                style={{ opacity: week >= thisWeek ? 0.3 : 1 }}>
                <Icon name="chevron_right" size={22} color={C.text} />
              </Pressable>
            </View>

            <View style={styles.table}>
              <View style={[styles.tr, styles.trHead]}>
                <Txt v="capBody" color={C.textMuted} style={styles.pos}>
                  #
                </Txt>
                <Txt v="capBody" color={C.textMuted} style={styles.flex}>
                  PLAYER
                </Txt>
                {DAY_LETTERS.map((l, i) => (
                  <Txt
                    key={i}
                    v="capBody"
                    color={d.dates[i] === d.today ? C.green : C.textMuted}
                    style={styles.day}>
                    {l}
                  </Txt>
                ))}
                <Txt v="capBody" color={C.textMuted} style={styles.total}>
                  PTS
                </Txt>
              </View>
              {d.standings.map((s, i) => (
                <View key={s.username} style={[styles.tr, s.you ? styles.trYou : i % 2 === 1 && styles.trZebra]}>
                  <Txt v="bodyBold" color={i === 0 && s.points > 0 ? C.gold : C.textMuted} style={styles.pos}>
                    {i + 1}
                  </Txt>
                  <Txt v="bodySemi" numberOfLines={1} color={s.you ? C.green : C.text} style={styles.flex}>
                    @{s.username}
                  </Txt>
                  {s.days.map((score, k) => (
                    <View
                      key={k}
                      style={[
                        styles.day,
                        styles.dayCell,
                        {
                          backgroundColor:
                            score === null ? 'transparent' : s.success[k] ? alpha(C.green, 0.25) : alpha(C.gold, 0.15),
                        },
                      ]}>
                      <Txt v="tinyBold" color={score === null ? C.textDim : s.success[k] ? C.green : C.text}>
                        {score === null ? '·' : score}
                      </Txt>
                    </View>
                  ))}
                  <Txt v="num13" color={C.gold} style={styles.total}>
                    {s.points}
                  </Txt>
                </View>
              ))}
            </View>
            <Txt v="capBody" color={C.textDim} style={styles.center}>
              Daily score: 100 for meeting every target + overall + chemistry. Green = targets met. Your first try of
              a day counts.
            </Txt>
          </View>

          {confirmLeave ? (
            <View style={styles.row8}>
              <Btn kind="dark" label="Stay" height={44} radius={R.sm} onPress={() => setConfirmLeave(false)} style={styles.flex} />
              <Btn
                kind="mid"
                icon="close"
                label={d.members === 1 ? 'Leave & delete' : 'Leave league'}
                height={44}
                radius={R.sm}
                onPress={leave}
                style={styles.flex}
              />
            </View>
          ) : (
            <Pressable onPress={() => setConfirmLeave(true)} accessibilityRole="button" style={styles.leave}>
              <Txt v="bodySemi" color={C.textMuted}>
                Leave this league
              </Txt>
            </Pressable>
          )}
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  gap12: { gap: 12 },
  gap8: { gap: 8 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  center: { textAlign: 'center' },
  card: { gap: 10, padding: 16, borderRadius: R.md, backgroundColor: C.surface, boxShadow: SHADOW_SM },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: R.md,
    backgroundColor: C.surface3,
    color: C.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: { borderColor: C.red },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: R.md,
    backgroundColor: C.surface,
    boxShadow: SHADOW_SM,
  },
  rank: {
    width: 32,
    height: 32,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface3,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: R.sm,
    backgroundColor: alpha(C.gold, 0.08),
  },
  table: { borderRadius: R.sm, overflow: 'hidden', backgroundColor: C.deep },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 7 },
  trHead: { backgroundColor: C.surface2, paddingVertical: 4 },
  trYou: { backgroundColor: alpha(C.green, 0.1) },
  trZebra: { backgroundColor: alpha(C.surface2, 0.3) },
  pos: { width: 18 },
  day: { width: 26, textAlign: 'center' },
  dayCell: { alignItems: 'center', paddingVertical: 3, borderRadius: R.xs },
  total: { width: 38, textAlign: 'right' },
  leave: { alignSelf: 'center', padding: 8 },
});
