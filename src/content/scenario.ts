// Vesper Station on the morning of day one, and the forecast the seed draws
// from. Names and numbers that the player reads live here; the rules that move
// them live in src/engine/world.ts.

import type { Rng } from "../engine/rng";
import type { SectorId, Tonight, Weather, World } from "../engine/types";

export const COLONY_NAME = "Vesper Station";
export const RUN_DAYS = 14;
export const ORDERS_PER_DAY = 3;
export const INITIAL_POPULATION = 184;

export const SECTOR_NAME: Record<SectorId, string> = {
  core: "Core",
  habitat: "Habitat",
  works: "Works",
  infirmary: "Infirmary",
  perimeter: "Perimeter",
};

export const SECTOR_LETTER: Record<SectorId, string> = {
  core: "A",
  habitat: "B",
  works: "C",
  infirmary: "D",
  perimeter: "P",
};

export const CREW_SIZE = { security: 12, logistics: 10, medical: 8, engineering: 10 } as const;

/** Fuel economics, in units. */
export const FUEL = {
  /** The main generator at full output, per night. */
  generatorNight: 8,
  /** The pumps on backup, per night. */
  pumpsNight: 10,
  /** One truck, one round trip inside the colony or to the reservoir. */
  truckTrip: 6,
  /** One truck to the pass and back. */
  convoyTrip: 10,
  /** Portable heaters for a day of thawing. */
  thawDay: 4,
} as const;

/** Cold thresholds. */
export const COLD = {
  /** Below this, an unheated sector hurts the people in it. */
  injuryTemp: -5,
  /** Below this, unheated pipes in Works freeze overnight. */
  freezeTemp: -10,
} as const;

export function initialWorld(): World {
  return {
    day: 1,
    weather: { kind: "cold", tempC: -8 },
    power: { output: 0.74, reserve: 0.8, generatorHealth: 0.78, shedding: false, reservePolicy: "hold", priority: null, isolated: 0 },
    water: { days: 4.0, pumpHealth: 0.8, pumpsFuelled: false, pipesFrozen: false, contaminated: false },
    food: { days: 11.0, ration: "full" },
    medicine: { stock: 0.55, policy: "full", safe: false, ward: "infirmary" },
    fuel: { units: 120, safe: false, reservedForPumps: false, priority: "generator" },
    vehicles: { operational: 3, total: 4, held: false },
    shelter: { integrity: 0.85 },
    security: { perimeter: 0.8, threat: 0.2, contact: "unknown", admitted: 0, guarded: false, reliefDay: null, reliefLost: false },
    morale: 0.62,
    people: { total: INITIAL_POPULATION, injured: 9, critical: 2, trapped: 0, evacuated: 0, dead: 0 },
    sectors: {
      core: { fire: 0, damage: 0.05, heated: true, people: 20 },
      habitat: { fire: 0, damage: 0.1, heated: true, people: 130 },
      works: { fire: 0, damage: 0.1, heated: true, people: 14 },
      infirmary: { fire: 0, damage: 0, heated: true, people: 20 },
      perimeter: { fire: 0, damage: 0.15, heated: false, people: 0 },
    },
    crews: {
      security: { size: CREW_SIZE.security, fatigue: 0.1, injured: 0, dead: 0 },
      logistics: { size: CREW_SIZE.logistics, fatigue: 0.1, injured: 0, dead: 0 },
      medical: { size: CREW_SIZE.medical, fatigue: 0.2, injured: 0, dead: 0 },
      engineering: { size: CREW_SIZE.engineering, fatigue: 0.2, injured: 0, dead: 0 },
    },
    crises: [],
    roadOpen: false,
    lowMoraleDays: 0,
    tonight: freshTonight(),
  };
}

export function freshTonight(): Tonight {
  return { escort: false, fireFought: {}, treatment: 0, coldResponse: false, fieldTeam: false, shored: 0, quarantine: false, overrun: false, worked: {}, crewHoursUsed: {} };
}

/** Fourteen nights of weather from the seed: a cold plateau that gets colder, with one storm. */
export function forecast(rng: Rng, days: number): Weather[] {
  const stormDay = 5 + rng.int(6); // day 5..10
  const out: Weather[] = [];
  for (let d = 1; d <= days; d++) {
    const trend = -6 - d * 0.9; // -7 on day 1 down to about -19 on day 14
    const wobble = (rng.next() - 0.5) * 6;
    let tempC = Math.round(trend + wobble);
    let kind: Weather["kind"] = tempC <= -12 ? "cold" : tempC <= -3 ? "cold" : "clear";
    if (d === stormDay || d === stormDay + 1) {
      kind = "storm";
      tempC -= 6;
    }
    if (tempC > -2) kind = "clear";
    out.push({ kind, tempC });
  }
  return out;
}

/** What the movement outside really is. Drawn once per seed; the player learns it by looking. */
export function hiddenContact(rng: Rng): "refugees" | "raiders" | "relief" {
  const r = rng.next();
  return r < 0.42 ? "refugees" : r < 0.78 ? "raiders" : "relief";
}
