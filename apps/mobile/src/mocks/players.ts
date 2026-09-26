// Dummy player pool until real squads come from the API.
import { PLAYER_ROLES, type ChemistryProfile, type PlayerRole } from '@champion/shared';

/** A player offered in the draft list, real (from the API) or dummy. */
export type DraftPlayer = {
  id: string;
  name: string;
  position: PlayerRole;
  /** Short stats line, e.g. "ENG · 34 apps · 5 goals". Real players only. */
  detail?: string;
  /** Club-decade rating, 0–100. Real players only. */
  rating?: number;
  /** Detailed positions (PositionCode), main first. Real players only. */
  positions?: string[];
  /** Career (clubs, seasons, nationalities) for chemistry. Real players only. */
  chemistry?: ChemistryProfile | null;
  /** League goals and appearances in that club decade (goalscorers in matches). Real players only. */
  goals?: number | null;
  appearances?: number | null;
  /** Transfermarkt id, for the player card's career. Real players only. */
  tmId?: number | null;
  /** Captain of the XI (set on the lineup, not in the draft list). */
  captain?: boolean;
};

const NAMES: Record<string, { first: string[]; last: string[] }> = {
  Spanish: {
    first: ['Javier', 'Sergio', 'Iker', 'Raúl', 'Carles', 'Xavi', 'Andrés', 'Fernando', 'David', 'Pablo'],
    last: ['García', 'Martínez', 'López', 'Hierro', 'Puyol', 'Ramos', 'Torres', 'Silva', 'Alonso', 'Navarro'],
  },
  Italian: {
    first: ['Paolo', 'Franco', 'Roberto', 'Alessandro', 'Gianluca', 'Andrea', 'Fabio', 'Marco', 'Luca', 'Dino'],
    last: ['Rossi', 'Baresi', 'Maldini', 'Del Piero', 'Totti', 'Pirlo', 'Cannavaro', 'Vieri', 'Conti', 'Zoff'],
  },
  English: {
    first: ['Bobby', 'Gary', 'Alan', 'Steven', 'Frank', 'Paul', 'John', 'Tony', 'Wayne', 'Harry'],
    last: ['Charlton', 'Lineker', 'Shearer', 'Gerrard', 'Lampard', 'Scholes', 'Barnes', 'Adams', 'Moore', 'Kane'],
  },
  German: {
    first: ['Franz', 'Gerd', 'Lothar', 'Jürgen', 'Michael', 'Oliver', 'Philipp', 'Thomas', 'Karl', 'Uwe'],
    last: ['Müller', 'Beckenbauer', 'Matthäus', 'Klinsmann', 'Ballack', 'Kahn', 'Lahm', 'Rummenigge', 'Seeler', 'Vogts'],
  },
  French: {
    first: ['Michel', 'Zinedine', 'Thierry', 'Didier', 'Laurent', 'Patrick', 'Eric', 'Jean-Pierre', 'Claude', 'Robert'],
    last: ['Platini', 'Zidane', 'Henry', 'Deschamps', 'Blanc', 'Vieira', 'Cantona', 'Papin', 'Makélélé', 'Pires'],
  },
};

const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/** `perRole` players for each role, ordered FW, MF, DF, GK. */
export function randomPlayers(league: string, perRole = 3): DraftPlayer[] {
  const pool = NAMES[league] ?? NAMES.English;
  const used = new Set<string>();
  const players: DraftPlayer[] = [];

  for (const position of PLAYER_ROLES) {
    for (let k = 0; k < perRole; ) {
      const name = `${pick(pool.first)} ${pick(pool.last)}`;
      if (used.has(name)) continue;
      used.add(name);
      players.push({ id: `${position}-${k}-${name}`, name, position });
      k++;
    }
  }
  return players;
}
