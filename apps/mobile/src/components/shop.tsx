import {
  ADS_PER_DAY,
  AD_COINS,
  CARD_FRAMES,
  CLUB_DAILY_COINS,
  CLUB_SUBSCRIPTION,
  COIN_PACKS,
  EARNED_COSMETICS,
  INVITE_COINS,
  LOGIN_CYCLE,
  PASS_PREMIUM_TOTAL,
  PASS_TIERS,
  PASS_XP_PER_TIER,
  SEASON_PASS_PRODUCT,
  STARTER_PACK,
  STORE_ITEMS,
  eurPerCoin,
  isConsumable,
  passReward,
  type StoreItem,
} from '@champion/shared';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn, Chip, SHADOW_LG } from '@/design/ui';
import { equip, equipCosmetic, pushToast, useProgress } from '@/game/progress';
import { shareText } from '@/game/share';
import { useAds, watchRewardedAd } from '@/game/ads';
import {
  buy,
  changeUsername,
  claim,
  devPurchase,
  redeemInvite,
  refreshWallet,
  requestId,
  useWallet,
} from '@/game/wallet';

type Tab = 'store' | 'coins' | 'pass' | 'free';
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'store', label: 'Store', icon: 'shopping_bag' },
  { id: 'coins', label: 'Coins', icon: 'toll' },
  { id: 'pass', label: 'Pass', icon: 'workspace_premium' },
  { id: 'free', label: 'Free', icon: 'card_giftcard' },
];

// Test mode: until real payments (RevenueCat, store build) and an ad network are connected, every
// build offers simulated purchases and rewarded ads – nothing is charged. The server credits them
// in development, or in production only with PURCHASES_SIMULATED=1 / ADS_SIMULATED=1 set there.
// Set EXPO_PUBLIC_PURCHASES_LIVE=1 / EXPO_PUBLIC_ADS_LIVE=1 once the real ones are connected.
const PURCHASES_SIMULATED = process.env.EXPO_PUBLIC_PURCHASES_LIVE !== '1';
const ADS_SIMULATED = process.env.EXPO_PUBLIC_ADS_LIVE !== '1';

const AD_SECONDS = 5;

const eur = (x: number) => `€${x.toFixed(2)}`;
const coinValue = (coins: number) => `≈ ${eur(coins * eurPerCoin)}`;

/** Coin shop: store items, coin packs, Season Pass and free coins. */
export function Shop({ onClose, initialTab = 'store' }: { onClose: () => void; initialTab?: Tab }) {
  const insets = useSafeAreaInsets();
  const { wallet, status } = useWallet();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void refreshWallet();
  }, []);

  const run = async (id: string, work: () => Promise<{ ok: boolean; reason?: string }>, done?: string) => {
    setBusy(id);
    const r = await work();
    setBusy(null);
    if (!r.ok && r.reason) pushToast({ icon: 'info', title: 'Not done', detail: r.reason, tone: 'level' });
    else if (r.ok && done) pushToast({ icon: 'check_circle', title: done, detail: '', tone: 'coin' });
  };

  return (
    <View style={styles.backdrop}>
      <View style={[styles.sheet, { marginTop: insets.top + 16, marginBottom: insets.bottom + 12 }]}>
        <View style={styles.header}>
          <View style={styles.row8}>
            <Icon name="toll" size={22} color={C.gold} />
            <Txt v="h24">{wallet ? wallet.balance.toLocaleString('en-US') : status === 'offline' ? '–' : '…'}</Txt>
            {wallet && (
              <Txt v="cap" color={C.textDim}>
                {coinValue(wallet.balance)}
              </Txt>
            )}
          </View>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close shop" style={styles.close}>
            <Icon name="close" size={18} color={C.text} />
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.id }}
              style={[styles.tab, tab === t.id && styles.tabActive]}>
              <Icon name={t.icon} size={16} color={tab === t.id ? C.green : C.textMuted} />
              <Txt v="capUpper" color={tab === t.id ? C.green : C.textMuted}>
                {t.label}
              </Txt>
            </Pressable>
          ))}
        </View>

        {status === 'offline' && !wallet ? (
          <Txt v="body" color={C.red} style={styles.pad}>
            The shop needs a connection to the server.
          </Txt>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {tab === 'store' && <StoreTab busy={busy} run={run} />}
            {tab === 'coins' && <CoinsTab busy={busy} run={run} />}
            {tab === 'pass' && <PassTab busy={busy} run={run} />}
            {tab === 'free' && <FreeTab busy={busy} run={run} />}
            <Txt v="capBody" color={C.textDim}>
              Coins never buy a player or a rating. Draft boosts only make the club reel land more often on clubs
              with top-rated players; the Daily Challenge stays the same for everyone.
            </Txt>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

type Run = (id: string, work: () => Promise<{ ok: boolean; reason?: string }>, done?: string) => Promise<void>;
type TabProps = { busy: string | null; run: Run };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Txt v="h14">{title.toUpperCase()}</Txt>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------

function slotOf(item: StoreItem): 'frame' | 'pitch' | 'reel' | 'celebration' | 'kit' | 'crest' | null {
  switch (item.effect.kind) {
    case 'celebration':
      return 'celebration';
    case 'card-frame':
      return 'frame';
    case 'pitch-skin':
      return 'pitch';
    case 'reel-skin':
      return 'reel';
    case 'kit':
      return 'kit';
    case 'crest':
      return 'crest';
    default:
      return null;
  }
}

function StoreTab({ busy, run }: TabProps) {
  const { wallet } = useWallet();
  const progress = useProgress();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const owned = wallet?.owned ?? [];
  // Frames from the starter pack, the Season Pass and prestige.
  const earnedFrames = [
    ...EARNED_COSMETICS.filter((id) => id.startsWith('frame-') && owned.includes(id)),
    ...(progress.prestige > 0 ? ['frame-prestige'] : []),
  ];
  const cosmetics = STORE_ITEMS.filter((i) => !isConsumable(i) && i.effect.kind !== 'unlock-legend-tier');
  const convenience = STORE_ITEMS.filter(
    (i) => (isConsumable(i) || i.effect.kind === 'unlock-legend-tier') && i.effect.kind !== 'draft-boost',
  );
  const boosts = STORE_ITEMS.filter((i) => i.effect.kind === 'draft-boost');

  const equipped = (item: StoreItem) => {
    const slot = slotOf(item);
    if (slot === 'kit') return progress.kit === item.id;
    if (slot === 'crest') return progress.crest === item.id;
    return slot ? progress.equipped[slot] === item.id : false;
  };
  const toggleEquip = (item: StoreItem) => {
    const slot = slotOf(item);
    if (slot === 'kit' || slot === 'crest') equip(slot, item.id, owned);
    else if (slot) equipCosmetic(slot, equipped(item) ? null : item.id);
  };

  const row = (item: StoreItem) => {
    const soon = item.available === false;
    const own = owned.includes(item.id);
    const count = wallet?.consumables[item.id] ?? 0;
    const frame = item.effect.kind === 'card-frame' ? CARD_FRAMES[item.effect.frameId] : null;
    return (
      <View key={item.id} style={[styles.item, soon && styles.dim]}>
        {frame ? (
          <View style={[styles.frameSwatch, { borderColor: frame.colors[0], backgroundColor: alpha(frame.colors[1], 0.25) }]} />
        ) : null}
        <View style={styles.flex}>
          <Txt v="bodyBold">{item.name}</Txt>
          <Txt v="cap" color={C.textMuted}>
            {soon ? 'Coming soon' : `${item.price} coins · ${coinValue(item.price)}`}
            {count > 0 ? ` · you have ${count}` : ''}
          </Txt>
        </View>
        {soon ? (
          <Chip label="SOON" color={C.textMuted} bg={C.surface3} type="capUpper" radius={R.pill} />
        ) : item.effect.kind === 'rename' ? (
          <Btn kind="dark" label="RENAME" height={36} labelType="capUpper" onPress={() => setRenaming((x) => !x)} />
        ) : own && slotOf(item) ? (
          <Btn
            kind={equipped(item) ? 'green' : 'dark'}
            label={equipped(item) ? 'EQUIPPED' : 'EQUIP'}
            height={36}
            labelType="capUpper"
            onPress={() => toggleEquip(item)}
          />
        ) : (
          <Btn
            kind="gold"
            label={busy === item.id ? '…' : `${item.price}`}
            icon="toll"
            height={36}
            labelType="capUpper"
            disabled={busy !== null || (wallet?.balance ?? 0) < item.price}
            accessibilityLabel={`Buy ${item.name} for ${item.price} coins`}
            onPress={() => run(item.id, () => buy(item.id), `${item.name} bought`)}
          />
        )}
      </View>
    );
  };

  return (
    <>
      <Section title="Cosmetics">
        {cosmetics.map(row)}
        {renaming && (
          <View style={styles.renameBox}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={wallet?.username ?? 'New username'}
              placeholderTextColor={C.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              style={styles.input}
              accessibilityLabel="New username"
            />
            <Btn
              kind="gold"
              label="CHANGE · 200"
              height={40}
              labelType="capUpper"
              disabled={busy !== null || name.length < 3}
              onPress={() => run('rename', () => changeUsername(name), `You are now @${name}`).then(() => setRenaming(false))}
            />
          </View>
        )}
      </Section>
      {earnedFrames.length > 0 && (
        <Section title="Earned frames">
          {earnedFrames.map((id) => {
            const f = CARD_FRAMES[id.replace(/^frame-/, '')]!;
            const on = progress.equipped.frame === id;
            return (
              <View key={id} style={styles.item}>
                <View style={[styles.frameSwatch, { borderColor: f.colors[0], backgroundColor: alpha(f.colors[1], 0.25) }]} />
                <View style={styles.flex}>
                  <Txt v="bodyBold">{f.name} share-card frame</Txt>
                  <Txt v="cap" color={C.textMuted}>
                    Earned, not sold
                  </Txt>
                </View>
                <Btn
                  kind={on ? 'green' : 'dark'}
                  label={on ? 'EQUIPPED' : 'EQUIP'}
                  height={36}
                  labelType="capUpper"
                  onPress={() => equipCosmetic('frame', on ? null : id)}
                />
              </View>
            );
          })}
        </Section>
      )}
      <Section title="Convenience · casual games only">{convenience.map(row)}</Section>
      <Section title="Draft boosts · one draft each">
        {boosts.map(row)}
        <Txt v="cap" color={C.textDim}>
          Use one from the draft settings (tune button). The club reel then lands more often on clubs with 80+ (Star)
          or 90+ (Legend) rated players in the spun decade – about 2–4× as often, never guaranteed. You still pick
          from the club&apos;s real squad. Not in the Daily Challenge.
        </Txt>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------------------------

function CoinsTab({ busy, run }: TabProps) {
  const { wallet } = useWallet();
  const clubActive = !!wallet?.entitlements.clubUntil && new Date(wallet.entitlements.clubUntil) > new Date();
  const buyProduct = (id: string, label: string) =>
    PURCHASES_SIMULATED ? run(id, () => devPurchase(id), `${label} (simulated purchase)`) : Promise.resolve();

  return (
    <>
      {!PURCHASES_SIMULATED && (
        <Txt v="body" color={C.gold}>
          In-app purchases are coming soon.
        </Txt>
      )}
      {PURCHASES_SIMULATED && (
        <Txt v="cap" color={C.textDim}>
          Test mode: purchases are simulated – no money is charged.
        </Txt>
      )}

      {!wallet?.entitlements.starterPack && (
        <View style={[styles.item, styles.highlight]}>
          <Icon name="stars" size={22} color={C.gold} />
          <View style={styles.flex}>
            <Txt v="bodyBold">Starter pack</Txt>
            <Txt v="cap" color={C.textMuted}>
              {STARTER_PACK.coins} coins + exclusive Starter card frame · once only
            </Txt>
          </View>
          <Btn
            kind="gold"
            label={eur(STARTER_PACK.eur)}
            height={36}
            labelType="capUpper"
            disabled={!PURCHASES_SIMULATED || busy !== null}
            onPress={() => buyProduct(STARTER_PACK.id, 'Starter pack')}
          />
        </View>
      )}

      <Section title="Coin packs">
        {COIN_PACKS.map((p) => (
          <View key={p.id} style={styles.item}>
            <Icon name="toll" size={20} color={C.gold} />
            <View style={styles.flex}>
              <Txt v="bodyBold">
                {p.coins.toLocaleString('en-US')} coins
                {p.id === 'coins-1200' ? '  ⭐ most popular' : ''}
              </Txt>
              <Txt v="cap" color={C.textMuted}>
                {p.bonus ? `+${p.bonus}% bonus` : 'Starter size'}
              </Txt>
            </View>
            <Btn
              kind="dark"
              label={eur(p.eur)}
              height={36}
              labelType="capUpper"
              disabled={!PURCHASES_SIMULATED || busy !== null}
              onPress={() => buyProduct(p.id, `${p.coins} coins`)}
            />
          </View>
        ))}
      </Section>

      <Section title="Spinvincible Club">
        <View style={[styles.item, clubActive && styles.highlight]}>
          <Icon name="crown" size={20} color={C.gold} />
          <View style={styles.flex}>
            <Txt v="bodyBold">{clubActive ? 'Member' : `${eur(CLUB_SUBSCRIPTION.eurPerMonth)} / month`}</Txt>
            <Txt v="cap" color={C.textMuted}>
              {CLUB_DAILY_COINS} coins every day, no ads, a monthly exclusive frame
              {clubActive ? ` · until ${new Date(wallet!.entitlements.clubUntil!).toLocaleDateString('en-GB')}` : ''}
            </Txt>
          </View>
          {!clubActive && (
            <Btn
              kind="blue"
              label="JOIN"
              height={36}
              labelType="capUpper"
              disabled={!PURCHASES_SIMULATED || busy !== null}
              onPress={() => buyProduct(CLUB_SUBSCRIPTION.id, 'Spinvincible Club')}
            />
          )}
        </View>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------------------------

function PassTab({ busy, run }: TabProps) {
  const { wallet } = useWallet();
  const progress = useProgress();
  const seasonXp = progress.season.id === wallet?.season ? progress.season.xp : 0;
  const reached = Math.min(PASS_TIERS, Math.floor(seasonXp / PASS_XP_PER_TIER));
  const premium = wallet?.entitlements.seasonPass === wallet?.season;
  const claimed = wallet?.passClaimed ?? { free: [], premium: [] };

  return (
    <>
      <View style={styles.passHead}>
        <Txt v="h20">Season {wallet?.season ?? ''}</Txt>
        <Txt v="body" color={C.textMuted}>
          Tier {reached}/{PASS_TIERS} · {seasonXp.toLocaleString('en-US')} season XP (resets monthly)
        </Txt>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(Math.min(seasonXp, PASS_TIERS * PASS_XP_PER_TIER) / (PASS_TIERS * PASS_XP_PER_TIER)) * 100}%` }]} />
        </View>
        {!premium && (
          <Btn
            kind="gold"
            icon="workspace_premium"
            label={`PREMIUM PASS · ${eur(SEASON_PASS_PRODUCT.eur)}`}
            sub={`${PASS_PREMIUM_TOTAL} coins + 3 exclusive cosmetics over the season`}
            disabled={!PURCHASES_SIMULATED || busy !== null}
            onPress={() => run('pass', () => devPurchase(SEASON_PASS_PRODUCT.id), 'Premium Pass (simulated)')}
          />
        )}
      </View>

      {Array.from({ length: PASS_TIERS }, (_, i) => i + 1).map((tier) => {
        const free = passReward(tier, 'free');
        const prem = passReward(tier, 'premium')!;
        const open = tier <= reached;
        const cell = (track: 'free' | 'premium') => {
          const reward = track === 'free' ? free : prem;
          if (!reward) return <View style={styles.flex} />;
          const done = claimed[track].includes(tier);
          const locked = !open || (track === 'premium' && !premium);
          return (
            <Pressable
              onPress={() => run(`p${tier}${track}`, async () => ({ ok: (await claim('season-pass', `${tier}:${track}`, `Season Pass tier ${tier}`)) > 0 }))}
              disabled={done || locked || busy !== null}
              accessibilityRole="button"
              accessibilityLabel={`${track} reward tier ${tier}: ${reward.coins} coins${reward.cosmetic ? ' and a cosmetic' : ''}`}
              style={[styles.reward, track === 'premium' && styles.rewardPremium, (locked || done) && styles.dim]}>
              <Icon name={done ? 'check_circle' : locked ? 'lock' : 'toll'} size={14} color={done ? C.green : C.gold} />
              <Txt v="cap" color={C.text}>
                {reward.coins}
                {reward.cosmetic ? ' + ★' : ''}
              </Txt>
            </Pressable>
          );
        };
        return (
          <View key={tier} style={styles.tierRow}>
            <Txt v="num13" color={open ? C.green : C.textDim} style={styles.tierNum}>
              {tier}
            </Txt>
            {cell('free')}
            {cell('premium')}
          </View>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------------------------

function FreeTab({ busy, run }: TabProps) {
  const { wallet } = useWallet();
  const [code, setCode] = useState('');
  const [ad, setAd] = useState<number | null>(null);
  const ads = useAds();
  const [adBusy, setAdBusy] = useState(false);
  const [adNote, setAdNote] = useState<string | null>(null);
  const adTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => {
    if (adTimer.current) clearInterval(adTimer.current);
  }, []);

  // Simulated rewarded ad: a 5-second countdown, then the server pays (development only).
  const watchAd = () => {
    const started = Date.now();
    setAd(AD_SECONDS);
    adTimer.current = setInterval(() => {
      const left = AD_SECONDS - Math.floor((Date.now() - started) / 1000);
      if (left > 0) return setAd(left);
      clearInterval(adTimer.current!);
      adTimer.current = null;
      setAd(null);
      void claim('rewarded-ad', requestId(), 'Thanks for watching');
    }, 250);
  };

  // Real rewarded ad (AdMob) when the SDK is in this build; the simulated one otherwise.
  const watchRealAd = async () => {
    setAdBusy(true);
    setAdNote(null);
    const r = await watchRewardedAd();
    setAdBusy(false);
    setAdNote(
      r === 'earned'
        ? ads.live
          ? 'Thanks for watching – your coins arrive in a few seconds.'
          : null
        : r === 'closed'
          ? 'Closed early – watch to the end for the coins.'
          : r === 'limit'
            ? "That's all the videos for today."
            : 'No video available right now. Try again later.',
    );
  };

  if (!wallet) return null;
  const day = wallet.login.claimedToday ? wallet.login.streakDay : 0;

  return (
    <>
      <Section title="Daily login">
        <View style={styles.loginRow}>
          {LOGIN_CYCLE.map((coins, i) => (
            <View key={i} style={[styles.loginDay, i < day && styles.loginDone, i === day - 1 && styles.loginToday]}>
              <Txt v="tinyBold" color={C.textMuted}>
                D{i + 1}
              </Txt>
              <Txt v="num13" color={i < day ? C.green : C.text}>
                {coins}
              </Txt>
            </View>
          ))}
        </View>
        <Txt v="cap" color={C.textMuted}>
          {wallet.login.claimedToday
            ? `Collected today. Tomorrow: ${wallet.login.nextCoins} coins – miss a day and the week starts again.`
            : 'Collected automatically when you open the app.'}
        </Txt>
      </Section>

      <Section title="Watch & earn">
        <View style={styles.item}>
          <Icon name="play_circle" size={22} color={C.blueLight} />
          <View style={styles.flex}>
            <Txt v="bodyBold">
              {AD_COINS} coins per video · {wallet.adsToday}/{ADS_PER_DAY} today
            </Txt>
            <Txt v="cap" color={C.textMuted}>
              {adNote ??
                (ads.available
                  ? ads.live
                    ? 'A short video – the coins come right after'
                    : 'Test ads (no real advertiser)'
                  : ADS_SIMULATED
                    ? 'Test mode: a simulated 5-second ad'
                    : 'Coming soon')}
            </Txt>
          </View>
          <Btn
            kind="blue"
            label={ad !== null ? `${ad}s` : adBusy ? 'LOADING…' : 'WATCH'}
            height={36}
            labelType="capUpper"
            disabled={
              (!ads.available && !ADS_SIMULATED) || ad !== null || adBusy || wallet.adsToday >= ADS_PER_DAY
            }
            onPress={ads.available ? watchRealAd : watchAd}
          />
        </View>
      </Section>

      <Section title="Invite friends">
        <View style={styles.item}>
          <Icon name="card_giftcard" size={22} color={C.gold} />
          <View style={styles.flex}>
            <Txt v="bodyBold">Your code: {wallet.inviteCode}</Txt>
            <Txt v="cap" color={C.textMuted}>
              A new player enters it: {INVITE_COINS} coins for both of you.
            </Txt>
          </View>
          <Btn
            kind="dark"
            icon="share"
            label="SEND"
            height={36}
            labelType="capUpper"
            onPress={() =>
              shareText(
                `⚽ Draft an all-time XI with me in Spinvincible! Enter my invite code ${wallet.inviteCode} and we both get ${INVITE_COINS} coins.`,
              )
            }
          />
        </View>
        {!wallet.invited && (
          <View style={styles.renameBox}>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="Friend's code"
              placeholderTextColor={C.textDim}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={styles.input}
              accessibilityLabel="Friend's invite code"
            />
            <Btn
              kind="gold"
              label="REDEEM"
              height={40}
              labelType="capUpper"
              disabled={busy !== null || code.length !== 6}
              onPress={() => run('invite', () => redeemInvite(code))}
            />
          </View>
        )}
      </Section>

      <Section title="More free coins">
        <Txt v="body" color={C.textMuted}>
          Daily Challenge wins (30–100), legends collected (50–150), head-to-head wins (20), level-ups (50 × level),
          achievements (25–500) and sharing your squad once a day (15).
        </Txt>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 60, paddingHorizontal: 12, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { flex: 1, borderRadius: R.xl, backgroundColor: C.surface, boxShadow: SHADOW_LG, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  close: { width: 32, height: 32, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface3 },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 12 },
  tab: { flex: 1, height: 40, borderRadius: R.pill, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: C.surface3 },
  content: { padding: 16, gap: 16 },
  pad: { padding: 16 },
  flex: { flex: 1 },
  section: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: R.lg, backgroundColor: C.surface2 },
  highlight: { borderWidth: 1, borderColor: alpha(C.gold, 0.5) },
  dim: { opacity: 0.5 },
  frameSwatch: { width: 28, height: 36, borderRadius: R.sm, borderWidth: 3 },
  renameBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, height: 40, paddingHorizontal: 12, borderRadius: R.md, backgroundColor: C.surface3, color: C.text, fontSize: 15 },
  passHead: { gap: 8 },
  track: { height: 8, borderRadius: R.pill, backgroundColor: C.surface3, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: C.green },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierNum: { width: 24, textAlign: 'center' },
  reward: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: R.md, backgroundColor: C.surface2 },
  rewardPremium: { backgroundColor: alpha(C.goldDeep, 0.15) },
  loginRow: { flexDirection: 'row', gap: 6 },
  loginDay: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: R.md, backgroundColor: C.surface2 },
  loginDone: { backgroundColor: alpha(C.green, 0.15) },
  loginToday: { borderWidth: 1, borderColor: C.green },
});
