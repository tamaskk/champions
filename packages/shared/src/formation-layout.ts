/** Detailed positions, as in the squad data (transfermarkt style). */
export const POSITION_CODES = [
  'GK',
  'SW',
  'CB',
  'LB',
  'RB',
  'DM',
  'CM',
  'AM',
  'LM',
  'RM',
  'LW',
  'RW',
  'SS',
  'CF',
] as const;
export type PositionCode = (typeof POSITION_CODES)[number];

/** Position on a vertical pitch: x 0 = left touchline, 1 = right; y 0 = own goal line, 1 = opponent's. */
export type PitchSpot = { x: number; y: number };

/** A pitch spot plus the detailed position it stands for. */
export type LayoutSpot = PitchSpot & { code: PositionCode };

const GK_Y = 0.06;
const FIRST_LINE_Y = 0.22;
const LAST_LINE_Y = 0.84;
const MAX_SPAN = 0.84;
const SPACING = 0.21;

function spreadLine(count: number, y: number, spanScale = 1): PitchSpot[] {
  if (count === 0) return [];
  if (count === 1) return [{ x: 0.5, y }];
  const span = Math.min(MAX_SPAN, SPACING * (count - 1)) * spanScale;
  return Array.from({ length: count }, (_, i) => ({
    x: 0.5 - span / 2 + (span * i) / (count - 1),
    y,
  }));
}

function diamondLine(count: number, y: number, depth: number): PitchSpot[] {
  switch (count) {
    case 3:
      return [
        { x: 0.3, y },
        { x: 0.5, y: y - depth },
        { x: 0.7, y },
      ];
    case 4:
      return [
        { x: 0.22, y },
        { x: 0.5, y: y - depth },
        { x: 0.5, y: y + depth },
        { x: 0.78, y },
      ];
    case 5:
      // Wide men on the flanks, holding / central / attacking mid stacked down the middle.
      return [
        { x: 0.12, y },
        { x: 0.5, y: y - depth },
        { x: 0.5, y },
        { x: 0.5, y: y + depth },
        { x: 0.88, y },
      ];
    default:
      return spreadLine(count, y);
  }
}

/**
 * Turns a formation label like "4-4-2 diamond" or "4-3-3 false nine" into 1 + N pitch spots
 * (goalkeeper first, then each line from defence to attack, left to right).
 */
export function formationLayout(formation: string): LayoutSpot[] {
  const [shape, ...rest] = formation.split(' ');
  const variant = rest.join(' ');
  const numbers = shape.split('-').map(Number);
  const lines = numbers.filter((n) => n > 0);
  // A trailing "-0" means no forward line: the last line is midfield.
  const hasAttack = numbers[numbers.length - 1] > 0 && lines.length > 1;
  const midCount = lines.length - 1 - (hasAttack ? 1 : 0);

  const gap = lines.length > 1 ? (LAST_LINE_Y - FIRST_LINE_Y) / (lines.length - 1) : 0;
  const lineY = (i: number) => (lines.length > 1 ? FIRST_LINE_Y + gap * i : 0.5);

  // Diamond reshapes the biggest midfield line (not the back line, not the front line).
  let diamondIndex = -1;
  if (variant === 'diamond') {
    const mids = lines.map((n, i) => ({ n, i })).slice(1, -1);
    const best = mids.reduce((a, b) => (b.n > a.n ? b : a), { n: 0, i: -1 });
    if (best.n >= 3) diamondIndex = best.i;
  }

  const spots: LayoutSpot[] = [{ x: 0.5, y: GK_Y, code: 'GK' }];
  lines.forEach((count, i) => {
    const y = lineY(i);
    const isDefence = i === 0;
    const isAttack = hasAttack && i === lines.length - 1;

    let line: PitchSpot[];
    if (i === diamondIndex) {
      // Three players stacked down the middle (5-man diamond) need room for node + name tag each.
      line = diamondLine(count, y, count >= 5 ? Math.min(gap * 0.52, 0.16) : Math.min(gap * 0.45, 0.09));
    } else if (variant === 'narrow' && !isDefence) {
      line = spreadLine(count, y, 0.8);
    } else if (variant === 'wide' && !isDefence) {
      line = spreadLine(count, y, count > 1 ? MAX_SPAN / Math.min(MAX_SPAN, SPACING * (count - 1)) : 1);
    } else {
      line = spreadLine(count, y);
    }

    if (variant === 'false nine' && isAttack) {
      const mid = Math.floor(line.length / 2);
      line[mid] = { ...line[mid], y: y - Math.min(gap * 0.6, 0.1) };
    }

    const codes = isDefence
      ? defenceCodes(count)
      : isAttack
        ? attackCodes(count)
        : midfieldCodes(line, y, {
            diamond: i === diamondIndex,
            first: i === 1,
            last: i === midCount,
            behindStrikers: hasAttack && i === midCount ? lines[lines.length - 1] : 0,
            onlyLine: midCount === 1,
          });
    spots.push(...line.map((spot, k) => ({ ...spot, code: codes[k] })));
  });

  return spots;
}

function defenceCodes(count: number): PositionCode[] {
  if (count <= 3) return Array(count).fill('CB');
  // Four or more: full-backs (wing-backs) on the flanks, centre-backs inside.
  return ['LB', ...Array(count - 2).fill('CB'), 'RB'];
}

function attackCodes(count: number): PositionCode[] {
  if (count <= 2) return Array(count).fill('CF');
  if (count === 3) return ['LW', 'CF', 'RW'];
  if (count === 4) return ['LW', 'CF', 'CF', 'RW'];
  return ['LW', ...Array(count - 4).fill('SS'), 'CF', 'SS', 'RW'].slice(0, count) as PositionCode[];
}

/**
 * Midfield spots by place on the pitch. Wide spots are LM/RM (LW/RW in a second midfield line of
 * three behind a lone striker, e.g. the 3 in 4-2-3-1). Central spots are DM in a deep line of one
 * or two, AM in a line of up to three behind one or two strikers, CM otherwise. A diamond: holding DM at the
 * back, AM at the tip.
 */
function midfieldCodes(
  line: PitchSpot[],
  y: number,
  ctx: { diamond: boolean; first: boolean; last: boolean; behindStrikers: number; onlyLine: boolean },
): PositionCode[] {
  const wingers = ctx.behindStrikers === 1 && line.length === 3 && !ctx.onlyLine;
  return line.map((spot) => {
    if (ctx.diamond && spot.x === 0.5) return spot.y < y ? 'DM' : spot.y > y ? 'AM' : 'CM';
    if (ctx.diamond) return spot.x <= 0.2 ? 'LM' : spot.x >= 0.8 ? 'RM' : 'CM';
    const wide = spot.x <= 0.2 || spot.x >= 0.8 || (wingers && spot.x !== 0.5);
    if (wide) {
      const left = spot.x < 0.5;
      return wingers ? (left ? 'LW' : 'RW') : left ? 'LM' : 'RM';
    }
    if (ctx.onlyLine) return 'CM';
    if (ctx.first && line.length <= 2) return 'DM';
    if (ctx.last && line.length <= 3 && ctx.behindStrikers > 0 && ctx.behindStrikers <= 2) return 'AM';
    return 'CM';
  });
}

export const PLAYER_ROLES = ['FW', 'MF', 'DF', 'GK'] as const;
export type PlayerRole = (typeof PLAYER_ROLES)[number];

/**
 * Role of every spot, index-aligned with formationLayout(). First line defends, the last
 * number attacks (a trailing "-0" means no forwards), everything in between is midfield.
 */
export function formationRoles(formation: string): PlayerRole[] {
  const numbers = formation.split(' ')[0].split('-').map(Number);
  const last = numbers.length - 1;
  const roles: PlayerRole[] = ['GK'];
  numbers.forEach((count, j) => {
    const role: PlayerRole = j === 0 ? 'DF' : j === last ? 'FW' : 'MF';
    for (let k = 0; k < count; k++) roles.push(role);
  });
  return roles;
}

/** How well a player fits a spot: his main position, one of his other positions, or not at all. */
export type PositionFit = 'main' | 'other' | null;

/**
 * `positions` is main first. Players without detailed positions fall back to the broad role
 * (GK/DF/MF/FW), which counts as their main position.
 */
export function positionFit(
  player: { position: PlayerRole; positions?: readonly string[] | null },
  spot: { code: PositionCode; role: PlayerRole },
): PositionFit {
  const positions = player.positions ?? [];
  if (positions.length === 0) return player.position === spot.role ? 'main' : null;
  if (positions[0] === spot.code) return 'main';
  return positions.includes(spot.code) ? 'other' : null;
}
