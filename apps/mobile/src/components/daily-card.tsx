import { dailyForDate, dailyRulesLine, todayKey, type DailyResponse } from '@champion/shared';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { fetchDaily } from '@/api/client';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Chip } from '@/design/ui';
import { dailyStreak, useDailyAttempts } from '@/game/daily';
import { shareText } from '@/game/share';
import { useWallet } from '@/game/wallet';

const TIER_BG = { SILVER: C.surface4, GOLD: C.goldDeep, LEGEND: C.gold } as const;
const TIER_FG = { SILVER: C.text, GOLD: C.onGold, LEGEND: C.onGoldDark } as const;

/** Today's challenge (from the server, or the built-in pool offline): play once, then share. */
export function DailyCard({
  onPlay,
  onPractice,
}: {
  onPlay: (d: DailyResponse) => void;
  /** Practice try (a store item): not ranked, nothing recorded. */
  onPractice?: (d: DailyResponse) => void;
}) {
  const practiceLeft = useWallet().wallet?.consumables['daily-practice'] ?? 0;
  const date = todayKey();
  const [daily, setDaily] = useState<DailyResponse>(() => dailyForDate(date));
  const attempts = useDailyAttempts();
  const attempt = attempts[date];
  const streak = dailyStreak(date, attempts);
  useEffect(() => {
    let live = true;
    fetchDaily(date)
      .then((d) => live && setDaily(d))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [date]);
  const ch = daily.challenge;
  const r = ch.rules;
  const chips = [
    r.formation && { icon: 'account_tree' as const, label: `Locked: ${r.formation}` },
    r.leagues?.length && { icon: 'explore' as const, label: r.leagues.join(' · ') },
    r.decades?.length && {
      icon: 'calendar_month' as const,
      label: r.decades.map((d) => `${String(d).slice(2)}s`).join(' · '),
    },
    r.targetChemistry !== undefined && { icon: 'link' as const, label: `CHEM ${r.targetChemistry}+` },
    r.targetOverall !== undefined && { icon: 'workspace_premium' as const, label: `OVR ${r.targetOverall}+` },
    r.maxRespins !== undefined && { icon: 'autorenew' as const, label: `${r.maxRespins} re-spins` },
    r.opponentLegend && { icon: 'crown' as const, label: 'Beat a legend' },
  ].filter(Boolean) as { icon: 'link'; label: string }[];

  return (
    <View style={styles.gap8}>
      <View style={styles.between}>
        <View style={styles.row4}>
          <Icon name="kid_star" size={17} color={C.gold} />
          <Txt v="h14" style={styles.upper}>
            DAILY CHALLENGE
          </Txt>
        </View>
        <View style={styles.row4}>
          <Icon name={streak > 0 ? 'local_fire_department' : 'calendar_month'} size={12} color={C.gold} />
          <Txt v="cap" color={C.gold}>
            {streak > 0 ? `${streak}-day streak · ${date}` : date}
          </Txt>
        </View>
      </View>
      <View style={styles.card}>
        <View style={styles.between}>
          <View style={styles.flex}>
            <Txt v="capUpper" color={C.gold}>
              SAME CHALLENGE, SAME REELS FOR EVERYONE
            </Txt>
            <Txt v="h20" style={{ lineHeight: 25, marginTop: 2 }}>
              {ch.title}
            </Txt>
            <Txt v="body" color={C.textMuted} style={{ marginTop: 4 }}>
              {ch.description}
            </Txt>
          </View>
          <View style={styles.tier}>
            <Chip label={ch.tier} color={TIER_FG[ch.tier]} bg={TIER_BG[ch.tier]} type="capUpper" />
          </View>
        </View>
        <View style={styles.chips}>
          {chips.map((c) => (
            <Chip key={c.label} label={c.label} color={C.text} bg={C.surface3} icon={c.icon} />
          ))}
        </View>
        {attempt?.done ? (
          <View style={styles.doneRow}>
            <View
              style={[styles.result, { backgroundColor: attempt.success ? alpha(C.green, 0.15) : alpha(C.red, 0.12) }]}>
              <Icon
                name={attempt.success ? 'emoji_events' : 'flag'}
                size={15}
                color={attempt.success ? C.green : C.red}
              />
              <Txt v="bodySemi" color={attempt.success ? C.green : C.red}>
                {attempt.success ? 'Completed!' : 'Failed'} · come back tomorrow
              </Txt>
            </View>
            <Pressable
              onPress={() => shareText(attempt.share)}
              accessibilityRole="button"
              accessibilityLabel="Share result"
              style={styles.shareBtn}>
              <Icon name="share" size={16} color={C.onGoldDark} />
            </Pressable>
          </View>
        ) : attempt ? (
          <View style={[styles.result, { backgroundColor: alpha(C.red, 0.12) }]}>
            <Icon name="lock" size={15} color={C.red} />
            <Txt v="bodySemi" color={C.red}>
              Attempt used (the draft was left) · come back tomorrow
            </Txt>
          </View>
        ) : (
          <Pressable
            onPress={() => onPlay(daily)}
            accessibilityRole="button"
            accessibilityLabel="Enter the daily challenge"
            style={({ pressed }) => [styles.enter, pressed && { opacity: 0.85 }]}>
            <Txt v="bodySemi" color={C.onGoldDark} style={{ letterSpacing: 0.6 }}>
              ENTER CHALLENGE · ONE ATTEMPT
            </Txt>
            <Icon name="arrow_forward" size={15} color={C.onGoldDark} />
          </Pressable>
        )}
        {attempt && onPractice && practiceLeft > 0 && (
          <Pressable
            onPress={() => onPractice(daily)}
            accessibilityRole="button"
            accessibilityLabel="Practice the daily challenge, not ranked"
            style={({ pressed }) => [styles.practice, pressed && { opacity: 0.85 }]}>
            <Icon name="replay" size={15} color={C.text} />
            <Txt v="bodySemi">Practice (not ranked) · {practiceLeft} left</Txt>
          </Pressable>
        )}
        <Txt v="capBody" color={C.textDim}>
          {dailyRulesLine(ch)}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    gap: 4,
  },
  upper: {
    textTransform: 'uppercase',
  },
  flex: {
    flex: 1,
  },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: alpha(C.gold, 0.25),
    backgroundColor: C.surface,
  },
  tier: {
    alignItems: 'flex-end',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  enter: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: R.sm,
    backgroundColor: C.gold,
  },
  practice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: R.pill,
    backgroundColor: C.surface3,
  },
  doneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  result: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: R.sm,
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.gold,
  },
});
