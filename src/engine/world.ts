// The physics of Vesper Station. Every change to the world goes through
// `change`, which records an Effect with a cause and a sentence, so the
// debrief can show where every number came from. The night tick here is the
// cascade engine: power decides heat, heat decides pipes and injuries, fuel
// decides power and pumps, pumps decide water, and so on. Crisis templates
// live in src/content and are applied by src/engine/tick.ts.

import { COLD, FUEL } from "../content/scenario";
import type { Rng } from "./rng";
import type { Department, Effect, SectorId, Weather, World } from "./types";

export const PHYS = {
  /** Fraction of nominal demand that is lights, pumps and command. */
  baseLoad: 0.4,
  /** Load shed removes this much. */
  shedSaves: 0.1,
  /** Heating demand per sector on a -15 C night; scaled by how cold it is. */
  heat: { core: 0.04, habitat: 0.16, works: 0.06, infirmary: 0.07, perimeter: 0 } as Record<SectorId, number>,
  /** Below this temperature heating is needed at all. */
  heatTemp: 0,
  /** Heating demand is this fraction of nominal per degree below zero, from 0.3 to 1.3. */
  heatPerDegree: 1 / 15,
  /** The generator never burns less than this fraction of its full-load fuel. */
  idleBurn: 0.45,
  /** The battery can cover at most this much demand in a night. */
  reserveMaxDraw: 0.5,
  /** Cutting order when supply falls short; a priority sector is moved to the end. */
  cutOrder: ["core", "works", "habitat", "infirmary"] as SectorId[],
  /** Days of water a healthy pump adds per night at full power. */
  pumpYield: 1.3,
  waterCap: 6,
  waterUse: 1,
  foodUse: { full: 1, reduced: 0.65, minimal: 0.42 },
  /** Nightly patient transitions. */
  patients: {
    injuredToCriticalTreated: 0.04,
    injuredToCriticalUntreated: 0.14,
    criticalDeathTreated: 0.045,
    criticalDeathUntreatedNoMedicine: 0.16,
    criticalDeathUntreated: 0.22,
    injuredRecoverTreated: 0.22,
    injuredRecoverUntreated: 0.1,
    criticalImproveTreated: 0.18,
    /** Medicine used per ten patients treated in a night. */
    medicinePerTen: 0.02,
  },
  trapped: { injure: 0.08, critical: 0.04 },
  fireSpread: 0.15,
  fireStormBonus: 0.06,
  moraleHome: 0.55,
  moraleDrift: 0.12,
  mutinyLine: 0.15,
  mutinyDays: 3,
} as const;

export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
/** "1 patient" / "3 patients". */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const clamp01 = (x: number) => clamp(x, 0, 1);
export const r3 = (x: number) => Math.round(x * 1000) / 1000;

export interface Recorder {
  effects: Effect[];
  cause: string;
}

export function recorder(cause: string): Recorder {
  return { effects: [], cause };
}

function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function setPath(obj: unknown, path: string, value: unknown): void {
  const keys = path.split(".");
  let cur = obj as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]] as Record<string, unknown>;
  cur[keys[keys.length - 1]] = value;
}

/** Sets a value on the world and records the change. Numbers are rounded to three decimals; no-ops are not recorded. */
export function change(w: World, rec: Recorder, path: string, to: number | string | boolean, note: string): void {
  const from = getPath(w, path) as number | string | boolean;
  const next = typeof to === "number" ? r3(to) : to;
  if (from === next) return;
  setPath(w, path, next);
  rec.effects.push({ path, from, to: next, cause: rec.cause, note });
}

/** Adds to a numeric path, clamped, and records it. */
export function add(w: World, rec: Recorder, path: string, delta: number, note: string, lo = -Infinity, hi = Infinity): number {
  const from = getPath(w, path) as number;
  const to = clamp(from + delta, lo, hi);
  change(w, rec, path, to, note);
  return to - from;
}

/** Healthy colonists: everyone alive inside who is not a patient or trapped. */
export function healthy(w: World): number {
  return Math.max(0, w.people.total - w.people.injured - w.people.critical - w.people.trapped);
}

/** Moves healthy colonists onto the injured list. Returns how many. */
export function injure(w: World, rec: Recorder, n: number, note: string): number {
  const k = Math.min(Math.round(n), healthy(w));
  if (k <= 0) return 0;
  add(w, rec, "people.injured", k, note);
  return k;
}

/** Kills colonists: the critical first, then the injured, then the healthy. */
export function kill(w: World, rec: Recorder, n: number, note: string): number {
  let left = Math.min(Math.round(n), w.people.total);
  if (left <= 0) return 0;
  const total = left;
  const fromCritical = Math.min(left, w.people.critical);
  if (fromCritical) {
    add(w, rec, "people.critical", -fromCritical, note);
    left -= fromCritical;
  }
  const fromInjured = Math.min(left, w.people.injured);
  if (fromInjured) {
    add(w, rec, "people.injured", -fromInjured, note);
    left -= fromInjured;
  }
  add(w, rec, "people.total", -total, note);
  add(w, rec, "people.dead", total, note);
  // Take the dead out of the sector that holds the most people.
  const busiest = (Object.keys(w.sectors) as SectorId[]).sort((a, b) => w.sectors[b].people - w.sectors[a].people)[0];
  add(w, rec, `sectors.${busiest}.people`, -total, note, 0);
  return total;
}

/** Moves people between sectors, bounded by who is there. */
export function movePeople(w: World, rec: Recorder, from: SectorId, to: SectorId, n: number, note: string): number {
  const k = Math.min(Math.round(n), w.sectors[from].people);
  if (k <= 0) return 0;
  add(w, rec, `sectors.${from}.people`, -k, note, 0);
  add(w, rec, `sectors.${to}.people`, k, note);
  return k;
}

/** Sends colonists out of the colony for good. Only the healthy and the injured travel. */
export function evacuateOut(w: World, rec: Recorder, from: SectorId, n: number, note: string): number {
  const movable = Math.max(0, w.sectors[from].people - (from === "habitat" ? w.people.trapped : 0));
  const k = Math.min(Math.round(n), movable, w.people.total - w.people.critical - w.people.trapped);
  if (k <= 0) return 0;
  add(w, rec, `sectors.${from}.people`, -k, note, 0);
  add(w, rec, "people.total", -k, note);
  add(w, rec, "people.evacuated", k, note);
  // Injured travel in proportion.
  const injuredShare = Math.min(w.people.injured, Math.round((k * w.people.injured) / Math.max(1, w.people.total + k)));
  if (injuredShare) add(w, rec, "people.injured", -injuredShare, note);
  return k;
}

/** Hours a crew can give today: eight per head, less fatigue and injuries. */
export function crewHours(w: World, d: Department): number {
  const c = w.crews[d];
  const fit = Math.max(0, c.size - c.injured - c.dead);
  return Math.round(fit * 8 * (1 - 0.5 * c.fatigue));
}

/** Fuel that trucks may burn today: everything above what the night is owed at full load. */
export function fuelForTrucks(w: World): number {
  const owed = FUEL.generatorNight * Math.min(1, w.power.generatorHealth) + (w.fuel.reservedForPumps ? FUEL.pumpsNight : 0);
  return Math.max(0, Math.floor(w.fuel.units - owed));
}

export function generatorOutput(w: World): number {
  const cap = w.power.isolated > 0 ? 0.4 : 1;
  const overrun = w.tonight.overrun ? 1.15 : 1;
  return r3(clamp(w.power.generatorHealth * 0.95 * overrun, 0, cap));
}

/** Heating demand for the night, before any cuts. */
function heatingDemand(w: World, tempC: number): Partial<Record<SectorId, number>> {
  if (tempC >= PHYS.heatTemp) return {};
  const cold = clamp(-tempC * PHYS.heatPerDegree, 0.3, 1.3);
  const out: Partial<Record<SectorId, number>> = {};
  for (const s of Object.keys(PHYS.heat) as SectorId[]) {
    if (PHYS.heat[s] > 0) out[s] = r3(PHYS.heat[s] * cold * (w.sectors[s].people > 0 || s === "works" ? 1 : 0.3));
  }
  return out;
}

export interface NightContext {
  weather: Weather;
  /** What the movement outside really is. */
  contactTruth: "refugees" | "raiders" | "relief";
  rng: Rng;
}

/**
 * The night. Runs after the day's actions have been applied. Returns the same
 * world object, mutated, with every change recorded on `rec`.
 */
export function nightTick(w: World, rec: Recorder, ctx: NightContext): void {
  const { weather, rng } = ctx;
  const t = w.tonight;
  change(w, rec, "weather.kind", weather.kind, `Night: ${weather.kind}, ${weather.tempC} C.`);
  change(w, rec, "weather.tempC", weather.tempC, `Night: ${weather.kind}, ${weather.tempC} C.`);

  // 1. Fuel for the night: generator and pumps, in the stated priority. The
  // generator burns in proportion to the load it will carry, with an idle floor.
  const heat = heatingDemand(w, weather.tempC);
  let demand = PHYS.baseLoad - (w.power.shedding ? PHYS.shedSaves : 0);
  for (const s of Object.keys(heat) as SectorId[]) demand += heat[s] ?? 0;
  const genNeed = r3(FUEL.generatorNight * clamp(Math.min(demand, generatorOutput(w)), PHYS.idleBurn, 1));
  const pumpsWant = !w.water.pipesFrozen && w.water.pumpHealth > 0.05 && (w.fuel.reservedForPumps || w.fuel.priority === "pumps") ? FUEL.pumpsNight : 0;
  let fuel = w.fuel.units;
  let genFuelled = false;
  let pumpsFuelled = false;
  const order: ("generator" | "pumps")[] = w.fuel.priority === "pumps" ? ["pumps", "generator"] : ["generator", "pumps"];
  for (const who of order) {
    if (who === "generator" && fuel >= genNeed && genNeed > 0) {
      fuel -= genNeed;
      genFuelled = true;
    } else if (who === "pumps" && pumpsWant > 0 && fuel >= pumpsWant) {
      fuel -= pumpsWant;
      pumpsFuelled = true;
    }
  }
  if (genNeed > 0 && !genFuelled) {
    // Run on what is left, degraded.
    const part = fuel / genNeed;
    fuel = 0;
    change(w, rec, "power.output", r3(generatorOutput(w) * part), `Fuel ran out. The generator ran at ${Math.round(part * 100)}% of its output.`);
  } else {
    change(w, rec, "power.output", generatorOutput(w), w.power.isolated > 0 ? "The generator is isolated. Output is capped at 40%." : "Generator output for the night.");
  }
  change(w, rec, "fuel.units", r3(fuel), `Night fuel: generator ${genFuelled ? genNeed : 0}, pumps ${pumpsFuelled ? pumpsWant : 0}.`);
  change(w, rec, "water.pumpsFuelled", pumpsFuelled, pumpsFuelled ? "Pumps ran on fuel." : "No fuel set aside for the pumps.");
  change(w, rec, "fuel.reservedForPumps", false, "The night's fuel reservation is spent.");
  if (w.power.isolated > 0) change(w, rec, "power.isolated", w.power.isolated - 1, "One more night of isolation done.");

  // 2. Power balance: base load plus heating; battery bridges only if allowed; cut sectors in order.
  let supply = w.power.output;
  let reserveDraw = 0;
  if (supply < demand && w.power.reservePolicy === "bridge" && w.power.reserve > 0) {
    reserveDraw = Math.min(demand - supply, PHYS.reserveMaxDraw, w.power.reserve);
    supply += reserveDraw;
    add(w, rec, "power.reserve", -reserveDraw, `Battery covered ${Math.round(reserveDraw * 100)}% of demand overnight.`, 0, 1);
  }
  let deficit = Math.max(0, demand - supply);
  const cutOrder = [...PHYS.cutOrder.filter((s) => s !== w.power.priority), ...(w.power.priority ? [w.power.priority] : [])];
  const heated: Record<SectorId, boolean> = { core: true, habitat: true, works: true, infirmary: true, perimeter: false };
  for (const s of cutOrder) {
    if (deficit <= 0.001) break;
    const h = heat[s] ?? 0;
    if (h > 0) {
      heated[s] = false;
      deficit -= h;
    }
  }
  const powered = deficit <= 0.001;
  for (const s of ["core", "habitat", "works", "infirmary"] as SectorId[]) {
    const on = heated[s] && (heat[s] === undefined || powered || heated[s]);
    change(w, rec, `sectors.${s}.heated`, weather.tempC >= PHYS.heatTemp ? true : on, on ? `${s} was heated overnight.` : `${s} was unheated. Supply was ${Math.round(supply * 100)}% of nominal against demand ${Math.round(demand * 100)}%.`);
  }
  const pumpsPowered = powered || (supply >= PHYS.baseLoad - (w.power.shedding ? PHYS.shedSaves : 0));

  // 3. Cold: unheated sectors hurt the people in them; unheated Works freezes the pipes.
  if (weather.tempC < COLD.injuryTemp) {
    const severity = clamp01((COLD.injuryTemp - weather.tempC) / 15);
    for (const s of ["habitat", "core", "works"] as SectorId[]) {
      if (!w.sectors[s].heated && w.sectors[s].people > 0) {
        const base = w.sectors[s].people * 0.05 * severity * (t.coldResponse ? 0.4 : 1);
        const n = Math.round(base + rng.next() * 2);
        injure(w, rec, n, `Cold injuries in ${s}: ${plural(n, "colonist")}, ${weather.tempC} C and no heat.`);
        add(w, rec, "morale", s === "habitat" ? -0.02 : -0.01, `The cold in ${s} lowered morale.`, 0, 1);
      }
    }
    if (!w.sectors[w.medicine.ward].heated && w.people.critical > 0) {
      const n = Math.round(w.people.critical * 0.12 * (t.coldResponse ? 0.5 : 1) + rng.next() * 0.6);
      if (n > 0) kill(w, rec, n, `${plural(n, "critical patient")} died in an unheated ward (${w.medicine.ward}).`);
    }
    if (weather.tempC < COLD.freezeTemp && !w.sectors.works.heated && !w.water.pipesFrozen) {
      change(w, rec, "water.pipesFrozen", true, `Pipes froze in Works overnight at ${weather.tempC} C with no heat.`);
    }
  }

  // 4. Fire: spreads unless fought, eats the generator in Core and the roof in Habitat.
  for (const s of ["core", "habitat", "works", "infirmary"] as SectorId[]) {
    const sec = w.sectors[s];
    if (sec.fire <= 0) continue;
    const fought = t.fireFought[s] ?? 0;
    const spread = PHYS.fireSpread + (weather.kind === "storm" ? PHYS.fireStormBonus : 0);
    const next = clamp01(sec.fire + spread - fought * 0.55);
    change(w, rec, `sectors.${s}.fire`, next, fought ? `The fire in ${s} was fought at ${Math.round(fought * 100)}%.` : `The fire in ${s} spread.`);
    if (next > 0) {
      add(w, rec, `sectors.${s}.damage`, next * 0.12, `The fire damaged ${s}.`, 0, 1);
      if (s === "core" && w.power.isolated === 0) add(w, rec, "power.generatorHealth", -next * 0.12, "The fire damaged the generator.", 0.05, 1);
      if (s === "core" && next >= 0.7 && w.power.isolated === 0) add(w, rec, "power.reserve", -0.15, "The fire reached the battery room.", 0, 1);
      if (s === "habitat") add(w, rec, "shelter.integrity", -next * 0.1, "The fire damaged the habitat roof.", 0, 1);
      if (s === "infirmary" && !w.medicine.safe) add(w, rec, "medicine.stock", -next * 0.15, "The fire destroyed medicine stock.", 0, 1);
      if (s === "works" && !w.fuel.safe) add(w, rec, "fuel.units", -Math.round(next * 8), "The fire destroyed fuel in the depot.", 0);
      if (sec.people > 0) injure(w, rec, Math.round(sec.people * next * 0.03 + rng.next()), `The fire injured colonists in ${s}.`);
    }
    if (w.sectors[s].damage >= 0.98) change(w, rec, `sectors.${s}.fire`, 0, `The fire in ${s} burned out.`);
  }

  // 5. Water: pumps need grid power or fuel; frozen pipes halve them.
  const pumping = w.water.pumpHealth * (pumpsPowered ? 1 : pumpsFuelled ? 0.9 : 0) * (w.water.pipesFrozen ? 0.5 : 1) * PHYS.pumpYield;
  const water = clamp(w.water.days + pumping - PHYS.waterUse, 0, PHYS.waterCap);
  change(w, rec, "water.days", water, pumping > 0 ? `The pumps added ${pumping.toFixed(1)} days of water. The colony used one day.` : "The pumps did not run. The colony used one day of water.");
  if (water <= 0) {
    injure(w, rec, 6 + rng.int(4), "The water tanks are empty. Colonists are dehydrated.");
    add(w, rec, "morale", -0.06, "No water lowered morale.", 0, 1);
  }
  if (w.water.contaminated && !t.quarantine) injure(w, rec, 4 + rng.int(3), "Sickness from contaminated water.");

  // 6. Food.
  const eat = PHYS.foodUse[w.food.ration];
  change(w, rec, "food.days", Math.max(0, w.food.days - eat), `Rations ${w.food.ration}. The colony used ${eat === 1 ? "one day" : `${eat} days`} of food.`);
  if (w.food.days <= 0) {
    injure(w, rec, 5 + rng.int(3), "The food stores are empty. Colonists are hungry.");
    add(w, rec, "morale", -0.08, "No food lowered morale.", 0, 1);
  } else if (w.food.ration === "reduced") add(w, rec, "morale", -0.01, "Reduced rations lowered morale.", 0, 1);
  else if (w.food.ration === "minimal") add(w, rec, "morale", -0.025, "Minimal rations lowered morale.", 0, 1);

  // 7. Patients: treatment depends on policy, medicine, a heated and powered infirmary, and the medical crew.
  const P = PHYS.patients;
  const staff = w.crews.medical;
  const staffFactor = clamp01(((staff.size - staff.injured - staff.dead) / staff.size) * (1 - 0.5 * staff.fatigue));
  const ward = w.medicine.ward;
  const wardOk = w.sectors[ward].heated && w.sectors[ward].fire < 0.3;
  const treatAll = w.medicine.policy === "full" && w.medicine.stock > 0.02;
  const treatCritical = w.medicine.stock > 0.02;
  const effort = clamp01((0.6 + 0.4 * t.treatment) * staffFactor * (wardOk ? 1 : 0.5));
  const patients = w.people.injured + w.people.critical;
  let deaths = 0;
  {
    const inj = w.people.injured;
    const crit = w.people.critical;
    const toCrit = Math.round(inj * (treatAll ? P.injuredToCriticalTreated / Math.max(0.3, effort) : P.injuredToCriticalUntreated) * (rng.next() * 0.4 + 0.8));
    const recovered = Math.round(inj * (treatAll ? P.injuredRecoverTreated * effort : P.injuredRecoverUntreated));
    const critDeathRate = treatCritical ? P.criticalDeathTreated / Math.max(0.3, effort) : w.medicine.stock > 0.02 ? P.criticalDeathUntreatedNoMedicine : P.criticalDeathUntreated;
    deaths = Math.round(crit * critDeathRate * (rng.next() * 0.5 + 0.75));
    const improved = Math.round(crit * (treatCritical ? P.criticalImproveTreated * effort : 0));
    if (toCrit) {
      const note = `${plural(toCrit, "injured colonist")} became critical overnight${treatAll ? "" : " without treatment"}.`;
      add(w, rec, "people.critical", toCrit, note);
      add(w, rec, "people.injured", -toCrit, note, 0);
    }
    if (recovered) add(w, rec, "people.injured", -recovered, `${plural(recovered, "patient")} recovered.`, 0);
    if (improved) {
      const note = `${plural(improved, "critical patient")} stabilised.`;
      add(w, rec, "people.critical", -improved, note, 0);
      add(w, rec, "people.injured", improved, note);
    }
    if (deaths) kill(w, rec, deaths, `${plural(deaths, "critical patient")} died overnight${treatCritical ? "" : " with no medicine"}.`);
    const treated = treatAll ? patients : treatCritical ? crit : 0;
    if (treated > 0) add(w, rec, "medicine.stock", -(treated / 10) * P.medicinePerTen * (0.7 + 0.6 * effort), `Medicine used on ${treated} patients.`, 0, 1);
  }

  // 8. The trapped deteriorate.
  if (w.people.trapped > 0) {
    const coldFactor = !w.sectors.habitat.heated && weather.tempC < COLD.injuryTemp ? 2 : 1;
    const toInjured = Math.round(w.people.trapped * PHYS.trapped.injure * coldFactor + rng.next() * 0.6);
    const toCritical = Math.round(w.people.trapped * PHYS.trapped.critical * coldFactor + rng.next() * 0.6);
    const n = Math.min(w.people.trapped, toInjured + toCritical);
    if (n > 0) {
      add(w, rec, "people.trapped", -n, `${n} of the trapped ${n === 1 ? "was" : "were"} injured overnight. They are still trapped.`, 0);
      add(w, rec, "people.injured", Math.min(n, toInjured), "Trapped colonists are injured.");
      if (n - Math.min(n, toInjured) > 0) add(w, rec, "people.critical", n - Math.min(n, toInjured), "Trapped colonists are critical.");
      // Still under the rubble: count them as trapped again for rescue purposes.
      add(w, rec, "people.trapped", n, "The injured trapped are still trapped.");
    }
  }

  // 9. Crews rest a little.
  for (const d of Object.keys(w.crews) as Department[]) {
    const worked = t.worked[d] ?? 0;
    const delta = worked > 0 ? worked * 0.28 - 0.12 : -0.2;
    add(w, rec, `crews.${d}.fatigue`, delta, worked > 0 ? `The ${d} crew worked. Fatigue ${delta > 0 ? "increased" : "decreased"}.` : `The ${d} crew rested.`, 0, 1);
    if (w.crews[d].injured > 0 && rng.next() < 0.5) add(w, rec, `crews.${d}.injured`, -1, `A ${d} crew member is back on duty.`, 0);
  }

  // 10. The threat outside.
  const sec = w.security;
  if (sec.contact === "unknown") add(w, rec, "security.threat", 0.05, "The contact outside is not identified. Threat increased.", 0, 1);
  else if (sec.contact === "raiders") add(w, rec, "security.threat", sec.guarded ? -0.02 : 0.07, sec.guarded ? "The gate was guarded. Threat decreased." : "Raiders probed the fence. Threat increased.", 0, 1);
  else if (sec.contact === "refugees") {
    add(w, rec, "security.threat", -0.03, "The refugees outside are waiting. Threat decreased.", 0, 1);
    if (sec.admitted === 0 && weather.tempC < -8) add(w, rec, "morale", -0.02, "Refugees remain outside the gate in the cold. Morale fell.", 0, 1);
  } else if (sec.contact === "relief") {
    add(w, rec, "security.threat", -0.05, "The relief scouts are camped at the pass. Threat decreased.", 0, 1);
    if (sec.reliefDay !== null && w.day + 1 >= sec.reliefDay && !w.roadOpen) change(w, rec, "roadOpen", true, "The relief column reached the pass. The road out is open.");
  }
  if ((sec.contact === "raiders" || sec.contact === "unknown") && w.security.threat > 0.6) {
    const chance = (w.security.threat - 0.4) * (1 - w.security.perimeter * 0.8) * (sec.guarded ? 0.35 : 1);
    if (rng.next() < chance) {
      const fuelLost = Math.min(w.fuel.units, 12 + rng.int(8));
      add(w, rec, "fuel.units", -fuelLost, `Raid: ${fuelLost} fuel taken from the depot.`, 0);
      add(w, rec, "food.days", -0.8, "Raid: food stores looted.", 0);
      injure(w, rec, 2 + rng.int(3), "Raid: colonists hurt at the fence.");
      add(w, rec, "security.perimeter", -0.15, "Raid: the fence was cut.", 0, 1);
      add(w, rec, "security.threat", -0.25, "The raiders withdrew. Threat decreased.", 0, 1);
      add(w, rec, "morale", -0.08, "The raid lowered morale.", 0, 1);
      if (sec.contact === "unknown") change(w, rec, "security.contact", "raiders", "The contact outside is raiders.");
    }
  }
  change(w, rec, "security.guarded", false, "The guard stands down at dawn.");

  // 11. Morale drifts home, then pays for the night, and earns a little when the basics hold.
  add(w, rec, "morale", (PHYS.moraleHome - w.morale) * PHYS.moraleDrift, "Morale settles toward its resting level.", 0, 1);
  if (deaths > 0) add(w, rec, "morale", -Math.min(0.12, deaths * 0.02), `${plural(deaths, "death")} in the night.`, 0, 1);
  if (w.power.shedding) add(w, rec, "morale", -0.01, "Load shedding lowered morale.", 0, 1);
  if (w.crises.length) add(w, rec, "morale", -Math.min(0.015, 0.005 * w.crises.length), `${plural(w.crises.length, "crisis", "crises")} unresolved. Morale fell.`, 0, 1);
  if (w.sectors.habitat.heated && deaths === 0 && w.food.ration === "full" && w.water.days > 1) add(w, rec, "morale", 0.012, "The habitat was heated, rations were full and nobody died. Morale rose.", 0, 1);
  change(w, rec, "lowMoraleDays", w.morale < PHYS.mutinyLine ? w.lowMoraleDays + 1 : 0, w.morale < PHYS.mutinyLine ? "Morale below the mutiny line." : "Morale above the mutiny line.");
}

/** A colony-wide summary number 0..1 for infrastructure. */
export function infrastructureScore(w: World): number {
  return r3(clamp01(0.35 * w.power.generatorHealth + 0.25 * w.water.pumpHealth + 0.2 * w.shelter.integrity + 0.1 * w.security.perimeter + 0.1 * (w.vehicles.operational / Math.max(1, w.vehicles.total))));
}

/** A colony-wide summary number 0..1 for resource security. */
export function resourceScore(w: World): number {
  return r3(clamp01(0.3 * clamp01(w.water.days / 4) + 0.25 * clamp01(w.food.days / 8) + 0.25 * clamp01(w.fuel.units / 80) + 0.2 * w.medicine.stock));
}
