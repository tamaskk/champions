import { FORMATIONS, type Formation } from './formations';
import { DECADES, LEAGUES, type Decade, type League } from './leagues';
import { LEGENDS } from './legends';

/**
 * Daily challenge: everyone gets the same challenge and the same reel draws on a given day
 * (seeded from the date), with a rule set: a locked formation, limited decades or leagues,
 * chemistry / overall targets, a legend to beat. One attempt a day, shared as an emoji card.
 */

export type DailyRules = {
  /** Locked formation (no formation spin). */
  formation?: Formation;
  /** Only these decades on the decade reel. */
  decades?: Decade[];
  /** Only these leagues on the league reel. */
  leagues?: League[];
  /** Team chemistry needed (0–100). */
  targetChemistry?: number;
  /** Overall needed. */
  targetOverall?: number;
  /** Legend (id from LEGENDS) your XI must beat in one match. */
  opponentLegend?: string;
  /** Re-spins allowed in the whole draft (undefined = normal rules, 0 = none). */
  maxRespins?: number;
};

export type DailyTier = 'SILVER' | 'GOLD' | 'LEGEND';

export type DailyChallenge = {
  id: string;
  /** YYYY-MM-DD; set when scheduled for a day (admin / import), otherwise picked from the pool. */
  date?: string;
  title: string;
  description: string;
  tier: DailyTier;
  xp: number;
  rules: DailyRules;
};

/** GET /api/daily?date=2026-09-26 */
export type DailyResponse = { date: string; challenge: DailyChallenge; scheduled: boolean };

const c = (id: string, title: string, description: string, tier: DailyTier, rules: DailyRules): DailyChallenge => ({
  id,
  title,
  description,
  tier,
  xp: tier === 'LEGEND' ? 1200 : tier === 'GOLD' ? 700 : 400,
  rules,
});

/** Built-in challenges (100), used in turn on days without a scheduled one. */
export const DAILY_POOL: DailyChallenge[] = [
  c('serie-a-90s', '90s Serie A Masterclass', "Fixed 3-5-2, only 90s Serie A. Beat Capello's Milan.", 'LEGEND', {
    formation: '3-5-2',
    decades: [1990],
    leagues: ['ITA'],
    targetChemistry: 70,
    opponentLegend: 'milan-1993',
  }),
  c('invincible-hunt', 'Invincible Hunt', 'Any XI – but beat the 2003/04 Arsenal Invincibles.', 'GOLD', {
    opponentLegend: 'arsenal-2003',
  }),
  c('full-green', 'Full Green', 'Reach 90+ team chemistry.', 'GOLD', { targetChemistry: 90 }),
  c('swinging-sixties', 'Swinging Sixties', 'Only the 1960s. Overall 70+.', 'SILVER', {
    decades: [1960],
    targetOverall: 70,
  }),
  c('premier-power', 'Premier Power', 'English clubs only, 4-4-2. Chemistry 75+.', 'SILVER', {
    formation: '4-4-2',
    leagues: ['ENG'],
    targetChemistry: 75,
  }),
  c('la-liga-tiki', 'Tiki-Taka', 'Spanish clubs only, 4-3-3. Beat the Wembley Barça.', 'LEGEND', {
    formation: '4-3-3',
    leagues: ['ESP'],
    opponentLegend: 'barcelona-2010',
  }),
  c('bundesliga-machine', 'German Machine', 'Bundesliga only, 4-2-3-1. Overall 80+.', 'GOLD', {
    formation: '4-2-3-1',
    leagues: ['GER'],
    targetOverall: 80,
  }),
  c('french-flair', 'French Flair', 'Ligue 1 only. Chemistry 70+.', 'SILVER', {
    leagues: ['FRA'],
    targetChemistry: 70,
  }),
  c('no-respins', 'No Second Chances', 'No re-spins at all. Overall 75+.', 'GOLD', {
    maxRespins: 0,
    targetOverall: 75,
  }),
  c('one-respin', 'One Shot', 'Only one re-spin in the whole draft. Chemistry 60+.', 'SILVER', {
    maxRespins: 1,
    targetChemistry: 60,
  }),
  c('pyramid', 'The Pyramid', 'The 2-3-5 of the pioneers. Overall 72+.', 'GOLD', {
    formation: '2-3-5',
    targetOverall: 72,
  }),
  c('catenaccio', 'Catenaccio', '5-3-2, Serie A only. Beat Grande Inter.', 'LEGEND', {
    formation: '5-3-2',
    leagues: ['ITA'],
    opponentLegend: 'inter-1964',
  }),
  c('treble-trouble', 'Treble Trouble', "Beat Heynckes' 2012/13 Bayern.", 'LEGEND', { opponentLegend: 'bayern-2012' }),
  c('centurions', 'Stop the Centurions', "Beat Guardiola's 100-point City.", 'LEGEND', { opponentLegend: 'city-2017' }),
  c('eighties-icons', 'Eighties Icons', 'Only the 1980s, 4-4-2 diamond. Chemistry 65+.', 'SILVER', {
    formation: '4-4-2 diamond',
    decades: [1980],
    targetChemistry: 65,
  }),
  c('modern-era', 'Modern Era', 'Only the 2010s and 2020s. Overall 85+.', 'GOLD', {
    decades: [2010, 2020],
    targetOverall: 85,
  }),
  c('old-school', 'Old School', 'Only the 60s and 70s. Beat Beckenbauer’s Bayern.', 'LEGEND', {
    decades: [1960, 1970],
    opponentLegend: 'bayern-1973',
  }),
  c('false-nine', 'False Nine', '4-3-3 false nine. Chemistry 80+.', 'GOLD', {
    formation: '4-3-3 false nine',
    targetChemistry: 80,
  }),
  c('parking-the-bus', 'Park the Bus', '5-4-1. Beat MSN Barcelona.', 'LEGEND', {
    formation: '5-4-1',
    opponentLegend: 'barcelona-2014',
  }),
  c('fairy-tale', 'Fairy Tale', 'Beat Leicester’s 2015/16 miracle.', 'SILVER', { opponentLegend: 'leicester-2015' }),
  c('clough', 'Old Big ’Ead', 'English clubs, 70s only. Beat Clough’s Forest.', 'GOLD', {
    leagues: ['ENG'],
    decades: [1970],
    opponentLegend: 'forest-1978',
  }),
  c('maradona', 'Stop Diego', "Beat Maradona's Napoli.", 'GOLD', { opponentLegend: 'napoli-1986' }),
  c('neverkusen', 'Unbeaten No More', "End Leverkusen's unbeaten run.", 'GOLD', { opponentLegend: 'leverkusen-2023' }),
  c('two-leagues', 'Derby Mix', 'Only English and Spanish clubs. Chemistry 70+.', 'SILVER', {
    leagues: ['ENG', 'ESP'],
    targetChemistry: 70,
  }),
  c('italo-german', 'Italo-German', 'Only Serie A and Bundesliga. Overall 78+.', 'SILVER', {
    leagues: ['ITA', 'GER'],
    targetOverall: 78,
  }),
  c('noughties', 'Noughties', 'Only the 2000s, 4-4-2. Beat Mourinho’s first Chelsea.', 'GOLD', {
    formation: '4-4-2',
    decades: [2000],
    opponentLegend: 'chelsea-2004',
  }),
  c('galacticos', 'Galácticos', 'Overall 88+. No excuses.', 'LEGEND', { targetOverall: 88 }),
  c('perfect-harmony', 'Perfect Harmony', 'Chemistry 100.', 'LEGEND', { targetChemistry: 100 }),
  c('three-at-the-back', 'Three at the Back', '3-4-3. Chemistry 70+ and overall 75+.', 'GOLD', {
    formation: '3-4-3',
    targetChemistry: 70,
    targetOverall: 75,
  }),
  c('diamond-life', 'Diamond Life', '4-4-2 diamond. Beat Sacchi’s Milan.', 'LEGEND', {
    formation: '4-4-2 diamond',
    opponentLegend: 'milan-1988',
  }),
  c('le-classique', 'Le Classique', 'Ligue 1 only. Beat OM 1993.', 'GOLD', {
    leagues: ['FRA'],
    opponentLegend: 'marseille-1992',
  }),
  c('kop-end', 'The Kop', "Beat Klopp's 2019/20 Liverpool.", 'LEGEND', { opponentLegend: 'liverpool-2019' }),
  c('ninety-nine', 'Class of ’99', "Beat Fergie's treble winners.", 'LEGEND', { opponentLegend: 'manutd-1998' }),
  c('vieille-dame', 'La Vecchia Signora', 'Serie A only. Beat Conte’s 102-point Juve.', 'GOLD', {
    leagues: ['ITA'],
    opponentLegend: 'juventus-2013',
  }),
  c('cholismo', 'Cholismo', '4-4-2, La Liga only. Beat Simeone’s champions.', 'GOLD', {
    formation: '4-4-2',
    leagues: ['ESP'],
    opponentLegend: 'atletico-2013',
  }),
  c('yellow-wall', 'Yellow Wall', 'Bundesliga only. Beat Klopp’s Dortmund.', 'GOLD', {
    leagues: ['GER'],
    opponentLegend: 'dortmund-2011',
  }),
  c('seventies-chem', 'Seventies Chemistry', 'Only the 70s. Chemistry 75+.', 'SILVER', {
    decades: [1970],
    targetChemistry: 75,
  }),
  c('ninety-power', 'Nineties Power', 'Only the 90s. Overall 80+.', 'SILVER', { decades: [1990], targetOverall: 80 }),
  c('twenties', 'The Twenties', 'Only the 2020s, 4-3-3. Beat Haaland’s City.', 'LEGEND', {
    formation: '4-3-3',
    decades: [2020],
    opponentLegend: 'city-2022',
  }),
  c('decima', 'La Décima', 'Beat Real Madrid 2013/14.', 'GOLD', { opponentLegend: 'real-2013' }),
  c('zlatan', 'Zlatan Rules', 'Ligue 1 only, 4-3-3. Beat PSG 2015/16.', 'GOLD', {
    formation: '4-3-3',
    leagues: ['FRA'],
    opponentLegend: 'psg-2015',
  }),
  c('les-verts', 'Les Verts', 'Only the 70s. Beat Saint-Étienne.', 'SILVER', {
    decades: [1970],
    opponentLegend: 'saint-etienne-1975',
  }),
  c('no-respin-legend', 'Pure Luck', 'No re-spins. Beat Mourinho’s treble Inter.', 'LEGEND', {
    maxRespins: 0,
    opponentLegend: 'inter-2009',
  }),
  c('wing-play', 'Wing Play', '4-2-4. Overall 76+.', 'SILVER', { formation: '4-2-4', targetOverall: 76 }),
  c('midfield-mesh', 'Midfield Mesh', '4-5-1. Chemistry 80+.', 'GOLD', { formation: '4-5-1', targetChemistry: 80 }),
  c('christmas-tree', 'Christmas Tree', '4-3-2-1. Beat Capello’s Milan.', 'LEGEND', {
    formation: '4-3-2-1',
    opponentLegend: 'milan-1993',
  }),
  c('hamburg-83', 'Athens 1983', 'Bundesliga, 80s only. Beat Hamburg.', 'GOLD', {
    leagues: ['GER'],
    decades: [1980],
    opponentLegend: 'hamburg-1982',
  }),
  c('lyon-seven', 'Seven in a Row', 'Beat Lyon 2005/06.', 'SILVER', { opponentLegend: 'lyon-2005' }),
  c('valencia', 'Mestalla', 'La Liga only. Beat Benítez’s Valencia.', 'SILVER', {
    leagues: ['ESP'],
    opponentLegend: 'valencia-2003',
  }),
  c('gladbach', 'The Foals', 'Only the 70s, Bundesliga. Chemistry 65+.', 'SILVER', {
    decades: [1970],
    leagues: ['GER'],
    targetChemistry: 65,
  }),
  c('platini', 'Le Roi', 'Beat Platini’s Juve.', 'GOLD', { opponentLegend: 'juventus-1984' }),
  c('sampdoria', 'Goal Twins', 'Serie A, 90s. Beat Sampdoria 1990/91.', 'SILVER', {
    leagues: ['ITA'],
    decades: [1990],
    opponentLegend: 'sampdoria-1990',
  }),
  c('ronaldo-era', 'Moscow 2008', 'Only the 2000s. Beat United 2007/08.', 'GOLD', {
    decades: [2000],
    opponentLegend: 'manutd-2007',
  }),
  c('iron-defence', 'Iron Defence', '5-3-2. Overall 80+ and chemistry 70+.', 'GOLD', {
    formation: '5-3-2',
    targetOverall: 80,
    targetChemistry: 70,
  }),
  c('sixty-nation', 'Pan-European', 'All five leagues are allowed, but no re-spins. Chemistry 55+.', 'SILVER', {
    maxRespins: 0,
    targetChemistry: 55,
  }),
  c('rush-hour', 'Rush Hour', 'English clubs, 80s only. Beat Liverpool 1984.', 'GOLD', {
    leagues: ['ENG'],
    decades: [1980],
    opponentLegend: 'liverpool-1983',
  }),
  c('flick', 'Sextuple', 'Beat Flick’s 2019/20 Bayern.', 'LEGEND', { opponentLegend: 'bayern-2019' }),
  c('zidane', 'Three in a Row', 'Beat Zidane’s 2016/17 Real Madrid.', 'LEGEND', { opponentLegend: 'real-2016' }),
  c('first-treble', "Pep's First", 'Only La Liga, 2000s. Beat Barça 2008/09.', 'LEGEND', {
    leagues: ['ESP'],
    decades: [2000],
    opponentLegend: 'barcelona-2008',
  }),
  c('galacticos-2002', 'Hampden Volley', 'Beat the 2001/02 Galácticos.', 'GOLD', { opponentLegend: 'real-2001' }),
  c('verrou', 'Le Verrou', '6-3-1 bunker. Beat Guardiola’s first treble Barça.', 'LEGEND', {
    formation: '6-3-1',
    opponentLegend: 'barcelona-2008',
  }),
  c('w-m', 'The W-M', '3-2-2-3 like Chapman’s Arsenal. Overall 72+.', 'SILVER', {
    formation: '3-2-2-3',
    targetOverall: 72,
  }),
  c('liga-legends', 'Liga Legends', 'La Liga only. Overall 82+.', 'GOLD', { leagues: ['ESP'], targetOverall: 82 }),
  c('premier-chem', 'Premier Bonds', 'Premier League only. Chemistry 85+.', 'GOLD', {
    leagues: ['ENG'],
    targetChemistry: 85,
  }),
  c('calcio-chem', 'Calcio Brothers', 'Serie A only. Chemistry 80+.', 'GOLD', {
    leagues: ['ITA'],
    targetChemistry: 80,
  }),
  c('bundes-chem', 'Bundesliga Bonds', 'Bundesliga only. Chemistry 75+.', 'SILVER', {
    leagues: ['GER'],
    targetChemistry: 75,
  }),
  c('ligue1-power', 'Ligue 1 Power', 'Ligue 1 only. Overall 76+.', 'SILVER', { leagues: ['FRA'], targetOverall: 76 }),
  c('sixties-euro', 'European Nights', 'Only the 60s. Beat Grande Inter.', 'LEGEND', {
    decades: [1960],
    opponentLegend: 'inter-1964',
  }),
  c('seventies-gold', 'Total Football', '4-3-3, only the 70s. Overall 75+.', 'GOLD', {
    formation: '4-3-3',
    decades: [1970],
    targetOverall: 75,
  }),
  c('eighties-legend', 'Van Basten Era', 'Only the 80s. Beat Sacchi’s Milan.', 'LEGEND', {
    decades: [1980],
    opponentLegend: 'milan-1988',
  }),
  c('nineties-chem', 'Nineties Harmony', 'Only the 90s. Chemistry 80+.', 'GOLD', {
    decades: [1990],
    targetChemistry: 80,
  }),
  c('noughties-power', 'Noughties Power', 'Only the 2000s. Overall 83+.', 'GOLD', {
    decades: [2000],
    targetOverall: 83,
  }),
  c('tens-chem', 'Tiki-Taka Decade', 'Only the 2010s. Chemistry 85+.', 'GOLD', {
    decades: [2010],
    targetChemistry: 85,
  }),
  c('twenties-power', 'Right Now', 'Only the 2020s. Overall 82+.', 'SILVER', { decades: [2020], targetOverall: 82 }),
  c('eng-80s', 'Kenny’s Kingdom', 'English clubs, 80s. Chemistry 70+.', 'SILVER', {
    leagues: ['ENG'],
    decades: [1980],
    targetChemistry: 70,
  }),
  c('esp-00s', 'Galáctico Decade', 'La Liga, 2000s. Beat the 2001/02 Galácticos.', 'GOLD', {
    leagues: ['ESP'],
    decades: [2000],
    opponentLegend: 'real-2001',
  }),
  c('ita-80s', 'Serie A Golden Age', 'Serie A, 80s. Overall 78+.', 'GOLD', {
    leagues: ['ITA'],
    decades: [1980],
    targetOverall: 78,
  }),
  c('ger-70s', 'Der Kaiser', 'Bundesliga, 70s. Beat Beckenbauer’s Bayern.', 'LEGEND', {
    leagues: ['GER'],
    decades: [1970],
    opponentLegend: 'bayern-1973',
  }),
  c('fra-90s', 'Allez l’OM', 'Ligue 1, 90s. Chemistry 65+.', 'SILVER', {
    leagues: ['FRA'],
    decades: [1990],
    targetChemistry: 65,
  }),
  c('eng-10s', 'Premier Superpowers', 'English clubs, 2010s. Beat the Centurions.', 'LEGEND', {
    leagues: ['ENG'],
    decades: [2010],
    opponentLegend: 'city-2017',
  }),
  c('two-respins-legend', 'Two Chances', 'Two re-spins in total. Beat Klopp’s Liverpool.', 'LEGEND', {
    maxRespins: 2,
    opponentLegend: 'liverpool-2019',
  }),
  c('no-respin-chem', 'Blind Draft', 'No re-spins. Chemistry 65+.', 'GOLD', { maxRespins: 0, targetChemistry: 65 }),
  c('one-respin-ovr', 'Single Shot', 'One re-spin. Overall 80+.', 'GOLD', { maxRespins: 1, targetOverall: 80 }),
  c('three-five-two', 'Wing-backs', '3-5-2. Chemistry 75+.', 'SILVER', { formation: '3-5-2', targetChemistry: 75 }),
  c('four-two-three-one', 'Double Pivot', '4-2-3-1. Beat Heynckes’ Bayern.', 'LEGEND', {
    formation: '4-2-3-1',
    opponentLegend: 'bayern-2012',
  }),
  c('four-one-four-one', 'The Anchor', '4-1-4-1. Overall 78+ and chemistry 65+.', 'GOLD', {
    formation: '4-1-4-1',
    targetOverall: 78,
    targetChemistry: 65,
  }),
  c('box-midfield', 'Box Midfield', '4-2-2-2. Beat Mourinho’s Chelsea.', 'GOLD', {
    formation: '4-2-2-2',
    opponentLegend: 'chelsea-2004',
  }),
  c('three-four-three', 'Conte’s Wingbacks', '3-4-3, Serie A only. Beat Conte’s Juve.', 'LEGEND', {
    formation: '3-4-3',
    leagues: ['ITA'],
    opponentLegend: 'juventus-2013',
  }),
  c('five-back-wall', 'Five at the Back', '5-3-2. Beat Dortmund 1997.', 'SILVER', {
    formation: '5-3-2',
    opponentLegend: 'dortmund-1996',
  }),
  c('overload', 'Overload', '4-2-4. Beat Napoli 2022/23.', 'GOLD', {
    formation: '4-2-4',
    opponentLegend: 'napoli-2022',
  }),
  c('invincible-chem', 'Unbreakable', 'Chemistry 95+.', 'LEGEND', { targetChemistry: 95 }),
  c('elite-ovr', 'Elite Squad', 'Overall 86+.', 'LEGEND', { targetOverall: 86 }),
  c('solid-base', 'Solid Base', 'Overall 75+ and chemistry 60+.', 'SILVER', { targetOverall: 75, targetChemistry: 60 }),
  c('juve-95', 'Del Piero’s Juve', 'Only the 90s. Beat Lippi’s Juve.', 'GOLD', {
    decades: [1990],
    opponentLegend: 'juventus-1995',
  }),
  c('treble-99', 'Camp Nou ’99', 'English clubs only. Beat Fergie’s treble winners.', 'LEGEND', {
    leagues: ['ENG'],
    opponentLegend: 'manutd-1998',
  }),
  c('wembley-11', 'Wembley 2011', 'Only the 2000s and 2010s. Beat the Wembley Barça.', 'LEGEND', {
    decades: [2000, 2010],
    opponentLegend: 'barcelona-2010',
  }),
  c('madrid-derby', 'Madrid Derby', 'La Liga only. Beat Zidane’s Real.', 'LEGEND', {
    leagues: ['ESP'],
    opponentLegend: 'real-2016',
  }),
  c('der-klassiker', 'Der Klassiker', 'Bundesliga only. Beat Flick’s Bayern.', 'LEGEND', {
    leagues: ['GER'],
    opponentLegend: 'bayern-2019',
  }),
  c('derby-della-madonnina', 'Madonnina Derby', 'Serie A only. Beat Mourinho’s Inter.', 'GOLD', {
    leagues: ['ITA'],
    opponentLegend: 'inter-2009',
  }),
  c('paris-nights', 'Paris Nights', 'Ligue 1 and La Liga only. Overall 78+.', 'SILVER', {
    leagues: ['FRA', 'ESP'],
    targetOverall: 78,
  }),
];

/** Days since 2026-01-01 (UTC), the pool index for undated days. */
export function dayIndex(date: string): number {
  return Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse('2026-01-01T00:00:00Z')) / 86_400_000);
}

export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** The challenge of a day: the scheduled one if there is one, else the pool in turn. */
export function dailyForDate(date: string, scheduled: readonly DailyChallenge[] = []): DailyResponse {
  const fixed = scheduled.find((s) => s.date === date);
  if (fixed) return { date, challenge: fixed, scheduled: true };
  const i = ((dayIndex(date) % DAILY_POOL.length) + DAILY_POOL.length) % DAILY_POOL.length;
  return { date, challenge: { ...DAILY_POOL[i]!, date }, scheduled: false };
}

/** Deterministic random numbers from a string seed (mulberry32 on a FNV hash). */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type DailyOutcome = {
  chemistry: number;
  overall: number;
  /** Result against the legend, if the challenge has one. */
  match?: { yours: number; theirs: number } | null;
};

/** Each rule: met or not, for the result screen and the share card. */
export function dailyChecks(ch: DailyChallenge, o: DailyOutcome): { label: string; ok: boolean }[] {
  const checks: { label: string; ok: boolean }[] = [];
  if (ch.rules.targetChemistry !== undefined)
    checks.push({
      label: `Chemistry ${o.chemistry}/${ch.rules.targetChemistry}`,
      ok: o.chemistry >= ch.rules.targetChemistry,
    });
  if (ch.rules.targetOverall !== undefined)
    checks.push({
      label: `Overall ${Math.round(o.overall)}/${ch.rules.targetOverall}`,
      ok: o.overall >= ch.rules.targetOverall,
    });
  if (ch.rules.opponentLegend) {
    const legend = LEGENDS.find((l) => l.id === ch.rules.opponentLegend);
    checks.push({
      label: o.match
        ? `${o.match.yours}–${o.match.theirs} vs ${legend?.nickname ?? 'the legend'}`
        : `Beat ${legend?.nickname ?? 'the legend'}`,
      ok: !!o.match && o.match.yours > o.match.theirs,
    });
  }
  return checks;
}

/** Wordle-style share text. */
export function dailyShareText(ch: DailyChallenge, date: string, o: DailyOutcome): string {
  const checks = dailyChecks(ch, o);
  const won = checks.every((x) => x.ok);
  const squares = checks.map((x) => (x.ok ? '🟩' : '🟥')).join('');
  return [
    `Champion Daily ${date} ${won ? '🏆' : '❌'}`,
    `${ch.title} (${ch.tier})`,
    `${squares}  OVR ${Math.round(o.overall)} · CHEM ${o.chemistry}`,
    o.match ? `⚽ ${o.match.yours}–${o.match.theirs}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Validates an imported challenge (admin JSON import, Claude-generated files). Returns problems. */
export function validateDaily(x: unknown): string[] {
  const problems: string[] = [];
  const d = x as Partial<DailyChallenge>;
  if (!d || typeof d !== 'object') return ['not an object'];
  if (!d.id || !/^[a-z0-9-]+$/.test(d.id)) problems.push('id: lowercase-with-dashes required');
  if (d.date && !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) problems.push('date: YYYY-MM-DD');
  if (!d.title) problems.push('title missing');
  if (!d.description) problems.push('description missing');
  if (!d.tier || !['SILVER', 'GOLD', 'LEGEND'].includes(d.tier)) problems.push('tier: SILVER | GOLD | LEGEND');
  if (typeof d.xp !== 'number') problems.push('xp: number');
  const r = d.rules ?? {};
  if (r.formation && !(FORMATIONS as readonly string[]).includes(r.formation))
    problems.push(`rules.formation: unknown formation ${r.formation}`);
  if (r.decades?.some((dec) => !(DECADES as readonly number[]).includes(dec)))
    problems.push('rules.decades: 1960 … 2020');
  if (r.leagues?.some((l) => !(LEAGUES as readonly string[]).includes(l)))
    problems.push('rules.leagues: ENG ESP ITA GER FRA');
  if (r.opponentLegend && !LEGENDS.some((l) => l.id === r.opponentLegend))
    problems.push(`rules.opponentLegend: unknown legend ${r.opponentLegend}`);
  if (r.targetChemistry !== undefined && (r.targetChemistry < 0 || r.targetChemistry > 100))
    problems.push('rules.targetChemistry: 0–100');
  if (!r.targetChemistry && !r.targetOverall && !r.opponentLegend)
    problems.push('rules: needs a target (targetChemistry, targetOverall or opponentLegend)');
  return problems;
}

/** Prompt for Claude (chat or CLI) that returns new daily challenges as a JSON array. */
export function buildDailyPrompt(count: number, startDate: string): string {
  return `You design daily challenges for "Champion", a football draft game: the player spins a formation, then for each spot a decade (1960s–2020s), a league (ENG, ESP, ITA, GER, FRA) and a club, and drafts a real player from that club-decade squad. Team chemistry (0–100) rewards team-mates, same club, compatriots; overall ≈ average player rating (0–100, 60 = regular, 85+ elite).

Write ${count} new challenges, one per day starting ${startDate} (set "date" for each). Mix difficulty: ~40% SILVER (xp 400), ~40% GOLD (xp 700), ~20% LEGEND (xp 1200). Make them themed and fun (eras, leagues, famous tactics, rivalries).

Output ONLY a JSON array, each item:
{
  "id": "lowercase-with-dashes-unique",
  "date": "YYYY-MM-DD",
  "title": "short title (max 24 chars)",
  "description": "one sentence with the rules",
  "tier": "SILVER" | "GOLD" | "LEGEND",
  "xp": 400 | 700 | 1200,
  "rules": {
    "formation"?: one of ${JSON.stringify(FORMATIONS.slice(0, 30))},
    "decades"?: subset of [1960, 1970, 1980, 1990, 2000, 2010, 2020],
    "leagues"?: subset of ["ENG", "ESP", "ITA", "GER", "FRA"],
    "targetChemistry"?: 40–100,
    "targetOverall"?: 65–90,
    "opponentLegend"?: one of ${JSON.stringify(LEGENDS.map((l) => l.id))},
    "maxRespins"?: 0–3
  }
}
Every challenge needs at least one target: targetChemistry, targetOverall or opponentLegend. Keep single-league + single-decade combinations realistic (e.g. no GER before 1963). Realistic targets: chemistry 60–80 is hard with narrow rules; overall 80+ is hard.`;
}

/** JSON schema of a Claude-generated batch (for `claude -p --json-schema`). */
export const DAILY_IMPORT_SCHEMA = {
  type: 'object',
  properties: {
    challenges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          date: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          tier: { enum: ['SILVER', 'GOLD', 'LEGEND'] },
          xp: { type: 'number' },
          rules: {
            type: 'object',
            properties: {
              formation: { type: 'string' },
              decades: { type: 'array', items: { type: 'number' } },
              leagues: { type: 'array', items: { type: 'string' } },
              targetChemistry: { type: 'number' },
              targetOverall: { type: 'number' },
              opponentLegend: { type: 'string' },
              maxRespins: { type: 'number' },
            },
          },
        },
        required: ['id', 'date', 'title', 'description', 'tier', 'xp', 'rules'],
      },
    },
  },
  required: ['challenges'],
} as const;

/** Rules in one line ("4-3-3 · ESP · 1990s · CHEM 70+ · beat Sacchi's Milan"). */
export function dailyRulesLine(ch: DailyChallenge): string {
  const r = ch.rules;
  const legend = r.opponentLegend ? LEGENDS.find((l) => l.id === r.opponentLegend) : null;
  return [
    r.formation,
    r.leagues?.join('/'),
    r.decades?.map((d) => `${String(d).slice(2)}s`).join('/'),
    r.targetChemistry !== undefined && `CHEM ${r.targetChemistry}+`,
    r.targetOverall !== undefined && `OVR ${r.targetOverall}+`,
    r.maxRespins !== undefined && `${r.maxRespins} re-spin${r.maxRespins === 1 ? '' : 's'}`,
    legend && `beat ${legend.nickname}`,
  ]
    .filter(Boolean)
    .join(' · ');
}
