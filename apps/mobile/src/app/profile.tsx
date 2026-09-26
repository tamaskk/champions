import { MAX_LEVEL, STORE_CRESTS, STORE_KITS } from '@champion/shared';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, HEADER_HEIGHT, NAV_ROOM, R, alpha } from '@/design/tokens';
import { Btn, Chip, Glow, SHADOW_SM, ScreenHeader, SectionTitle } from '@/design/ui';
import { AccountCard } from '@/components/account-card';
import { Shop } from '@/components/shop';
import { TeamCrest } from '@/components/team-crest';
import { shareText } from '@/game/share';
import { restoreUser, useUser } from '@/game/user';
import { refreshWallet, useWallet } from '@/game/wallet';
import {
  ACHIEVEMENTS,
  CREST_SHAPES,
  CRESTS,
  DEFAULT_TEAM_NAME,
  KITS,
  MAX_TEAM_NAME,
  TRIMS,
  equip,
  generateCrest,
  levelFor,
  setTeam,
  useProgress,
  type Stats,
  doPrestige,
} from '@/game/progress';

const top = (counts: Record<string, number>) => {
  const [name, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [];
  return name ? { name, n } : null;
};

function winRate(s: Stats) {
  const played = s.matches.won + s.matches.drawn + s.matches.lost;
  return played ? `${Math.round((s.matches.won / played) * 100)}%` : '–';
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });

/** Level, XP, lifetime stats, achievements and the kit/crest rewards (all kept on the device). */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const progress = useProgress();
  const { level: rawLevel, into, needed } = levelFor(progress.xp);
  const level = Math.min(MAX_LEVEL, rawLevel);
  const maxed = rawLevel >= MAX_LEVEL;
  const { wallet } = useWallet();
  const user = useUser();
  const owned = wallet?.owned ?? [];
  const [showShop, setShowShop] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [restore, setRestore] = useState('');
  const [restoreNote, setRestoreNote] = useState<string | null>(null);
  const kits = [
    ...KITS.map((k) => ({ ...k, open: level >= k.level, lockLabel: `Lv ${k.level}` })),
    ...STORE_KITS.filter((k) => owned.includes(k.id)).map((k) => ({ ...k, level: 0, open: true, lockLabel: '' })),
  ];
  const crests = [
    ...CRESTS.map((c) => ({ ...c, open: level >= c.level, lockLabel: `Lv ${c.level}` })),
    ...STORE_CRESTS.filter((c) => owned.includes(c.id)).map((c) => ({
      ...c,
      icon: c.icon as (typeof CRESTS)[number]['icon'],
      level: 0,
      open: true,
      lockLabel: '',
    })),
  ];
  const s = progress.stats;
  const favFormation = top(s.formations);
  const favPlayer = top(s.players);
  const unlockedCount = ACHIEVEMENTS.filter((a) => progress.achievements[a.id]).length;

  const tiles: { label: string; value: string; sub?: string }[] = [
    { label: 'Drafts', value: String(s.drafts) },
    {
      label: 'Win rate',
      value: winRate(s),
      sub: `${s.matches.won}W ${s.matches.drawn}D ${s.matches.lost}L`,
    },
    { label: 'Titles', value: String(s.seasons.titles), sub: `${s.seasons.played} seasons` },
    { label: '38-0 runs', value: String(s.seasons.perfect), sub: `${s.seasons.unbeaten} unbeaten` },
    { label: 'Cups won', value: String(s.cups.won), sub: `${s.cups.played} played` },
    { label: 'Legends', value: String(s.legends.beatenIds.length), sub: `${s.legends.won}/${s.legends.played} won` },
    { label: 'Dailies won', value: String(s.daily.won), sub: `${s.daily.played} played` },
    { label: 'Peak overall', value: s.peakOverall ? String(s.peakOverall) : '–', sub: `Max chem ${s.maxChemistry}` },
  ];

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Profile" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + HEADER_HEIGHT + 4, paddingBottom: NAV_ROOM + insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Level card */}
        <View style={styles.levelCard}>
          <Glow color={C.green} opacity={0.12} size={180} style={{ right: -60, top: -60 }} />
          <View style={styles.row12}>
            <TeamCrest progress={progress} size={56} />
            <View style={styles.flex}>
              <Txt v="capUpper" color={C.green} numberOfLines={1}>
                {progress.team.name || DEFAULT_TEAM_NAME}
              </Txt>
              <View style={styles.row6}>
                <Txt v="h36">Lv {level}</Txt>
                {progress.prestige > 0 && (
                  <Chip
                    label={`PRESTIGE ${progress.prestige}`}
                    icon="workspace_premium"
                    color={C.onGoldDark}
                    bg={C.gold}
                    type="capUpper"
                    radius={R.pill}
                  />
                )}
              </View>
            </View>
            <View style={styles.alignEnd}>
              <Txt v="h20">{progress.xp.toLocaleString('en-US')}</Txt>
              <Txt v="capUpper" color={C.textMuted}>
                TOTAL XP
              </Txt>
            </View>
          </View>
          {maxed ? (
            <>
              <Txt v="body" color={C.gold}>
                Max level. Prestige to start again from level 1 – you keep everything and earn the Prestige frame.
              </Txt>
              <Btn kind="gold" icon="workspace_premium" label="PRESTIGE" height={44} onPress={doPrestige} />
            </>
          ) : (
            <>
              <View style={styles.xpTrack} accessibilityLabel={`${into} of ${needed} XP to level ${level + 1}`}>
                <View style={[styles.xpFill, { width: `${Math.max(2, (into / needed) * 100)}%` }]} />
              </View>
              <Txt v="cap" color={C.textMuted}>
                {into.toLocaleString('en-US')} / {needed.toLocaleString('en-US')} XP to level {level + 1}
              </Txt>
            </>
          )}
        </View>

        {/* Account */}
        <View style={styles.gap12}>
          <SectionTitle icon="person" iconColor={C.green} title="Account" />
          <AccountCard />
        </View>

        {/* Coins */}
        <Pressable
          onPress={() => setShowShop(true)}
          accessibilityRole="button"
          accessibilityLabel="Open the shop"
          style={styles.coinsCard}>
          <Icon name="toll" size={26} color={C.gold} />
          <View style={styles.flex}>
            <Txt v="h20">{wallet ? `${wallet.balance.toLocaleString('en-US')} coins` : 'Coins'}</Txt>
            <Txt v="cap" color={C.textMuted}>
              Shop · Season Pass · free coins
              {wallet ? ` · H2H ${wallet.h2h.rank} (${wallet.h2h.wins} wins this month)` : ''}
            </Txt>
          </View>
          <Chip label="SHOP" icon="shopping_bag" color={C.onGoldDark} bg={C.gold} type="capUpper" radius={R.pill} />
        </Pressable>

        {/* Your club */}
        <View style={styles.gap12}>
          <SectionTitle icon="shield" iconColor={C.green} title="Your club" />
          <View style={styles.clubCard}>
            <View style={styles.row12}>
              <TeamCrest progress={progress} size={72} />
              <View style={[styles.flex, styles.gap8]}>
                <Txt v="capUpper" color={C.textMuted}>
                  Club name
                </Txt>
                <TextInput
                  value={progress.team.name}
                  onChangeText={(name) => setTeam({ name })}
                  placeholder={DEFAULT_TEAM_NAME}
                  placeholderTextColor={C.textDim}
                  maxLength={MAX_TEAM_NAME}
                  autoCorrect={false}
                  accessibilityLabel="Club name"
                  style={styles.input}
                />
              </View>
            </View>

            <Txt v="capUpper" color={C.textMuted}>
              Crest shape
            </Txt>
            <View style={styles.chips}>
              {CREST_SHAPES.map((shape) => (
                <Pressable
                  key={shape}
                  onPress={() => setTeam({ shape })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: progress.team.shape === shape }}>
                  <Chip
                    label={shape}
                    type="capUpper"
                    radius={R.pill}
                    color={progress.team.shape === shape ? C.onGreenStrong : C.textMuted}
                    bg={progress.team.shape === shape ? C.greenStrong : C.surface3}
                    style={styles.chipPad}
                  />
                </Pressable>
              ))}
            </View>

            <Txt v="capUpper" color={C.textMuted}>
              Trim colour
            </Txt>
            <View style={styles.chips}>
              {TRIMS.map((trim) => (
                <Pressable
                  key={trim}
                  onPress={() => setTeam({ trim })}
                  accessibilityRole="button"
                  accessibilityLabel={`Trim ${trim}`}
                  accessibilityState={{ selected: progress.team.trim === trim }}
                  style={[styles.trim, { backgroundColor: trim }, progress.team.trim === trim && styles.swatchActive]}
                />
              ))}
            </View>

            <View style={styles.chips}>
              <Pressable
                onPress={() => setTeam({ initials: !progress.team.initials })}
                accessibilityRole="switch"
                accessibilityState={{ checked: progress.team.initials }}>
                <Chip
                  label={progress.team.initials ? 'Initials' : 'Emblem'}
                  icon={progress.team.initials ? 'flag' : 'stars'}
                  type="capUpper"
                  radius={R.pill}
                  color={C.text}
                  bg={C.surface3}
                  style={styles.chipPad}
                />
              </Pressable>
            </View>

            <Btn kind="dark" icon="autorenew" label="GENERATE CREST" height={48} onPress={generateCrest} />
            <Txt v="cap" color={C.textDim}>
              Kit colour and emblem come from the rewards below; more unlock as you level up.
            </Txt>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.gap12}>
          <SectionTitle icon="leaderboard" iconColor={C.green} title="Statistics" />
          <View style={styles.grid}>
            {tiles.map((t) => (
              <View key={t.label} style={styles.tile}>
                <Txt v="capUpper" color={C.textMuted}>
                  {t.label}
                </Txt>
                <Txt v="h24">{t.value}</Txt>
                {t.sub ? (
                  <Txt v="cap" color={C.textDim}>
                    {t.sub}
                  </Txt>
                ) : null}
              </View>
            ))}
          </View>
          <View style={styles.wideTile}>
            <Icon name="grid_view" size={18} color={C.blueLight} />
            <View style={styles.flex}>
              <Txt v="capUpper" color={C.textMuted}>
                Favourite formation
              </Txt>
              <Txt v="h16">{favFormation ? favFormation.name : '–'}</Txt>
            </View>
            {favFormation && (
              <Txt v="cap" color={C.textDim}>
                {favFormation.n}×
              </Txt>
            )}
          </View>
          <View style={styles.wideTile}>
            <Icon name="person" size={18} color={C.gold} />
            <View style={styles.flex}>
              <Txt v="capUpper" color={C.textMuted}>
                Most drafted player
              </Txt>
              <Txt v="h16">{favPlayer ? favPlayer.name : '–'}</Txt>
            </View>
            {favPlayer && (
              <Txt v="cap" color={C.textDim}>
                {favPlayer.n}×
              </Txt>
            )}
          </View>
        </View>

        {/* Achievements */}
        <View style={styles.gap12}>
          <SectionTitle
            icon="emoji_events"
            title="Achievements"
            right={`${unlockedCount}/${ACHIEVEMENTS.length}`}
          />
          {ACHIEVEMENTS.map((a) => {
            const at = progress.achievements[a.id];
            return (
              <View key={a.id} style={[styles.achievement, !at && styles.locked]}>
                <View style={[styles.achIcon, { backgroundColor: at ? alpha(C.gold, 0.15) : C.surface3 }]}>
                  <Icon name={at ? a.icon : 'lock'} size={20} color={at ? C.gold : C.textDim} />
                </View>
                <View style={styles.flex}>
                  <Txt v="h14">{a.title}</Txt>
                  <Txt v="body" color={C.textMuted}>
                    {a.description}
                  </Txt>
                </View>
                {at ? (
                  <Txt v="cap" color={C.green}>
                    {fmtDate(at)}
                  </Txt>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Rewards */}
        <View style={styles.gap12}>
          <SectionTitle icon="military_tech" iconColor={C.blueLight} title="Kits" right="Unlocked by level" />
          <View style={styles.swatches}>
            {kits.map((k) => {
              const open = k.open;
              const active = progress.kit === k.id;
              return (
                <Pressable
                  key={k.id}
                  onPress={() => equip('kit', k.id, owned)}
                  disabled={!open}
                  accessibilityRole="button"
                  accessibilityLabel={open ? `Kit ${k.name}` : `Kit ${k.name}, unlocks at level ${k.level}`}
                  accessibilityState={{ selected: active, disabled: !open }}
                  style={styles.swatchWrap}>
                  <View style={[styles.swatch, { backgroundColor: k.color }, active && styles.swatchActive]}>
                    {!open && <Icon name="lock" size={14} color={C.text} />}
                  </View>
                  <Txt v="cap" color={open ? C.text : C.textDim} numberOfLines={1}>
                    {open ? k.name : k.lockLabel}
                  </Txt>
                </Pressable>
              );
            })}
          </View>

          <SectionTitle icon="shield" iconColor={C.blueLight} title="Crests" />
          <View style={styles.swatches}>
            {crests.map((c) => {
              const open = c.open;
              const active = progress.crest === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => equip('crest', c.id, owned)}
                  disabled={!open}
                  accessibilityRole="button"
                  accessibilityLabel={open ? `Crest ${c.name}` : `Crest ${c.name}, unlocks at level ${c.level}`}
                  accessibilityState={{ selected: active, disabled: !open }}
                  style={styles.swatchWrap}>
                  <View style={[styles.swatch, styles.crestSwatch, active && styles.swatchActive]}>
                    <Icon name={open ? c.icon : 'lock'} size={20} color={open ? C.gold : C.textDim} />
                  </View>
                  <Txt v="cap" color={open ? C.text : C.textDim} numberOfLines={1}>
                    {open ? c.name : c.lockLabel}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Account backup */}
        <View style={styles.gap12}>
          <SectionTitle icon="verified" iconColor={C.green} title="Account backup" />
          <View style={styles.clubCard}>
            <Txt v="body" color={C.textMuted}>
              Your account (@{user?.username ?? '…'}, coins, saved squads) is tied to a secret code. Keep it
              somewhere safe to restore the account on a new phone. Never share it with anyone.
            </Txt>
            {showCode && user ? (
              <Txt v="bodyBold" selectable style={styles.code}>
                {user.userId}
              </Txt>
            ) : null}
            <View style={styles.chips}>
              <Btn kind="dark" label={showCode ? 'HIDE CODE' : 'SHOW CODE'} height={40} labelType="capUpper" onPress={() => setShowCode((x) => !x)} />
              {showCode && user && (
                <Btn
                  kind="dark"
                  icon="share"
                  label="SAVE"
                  height={40}
                  labelType="capUpper"
                  onPress={() => shareText(`Champion account backup code (keep it secret): ${user.userId}`)}
                />
              )}
            </View>
            <TextInput
              value={restore}
              onChangeText={setRestore}
              placeholder="Restore: paste a backup code"
              placeholderTextColor={C.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              accessibilityLabel="Backup code to restore"
            />
            <Btn
              kind="blue"
              label="RESTORE ACCOUNT"
              height={44}
              disabled={restore.trim().length < 36}
              onPress={async () => {
                const ok = await restoreUser(restore);
                setRestoreNote(ok ? 'Account restored.' : 'Unknown code (or offline).');
                if (ok) {
                  setRestore('');
                  await refreshWallet();
                }
              }}
            />
            {restoreNote && (
              <Txt v="cap" color={restoreNote === 'Account restored.' ? C.green : C.red}>
                {restoreNote}
              </Txt>
            )}
          </View>
        </View>
      </ScrollView>
      {showShop && <Shop onClose={() => setShowShop(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 16, gap: 24 },
  flex: { flex: 1 },
  gap12: { gap: 12 },
  row12: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alignEnd: { alignItems: 'flex-end' },
  levelCard: {
    overflow: 'hidden',
    gap: 12,
    padding: 20,
    borderRadius: R.xl,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: alpha(C.green, 0.2),
    boxShadow: SHADOW_SM,
  },
  gap8: { gap: 8 },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coinsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: R.xl,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: alpha(C.gold, 0.35),
  },
  code: { padding: 10, borderRadius: R.md, backgroundColor: C.surface3, fontFamily: 'Courier' },
  clubCard: { gap: 12, padding: 16, borderRadius: R.xl, backgroundColor: C.surface },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: R.md,
    backgroundColor: C.surface3,
    color: C.text,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipPad: { paddingHorizontal: 12, paddingVertical: 6 },
  trim: { width: 32, height: 32, borderRadius: R.pill, borderWidth: 2, borderColor: C.surface4 },
  xpTrack: { height: 10, borderRadius: R.pill, backgroundColor: C.surface3, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: R.pill, backgroundColor: C.green },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: '47%',
    gap: 2,
    padding: 14,
    borderRadius: R.lg,
    backgroundColor: C.surface,
  },
  wideTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: R.lg,
    backgroundColor: C.surface,
  },
  achievement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: R.lg,
    backgroundColor: C.surface,
  },
  locked: { opacity: 0.55 },
  achIcon: { width: 40, height: 40, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatchWrap: { width: 64, alignItems: 'center', gap: 4 },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  crestSwatch: { backgroundColor: C.surface3 },
  swatchActive: { borderColor: C.green },
});
