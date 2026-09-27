/**
 * Coin store: what coins can buy – cosmetics, convenience, and draft boosts. Coins never buy a
 * player, a player card, a rating or chemistry directly, and real people are never a product: no
 * item may name, contain or unlock a real player or club.
 *
 * Exception decided by the owner (2026-09-27): draft boosts (`DraftBoostEffect`) make the club reel
 * land more often on clubs that have 80+ / 90+ rated players in the spun decade. The draw stays
 * random and the player still picks from the real squad; the odds are published (DRAFT_BOOSTS).
 *
 * Enforced by:
 *  1. Types: `StoreEffect` has no variant that grants a player, a rating or a match advantage.
 *  2. `validateStoreItem` rejects anything else (used by the catalog test and the admin/server).
 *  3. `BOOSTS_ALLOWED` says where a boost may be used (not in the Daily: everyone gets the same reels).
 */

/** Cosmetic: changes how things look, never how they play. */
export type CosmeticEffect =
  | { kind: 'card-frame'; frameId: string }
  | { kind: 'kit'; kitId: string }
  | { kind: 'crest'; crestId: string }
  | { kind: 'pitch-skin'; skinId: string }
  | { kind: 'reel-skin'; skinId: string }
  | { kind: 'celebration'; animationId: string }
  | { kind: 'sound-pack'; packId: string }
  | { kind: 'rename' };

/**
 * Convenience: more tries or more choice in the casual game – never a better player. A re-spin
 * still draws a random decade/league/club; a scout shows two random clubs instead of one.
 */
export type ConvenienceEffect =
  | { kind: 'respin'; count: number }
  | { kind: 'reel-lock' }
  | { kind: 'scout' }
  | { kind: 'second-chance' }
  | { kind: 'daily-practice' }
  | { kind: 'unlock-legend-tier'; tier: 1 | 2 | 3 };

/**
 * Draft boost: for one draft, the club reel lands more often on clubs with top-rated players in the
 * spun decade (weights in DRAFT_BOOSTS). Never a guaranteed player.
 */
export type DraftBoostEffect = { kind: 'draft-boost'; boost: DraftBoostId };
export type DraftBoostId = 'star' | 'legend';

/**
 * Club reel weights per boost, by the best player rating a club has in the spun decade. A club
 * without such players keeps weight 1, so every club can still come up.
 */
export const DRAFT_BOOSTS: Record<DraftBoostId, { itemId: string; name: string; minRating: number; weights: { atLeast: number; weight: number }[] }> = {
  star: { itemId: 'boost-star', name: 'Star boost', minRating: 80, weights: [{ atLeast: 80, weight: 4 }] },
  legend: {
    itemId: 'boost-legend',
    name: 'Legend boost',
    minRating: 90,
    weights: [
      { atLeast: 90, weight: 8 },
      { atLeast: 80, weight: 3 },
    ],
  },
};

/** A club's weight on the club reel under a boost (1 = normal). */
export function boostWeight(boost: DraftBoostId | null | undefined, top: number | null | undefined): number {
  if (!boost || top === null || top === undefined) return 1;
  return DRAFT_BOOSTS[boost].weights.find((w) => top >= w.atLeast)?.weight ?? 1;
}

export type StoreEffect = CosmeticEffect | ConvenienceEffect | DraftBoostEffect;

export type StoreItem = {
  id: string;
  name: string;
  /** Price in coins (coins are earned in the game or bought; see COIN_PACKS). */
  price: number;
  effect: StoreEffect;
  /**
   * false = shown as "coming soon" and not for sale: an item is only sold once the game actually
   * does what it promises.
   */
  available?: boolean;
};

/** Consumables are used up (convenience); everything else is owned for good (cosmetics). */
export const isConsumable = (item: StoreItem) =>
  item.effect.kind === 'draft-boost' ||
  (item.effect.kind !== 'unlock-legend-tier' && (CONVENIENCE_KINDS as readonly string[]).includes(item.effect.kind));

/** Kits and crests sold in the store (on top of the ones unlocked by level). */
export const STORE_KITS = [
  { id: 'kit-violet', name: 'Violet', color: '#4b2a86' },
  { id: 'kit-tangerine', name: 'Tangerine', color: '#b4531b' },
  { id: 'kit-teal', name: 'Teal', color: '#0f6b6b' },
  { id: 'kit-season', name: 'Season Gold', color: '#6e5a12' },
  // Level milestones (earned)
  { id: 'kit-emerald', name: 'Emerald', color: '#0b6e4f' },
  { id: 'kit-obsidian', name: 'Obsidian', color: '#1b1b24' },
  { id: 'kit-royal', name: 'Royal', color: '#3a1f6e' },
] as const;
export const STORE_CRESTS = [
  { id: 'crest-swords', name: 'Swords', icon: 'swords' },
  { id: 'crest-stadium', name: 'Stadium', icon: 'stadium' },
  { id: 'crest-drop', name: 'Drop', icon: 'water_drop' },
  { id: 'crest-season', name: 'Season Laurel', icon: 'kid_star' },
  // Level milestones (earned)
  { id: 'crest-trophy', name: 'Trophy', icon: 'emoji_events' },
  { id: 'crest-comet', name: 'Comet', icon: 'auto_awesome' },
  { id: 'crest-medal', name: 'Medal', icon: 'military_tech' },
] as const;

/** Share-card frames: border colours of the squad card image. */
export const CARD_FRAMES: Record<string, { name: string; colors: [string, string] }> = {
  retro: { name: 'Retro', colors: ['#c8553d', '#f2d0a4'] },
  gold: { name: 'Gold', colors: ['#e0ac00', '#ffdf99'] },
  neon: { name: 'Neon', colors: ['#00f5d4', '#f15bb5'] },
  starter: { name: 'Starter', colors: ['#3093f8', '#a4c9ff'] },
  season: { name: 'Season', colors: ['#30a46c', '#ffc72c'] },
  prestige: { name: 'Prestige', colors: ['#dce3f1', '#879489'] },
  bronze: { name: 'Bronze', colors: ['#a0612b', '#e3b58a'] },
  silver: { name: 'Silver', colors: ['#9aa5b1', '#e6ebf0'] },
  platinum: { name: 'Platinum', colors: ['#7fd1c7', '#e8fffb'] },
  champion: { name: 'Champion', colors: ['#ffc72c', '#30a46c'] },
  club: { name: 'Champion Club', colors: ['#3093f8', '#ffc72c'] },
  legend: { name: 'H2H Legend', colors: ['#ff3b5c', '#ffc72c'] },
};

/** Cosmetics earned, never sold (starter pack, Season Pass, prestige). */
export const EARNED_COSMETICS = [
  'frame-starter',
  'frame-season',
  'kit-season',
  'crest-season',
  'frame-prestige',
  'frame-bronze',
  'frame-silver',
  'frame-platinum',
  'frame-champion',
  'kit-emerald',
  'kit-obsidian',
  'kit-royal',
  'crest-trophy',
  'crest-comet',
  'crest-medal',
  'frame-club',
  'frame-legend',
] as const;

/** Modes where a convenience boost may be used. Competitive modes stay equal for everyone. */
export const BOOSTS_ALLOWED = {
  casualDraft: true,
  match: true,
  league: true,
  cup: true,
  legends: true,
  // Everyone gets the same seeded reels in the Daily, so no boost there.
  dailyChallenge: false,
  // A casual squad (boosted or not) can play head-to-head and be saved on the leaderboard.
  headToHead: true,
  leaderboard: true,
} as const;

const COSMETIC_KINDS: readonly CosmeticEffect['kind'][] = [
  'card-frame',
  'kit',
  'crest',
  'pitch-skin',
  'reel-skin',
  'celebration',
  'sound-pack',
  'rename',
];
const CONVENIENCE_KINDS: readonly ConvenienceEffect['kind'][] = [
  'respin',
  'reel-lock',
  'scout',
  'second-chance',
  'daily-practice',
  'unlock-legend-tier',
];

/** Words that point at a player, a rating or a result – never allowed in a store item. */
const FORBIDDEN = /\b(player|rating|ovr|overall|chem(istry)?|boost(ed)? xi|win|guaranteed|pack of players|card of)\b/i;

/** Problems with a store item (empty = fine). Rejects anything that isn't cosmetic or convenience. */
export function validateStoreItem(item: unknown): string[] {
  const x = item as Partial<StoreItem> | null;
  if (!x || typeof x !== 'object') return ['not an object'];
  const problems: string[] = [];
  if (!x.id || !/^[a-z0-9-]+$/.test(x.id)) problems.push('id: lowercase-with-dashes');
  if (!x.name) problems.push('name missing');
  if (typeof x.price !== 'number' || x.price <= 0) problems.push('price: positive coins');
  const kind = (x.effect as { kind?: string } | undefined)?.kind;
  if (!kind || ![...COSMETIC_KINDS, ...CONVENIENCE_KINDS, 'draft-boost'].includes(kind as never)) {
    problems.push(`effect: only cosmetics or convenience can be sold (got "${kind ?? 'none'}")`);
  }
  if (FORBIDDEN.test(`${x.id ?? ''} ${x.name ?? ''}`)) {
    problems.push('name/id: store items never sell players, ratings or results');
  }
  return problems;
}

/** The planned catalog (prices from monetization.md). */
export const STORE_ITEMS: StoreItem[] = [
  { id: 'respin', name: 'Extra re-spin', price: 30, effect: { kind: 'respin', count: 1 } },
  { id: 'scout', name: 'Scout: two clubs to choose from', price: 60, effect: { kind: 'scout' } },
  { id: 'second-chance', name: 'Second chance: one more tournament', price: 100, effect: { kind: 'second-chance' } },
  { id: 'daily-practice', name: 'Daily practice try (not ranked)', price: 150, effect: { kind: 'daily-practice' } },
  { id: 'boost-star', name: 'Star boost: clubs with 80+ stars more often (one draft)', price: 400, effect: { kind: 'draft-boost', boost: 'star' } },
  { id: 'boost-legend', name: 'Legend boost: clubs with 90+ legends more often (one draft)', price: 1200, effect: { kind: 'draft-boost', boost: 'legend' } },
  { id: 'frame-gold', name: 'Gold share-card frame', price: 500, effect: { kind: 'card-frame', frameId: 'gold' } },
  { id: 'frame-retro', name: 'Retro share-card frame', price: 300, effect: { kind: 'card-frame', frameId: 'retro' } },
  { id: 'frame-neon', name: 'Neon share-card frame', price: 800, effect: { kind: 'card-frame', frameId: 'neon' } },
  { id: 'pitch-seventies', name: '70s pitch skin', price: 700, effect: { kind: 'pitch-skin', skinId: 'seventies' } },
  { id: 'reel-casino', name: 'Casino reels', price: 1200, effect: { kind: 'reel-skin', skinId: 'casino' } },
  { id: 'celebration-fireworks', name: 'Fireworks celebration', price: 400, effect: { kind: 'celebration', animationId: 'fireworks' } },
  { id: 'sound-ultras', name: 'Ultras stadium sounds', price: 500, effect: { kind: 'sound-pack', packId: 'ultras' }, available: false },
  { id: 'kit-violet', name: 'Violet kit', price: 200, effect: { kind: 'kit', kitId: 'kit-violet' } },
  { id: 'kit-tangerine', name: 'Tangerine kit', price: 200, effect: { kind: 'kit', kitId: 'kit-tangerine' } },
  { id: 'kit-teal', name: 'Teal kit', price: 250, effect: { kind: 'kit', kitId: 'kit-teal' } },
  { id: 'crest-swords', name: 'Swords crest', price: 300, effect: { kind: 'crest', crestId: 'crest-swords' } },
  { id: 'crest-stadium', name: 'Stadium crest', price: 400, effect: { kind: 'crest', crestId: 'crest-stadium' } },
  { id: 'crest-drop', name: 'Drop crest', price: 600, effect: { kind: 'crest', crestId: 'crest-drop' } },
  { id: 'rename', name: 'Change username', price: 200, effect: { kind: 'rename' } },
];

/** Coin packs for real money (store price tiers; the HUF price comes from the store's tier). */
export const COIN_PACKS = [
  { id: 'coins-100', coins: 100, eur: 0.99, bonus: 0 },
  { id: 'coins-550', coins: 550, eur: 4.99, bonus: 10 },
  { id: 'coins-1200', coins: 1200, eur: 9.99, bonus: 20 },
  { id: 'coins-2600', coins: 2600, eur: 19.99, bonus: 30 },
  { id: 'coins-7000', coins: 7000, eur: 49.99, bonus: 40 },
] as const;

/** Shown next to every coin price (EU guidance on in-game currencies: show the real-money value). */
export const eurPerCoin = 0.99 / 100;

// ---- Legal notice (app, share page, store listing)

/** Short notice: footers, share cards. */
export const DISCLAIMER_SHORT =
  'Unofficial fan game. Not affiliated with or endorsed by any club, league or player.';

/** Full notice: About / store listing. */
export const DISCLAIMER =
  'Champion is an unofficial fan game. It is not affiliated with, endorsed or sponsored by any football club, league, federation or player. Club and player names are used only to refer to real historical seasons; no logos, crests, kits or photos are used. All trademarks belong to their owners.';
