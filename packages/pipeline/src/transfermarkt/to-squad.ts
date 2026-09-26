import {
  parseSquadImport,
  type SquadImportFile,
  type SquadPlayer,
  type SquadTarget,
} from "@champion/shared";

import { countryCode } from "./nationality";
import type { TmSquadRow } from "./parse-squad";

export type SquadConversion = {
  players: SquadPlayer[];
  errors: string[];
  duplicates: number;
  unknownCountries: string[];
};

/**
 * Transfermarkt rows → SquadPlayer records for one club-season. Goes through the same
 * validation as the admin's JSON import (parseSquadImport), then adds the pipeline-only fields.
 * Birth year stays null: the page only shows age, which is ambiguous by one year.
 */
export function toSquadPlayers(rows: TmSquadRow[], target: SquadTarget, sourceUrl: string): SquadConversion {
  const unknownCountries = new Set<string>();
  const nationality = (row: TmSquadRow) => {
    const first = row.nationalities[0];
    if (!first) return null;
    const code = countryCode(first);
    if (!code) unknownCountries.add(first);
    return code;
  };

  const file: SquadImportFile = {
    version: 1,
    source: sourceUrl,
    players: rows.map((row) => ({
      name: row.name,
      position: row.role,
      nationality: nationality(row),
      birthYear: null,
      appearances: row.appearances,
      goals: row.goals,
    })),
  };

  const { players, errors, duplicates } = parseSquadImport(file, target);
  const byName = new Map(players.map((p) => [p.name, p]));
  for (const row of rows) {
    const player = byName.get(row.name.trim().replace(/\s+/g, " "));
    if (!player || player.tmPlayerId !== undefined) continue; // duplicate name: first row wins
    Object.assign(player, {
      tmPlayerId: row.tmPlayerId,
      detailedPosition: row.position || null,
      nationalities: row.nationalities.map((n) => countryCode(n) ?? n),
      age: row.age,
      inSquad: row.inSquad,
      assists: row.assists,
      minutes: row.minutes,
      subsOn: row.subsOn,
      subsOff: row.subsOff,
      yellowCards: row.yellowCards,
      secondYellowCards: row.secondYellowCards,
      redCards: row.redCards,
      pointsPerGame: row.pointsPerGame,
    } satisfies Partial<SquadPlayer>);
  }

  return {
    players,
    errors: errors.map((e) => `${e.path}: ${e.message}`),
    duplicates,
    unknownCountries: [...unknownCountries],
  };
}
