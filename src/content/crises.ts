// Crisis templates. A crisis is spawned from state by the night tick, sits in
// `world.crises` while its condition holds, worsens when nobody acts on it,
// and resolves itself when the world says it is over. Nothing here branches
// on a story; every template is a rule about the state.

import { add, change, injure, kill, type Recorder } from "../engine/world";
import type { Rng } from "../engine/rng";
import type { ActiveCrisis, SectorId, World } from "../engine/types";

export interface CrisisTemplate {
  id: string;
  /** Noun phrase as the map and the situation list show it. */
  title: string;
  sector: SectorId | ((w: World) => SectorId);
  /** Relative chance of being drawn on a night it is possible. */
  weight: number;
  /** Earliest day it can appear. */
  fromDay?: number;
  /** Only one at a time, and never again once resolved when true. */
  once?: boolean;
  requires(w: World): boolean;
  /** The night it starts. */
  onStart(w: World, rec: Recorder, rng: Rng): void;
  /** Each further night it is unresolved. */
  onNight?(w: World, rec: Recorder, c: ActiveCrisis, rng: Rng): void;
  resolved(w: World, c: ActiveCrisis): boolean;
  /** The line the judge and the player see. */
  describe(w: World, c: ActiveCrisis): string;
  /** Departments whose action library speaks to it, for initiative. */
  concerns: ("security" | "logistics" | "medical" | "engineering")[];
}

const T = (t: CrisisTemplate) => t;
const pct = (x: number) => `${Math.round(x * 100)}%`;

export const CRISES: readonly CrisisTemplate[] = [
  T({
    id: "generator_fire",
    title: "generator fire",
    sector: "core",
    weight: 2,
    fromDay: 2,
    requires: (w) => w.sectors.core.fire === 0 && w.power.generatorHealth < 0.74,
    onStart: (w, rec) => {
      add(w, rec, "sectors.core.fire", 0.35, "A fire started in the generator hall.", 0, 1);
      add(w, rec, "morale", -0.04, "The fire lowered morale.", 0, 1);
    },
    resolved: (w) => w.sectors.core.fire === 0,
    describe: (w) => `Sector A, Core: generator fire at ${pct(w.sectors.core.fire)}${w.sectors.core.fire > 0.6 ? ", near the battery room" : ""}. Output ${pct(w.power.output)}.`,
    concerns: ["engineering", "logistics"],
  }),
  T({
    id: "roof_collapse",
    title: "roof collapse",
    sector: "habitat",
    weight: 3,
    fromDay: 1,
    once: true,
    requires: (w) => w.people.trapped === 0 && w.shelter.integrity < 0.9 && w.sectors.habitat.people > 40,
    onStart: (w, rec, rng) => {
      const n = 14 + rng.int(12);
      add(w, rec, "people.trapped", n, `A roof section collapsed in the habitat. ${n} colonists are trapped.`);
      add(w, rec, "shelter.integrity", -0.2, "The habitat roof failed.", 0, 1);
      add(w, rec, "morale", -0.06, "The collapse lowered morale.", 0, 1);
    },
    resolved: (w) => w.people.trapped === 0,
    describe: (w, c) => `Sector B, Habitat: ${w.people.trapped} colonists trapped under a collapsed roof section, day ${w.day - c.dayStarted + 1}.`,
    concerns: ["security", "engineering", "medical"],
  }),
  T({
    id: "second_collapse",
    title: "second collapse",
    sector: "habitat",
    weight: 2,
    fromDay: 4,
    once: true,
    requires: (w) => w.people.trapped === 0 && w.shelter.integrity < 0.45 && w.sectors.habitat.people > 40,
    onStart: (w, rec, rng) => {
      const n = 8 + rng.int(8);
      add(w, rec, "people.trapped", n, `A second section of the habitat roof collapsed. ${n} colonists are trapped.`);
      add(w, rec, "shelter.integrity", -0.15, "The habitat roof failed again.", 0, 1);
      add(w, rec, "morale", -0.06, "The second collapse lowered morale.", 0, 1);
    },
    resolved: (w) => w.people.trapped === 0,
    describe: (w, c) => `Sector B, Habitat: ${w.people.trapped} colonists trapped under a second roof collapse, day ${w.day - c.dayStarted + 1}.`,
    concerns: ["security", "engineering", "medical"],
  }),
  T({
    id: "pump_failure",
    title: "pump failure",
    sector: "works",
    weight: 3,
    requires: (w) => w.water.pumpHealth > 0.45,
    onStart: (w, rec) => {
      add(w, rec, "water.pumpHealth", -0.4, "A pump seized.", 0, 1);
    },
    resolved: (w) => w.water.pumpHealth >= 0.7,
    describe: (w) => `Sector C, Works: water pumps at ${pct(w.water.pumpHealth)}${w.water.pumpsFuelled ? ", on fuel backup" : w.power.output < 0.6 ? ", short of power" : ""}. ${w.water.days.toFixed(1)} days of water stored.`,
    concerns: ["engineering", "logistics"],
  }),
  T({
    id: "unknown_contact",
    title: "movement outside",
    sector: "perimeter",
    weight: 4,
    once: true,
    requires: (w) => w.security.contact === "unknown" && w.security.threat < 0.5,
    onStart: (w, rec) => {
      add(w, rec, "security.threat", 0.2, "Movement was seen outside the fence. Threat increased.", 0, 1);
    },
    resolved: (w) => w.security.contact !== "unknown",
    describe: (w) => `Perimeter: unknown movement outside the fence. Threat ${pct(w.security.threat)}.`,
    concerns: ["security"],
  }),
  T({
    id: "raiders_at_fence",
    title: "raiders at the fence",
    sector: "perimeter",
    weight: 3,
    requires: (w) => w.security.contact === "raiders" && w.security.threat > 0.35,
    onStart: (w, rec) => {
      add(w, rec, "security.threat", 0.1, "The raiders are testing the fence. Threat increased.", 0, 1);
    },
    resolved: (w) => w.security.contact !== "raiders" || w.security.threat < 0.25,
    describe: (w) => `Perimeter: an armed band near the fence. Threat ${pct(w.security.threat)}, gate ${pct(w.security.perimeter)}.`,
    concerns: ["security"],
  }),
  T({
    id: "refugees_at_gate",
    title: "refugees at the gate",
    sector: "perimeter",
    weight: 3,
    requires: (w) => w.security.contact === "refugees" && w.security.admitted === 0,
    onStart: (w, rec) => {
      add(w, rec, "morale", -0.02, "Families wait at the gate in the cold. Morale fell.", 0, 1);
    },
    onNight: (w, rec, c, rng) => {
      if (c.neglect >= 2 && w.weather.tempC < -10 && rng.next() < 0.5) add(w, rec, "morale", -0.03, "Someone died outside the gate overnight.", 0, 1);
    },
    resolved: (w) => w.security.contact !== "refugees" || w.security.admitted > 0,
    describe: () => `Perimeter: about thirty refugees at the gate, families on foot. They ask to come in.`,
    concerns: ["security", "logistics", "medical"],
  }),
  T({
    id: "relief_scouts",
    title: "relief scouts",
    sector: "perimeter",
    weight: 3,
    requires: (w) => w.security.contact === "relief" && w.security.reliefDay === null && !w.security.reliefLost,
    onStart: () => undefined,
    resolved: (w) => w.security.reliefDay !== null || w.security.reliefLost,
    describe: () => `Perimeter: scouts from a relief column are camped at the pass. Nobody has spoken to them.`,
    concerns: ["security"],
  }),
  T({
    id: "cold_snap",
    title: "cold snap",
    sector: "habitat",
    weight: 2,
    fromDay: 3,
    requires: (w) => w.weather.tempC < -10,
    onStart: (w, rec) => {
      add(w, rec, "power.generatorHealth", -0.03, "The cold reduced generator health.", 0, 1);
    },
    resolved: (w) => w.weather.tempC >= -8,
    describe: (w) => `Colony-wide: cold snap, ${w.weather.tempC} C tonight. ${["core", "habitat", "works", "infirmary"].filter((s) => !w.sectors[s as SectorId].heated).length} sectors were unheated last night.`,
    concerns: ["engineering", "medical", "logistics"],
  }),
  T({
    id: "frozen_pipes",
    title: "frozen pipes",
    sector: "works",
    weight: 4,
    requires: (w) => w.water.pipesFrozen,
    onStart: () => undefined,
    onNight: (w, rec, c) => {
      if (c.neglect >= 2) add(w, rec, "water.pumpHealth", -0.08, "Ice split a pipe.", 0, 1);
    },
    resolved: (w) => !w.water.pipesFrozen,
    describe: () => `Sector C, Works: pipes frozen. Pumping is halved until they are thawed.`,
    concerns: ["engineering"],
  }),
  T({
    id: "food_spoilage",
    title: "food spoilage",
    sector: "works",
    weight: 2,
    fromDay: 2,
    once: true,
    requires: (w) => w.food.days > 4 && (w.power.shedding || w.power.output < 0.6),
    onStart: (w, rec) => {
      add(w, rec, "food.days", -1.6, "The cold store thawed. 1.6 days of food spoiled.", 0);
      add(w, rec, "morale", -0.03, "The spoiled food lowered morale.", 0, 1);
    },
    resolved: () => true,
    describe: () => `Sector C, Works: the cold store thawed. Food was lost.`,
    concerns: ["logistics"],
  }),
  T({
    id: "contamination",
    title: "water contamination",
    sector: "works",
    weight: 2,
    fromDay: 3,
    once: true,
    requires: (w) => !w.water.contaminated && (w.water.pumpHealth < 0.5 || w.water.pipesFrozen),
    onStart: (w, rec) => {
      change(w, rec, "water.contaminated", true, "The water tanks are contaminated.");
      injure(w, rec, 5, "The contaminated water made colonists sick.");
    },
    onNight: () => undefined,
    resolved: (w, c) => {
      if (!w.water.contaminated) return true;
      if (w.tonight.quarantine && w.day - c.dayStarted >= 2) {
        w.water.contaminated = false;
        return true;
      }
      return false;
    },
    describe: (w) => `Sector C, Works: the water is contaminated. ${w.tonight.quarantine ? "Quarantine is in effect." : "Sickness is spreading."}`,
    concerns: ["medical", "engineering"],
  }),
  T({
    id: "accident",
    title: "workshop accident",
    sector: "works",
    weight: 2,
    requires: (w) => w.crews.engineering.fatigue > 0.5 || w.crews.logistics.fatigue > 0.5,
    onStart: (w, rec, rng) => {
      const n = 3 + rng.int(4);
      injure(w, rec, n, `A workshop accident injured ${n} colonists.`);
      add(w, rec, "people.critical", 1, "One of the injured is critical.");
      add(w, rec, "people.injured", -1, "One of the injured is critical.", 0);
    },
    resolved: () => true,
    describe: () => `Sector C, Works: a workshop accident. The injured are in the ward.`,
    concerns: ["medical"],
  }),
  T({
    id: "fuel_leak",
    title: "fuel leak",
    sector: "works",
    weight: 2,
    fromDay: 2,
    once: true,
    requires: (w) => w.fuel.units > 40 && !w.fuel.safe,
    onStart: (w, rec, rng) => {
      const lost = 8 + rng.int(8);
      add(w, rec, "fuel.units", -lost, `A drum split in the depot. ${lost} fuel was lost.`, 0);
    },
    resolved: () => true,
    describe: () => `Sector C, Works: a fuel drum split in the depot.`,
    concerns: ["logistics"],
  }),
  T({
    id: "perimeter_breach",
    title: "fence down",
    sector: "perimeter",
    weight: 2,
    requires: (w) => w.security.perimeter < 0.5,
    onStart: (w, rec) => {
      add(w, rec, "security.threat", 0.1, "A section of fence is down. Threat increased.", 0, 1);
    },
    resolved: (w) => w.security.perimeter >= 0.6,
    describe: (w) => `Perimeter: fence down along the east side. Gate ${pct(w.security.perimeter)}.`,
    concerns: ["security"],
  }),
  T({
    id: "outbreak",
    title: "sickness in the habitat",
    sector: "habitat",
    weight: 2,
    fromDay: 4,
    once: true,
    requires: (w) => w.sectors.core.people > 60 || w.food.ration === "minimal",
    onStart: (w, rec, rng) => {
      injure(w, rec, 6 + rng.int(6), "Sickness is spreading in the crowded rooms.");
    },
    onNight: (w, rec, _c, rng) => {
      if (!w.tonight.quarantine) injure(w, rec, 2 + rng.int(3), "The sickness spread.");
    },
    resolved: (w, c) => w.tonight.quarantine && w.day - c.dayStarted >= 2,
    describe: () => `Sector B, Habitat: sickness spreading through the crowded rooms.`,
    concerns: ["medical"],
  }),
  T({
    id: "habitat_fire",
    title: "habitat fire",
    sector: "habitat",
    weight: 2,
    fromDay: 3,
    requires: (w) => w.sectors.habitat.fire === 0 && (!w.sectors.habitat.heated || w.power.shedding),
    onStart: (w, rec) => {
      add(w, rec, "sectors.habitat.fire", 0.3, "A stove fire started in the housing blocks.", 0, 1);
      injure(w, rec, 3, "The fire burned colonists in the habitat.");
    },
    resolved: (w) => w.sectors.habitat.fire === 0,
    describe: (w) => `Sector B, Habitat: fire in the housing blocks at ${pct(w.sectors.habitat.fire)}.`,
    concerns: ["engineering", "security", "logistics"],
  }),
  T({
    id: "depot_fire",
    title: "depot fire",
    sector: "works",
    weight: 1,
    fromDay: 4,
    requires: (w) => w.sectors.works.fire === 0 && w.fuel.units > 30,
    onStart: (w, rec) => {
      add(w, rec, "sectors.works.fire", 0.4, "A fire started in the vehicle bay, next to the fuel.", 0, 1);
    },
    resolved: (w) => w.sectors.works.fire === 0,
    describe: (w) => `Sector C, Works: fire in the vehicle bay at ${pct(w.sectors.works.fire)}, next to the fuel drums.`,
    concerns: ["engineering", "logistics"],
  }),
  T({
    id: "infirmary_fire",
    title: "infirmary fire",
    sector: "infirmary",
    weight: 1,
    fromDay: 5,
    requires: (w) => w.sectors.infirmary.fire === 0 && w.medicine.ward === "infirmary" && !w.sectors.infirmary.heated,
    onStart: (w, rec) => {
      add(w, rec, "sectors.infirmary.fire", 0.3, "A heater fire started in the wards.", 0, 1);
    },
    resolved: (w) => w.sectors.infirmary.fire === 0,
    describe: (w) => `Sector D, Infirmary: fire in the wards at ${pct(w.sectors.infirmary.fire)}. ${w.people.injured + w.people.critical} patients are inside.`,
    concerns: ["engineering", "medical", "logistics"],
  }),
  T({
    id: "battery_fault",
    title: "battery fault",
    sector: "core",
    weight: 2,
    fromDay: 4,
    once: true,
    requires: (w) => w.power.reserve > 0.4 && w.power.reservePolicy === "bridge",
    onStart: (w, rec) => {
      add(w, rec, "power.reserve", -0.25, "A battery bank failed under load.", 0, 1);
    },
    resolved: () => true,
    describe: () => `Sector A, Core: a battery bank failed under load.`,
    concerns: ["engineering"],
  }),
  T({
    id: "vehicle_breakdown",
    title: "truck breakdown",
    sector: "works",
    weight: 2,
    requires: (w) => w.vehicles.operational >= 2,
    onStart: (w, rec) => {
      add(w, rec, "vehicles.operational", -1, "A truck broke down.", 0);
    },
    resolved: (w) => w.vehicles.operational >= w.vehicles.total - 1,
    describe: (w) => `Sector C, Works: ${w.vehicles.total - w.vehicles.operational} of ${w.vehicles.total} trucks are down.`,
    concerns: ["logistics"],
  }),
  T({
    id: "storm",
    title: "storm",
    sector: "perimeter",
    weight: 5,
    requires: (w) => w.weather.kind === "storm",
    onStart: (w, rec) => {
      add(w, rec, "shelter.integrity", -0.12, "The storm damaged the habitat roof.", 0, 1);
      add(w, rec, "security.perimeter", -0.1, "The storm damaged the fence.", 0, 1);
    },
    onNight: (w, rec) => {
      add(w, rec, "shelter.integrity", -0.06, "The storm damaged the habitat roof.", 0, 1);
    },
    resolved: (w) => w.weather.kind !== "storm",
    describe: (w) => `Colony-wide: storm, ${w.weather.tempC} C. Roads are closed. Habitat roof at ${pct(w.shelter.integrity)}.`,
    concerns: ["engineering", "logistics"],
  }),
  T({
    id: "protest",
    title: "protest in the habitat",
    sector: "habitat",
    weight: 3,
    requires: (w) => w.morale < 0.28,
    onStart: (w, rec) => {
      add(w, rec, "food.days", -0.5, "Colonists broke into the food stores.", 0);
      add(w, rec, "morale", -0.02, "The protest lowered morale.", 0, 1);
    },
    resolved: (w) => w.morale >= 0.35,
    describe: (w) => `Sector B, Habitat: protest. Morale ${pct(w.morale)}. Colonists broke into the food stores.`,
    concerns: ["security", "logistics"],
  }),
  T({
    id: "staff_exhaustion",
    title: "medical staff exhausted",
    sector: "infirmary",
    weight: 2,
    requires: (w) => w.crews.medical.fatigue > 0.8,
    onStart: (w, rec) => {
      add(w, rec, "crews.medical.injured", 1, "A medical crew member collapsed on shift.");
    },
    resolved: (w) => w.crews.medical.fatigue < 0.5,
    describe: (w) => `Sector D, Infirmary: the medical staff are exhausted. Fatigue ${pct(w.crews.medical.fatigue)}.`,
    concerns: ["medical"],
  }),
  T({
    id: "generator_overload",
    title: "generator overload",
    sector: "core",
    weight: 2,
    requires: (w) => w.tonight.overrun || (w.power.generatorHealth < 0.4 && w.power.output > 0.3),
    onStart: (w, rec) => {
      add(w, rec, "power.generatorHealth", -0.1, "The generator tripped under load.", 0, 1);
    },
    resolved: () => true,
    describe: () => `Sector A, Core: the generator tripped under load.`,
    concerns: ["engineering"],
  }),
  T({
    id: "trapped_dying",
    title: "trapped colonists failing",
    sector: "habitat",
    weight: 4,
    requires: (w) => w.people.trapped > 0 && w.crises.some((c) => c.template === "roof_collapse" && w.day - c.dayStarted >= 2),
    onStart: (w, rec, rng) => {
      const n = 1 + rng.int(2);
      kill(w, rec, n, `${n} of the trapped died.`);
      add(w, rec, "people.trapped", -n, "The trapped count decreased.", 0);
    },
    onNight: (w, rec, _c, rng) => {
      if (rng.next() < 0.5) {
        kill(w, rec, 1, "One of the trapped died in the night.");
        add(w, rec, "people.trapped", -1, "The trapped count decreased.", 0);
      }
    },
    resolved: (w) => w.people.trapped === 0,
    describe: (w) => `Sector B, Habitat: the trapped are dying. ${w.people.trapped} are still trapped.`,
    concerns: ["security", "engineering", "medical"],
  }),
  T({
    id: "road_blocked",
    title: "road blocked",
    sector: "perimeter",
    weight: 2,
    requires: (w) => w.roadOpen && w.weather.kind !== "clear",
    onStart: () => undefined,
    resolved: (w) => w.weather.kind === "clear",
    describe: () => `Perimeter: snow has closed the road to the pass until the weather clears.`,
    concerns: ["logistics"],
  }),
  T({
    id: "hoarding",
    title: "hoarding",
    sector: "habitat",
    weight: 2,
    fromDay: 3,
    once: true,
    requires: (w) => w.food.ration !== "full" && w.morale < 0.45,
    onStart: (w, rec) => {
      add(w, rec, "food.days", -0.7, "Colonists are hoarding food.", 0);
    },
    resolved: (w) => w.morale >= 0.5 || w.food.ration === "full",
    describe: () => `Sector B, Habitat: hoarding. Food stock is decreasing.`,
    concerns: ["logistics", "security"],
  }),
  T({
    id: "medicine_short",
    title: "medicine running out",
    sector: "infirmary",
    weight: 3,
    requires: (w) => w.medicine.stock < 0.15,
    onStart: () => undefined,
    resolved: (w) => w.medicine.stock >= 0.2,
    describe: (w) => `Sector D, Infirmary: medicine at ${pct(w.medicine.stock)}. ${w.people.critical} critical patients.`,
    concerns: ["medical", "logistics"],
  }),
  T({
    id: "water_short",
    title: "water running out",
    sector: "works",
    weight: 3,
    requires: (w) => w.water.days < 1.2,
    onStart: () => undefined,
    resolved: (w) => w.water.days >= 2,
    describe: (w) => `Sector C, Works: ${w.water.days.toFixed(1)} days of water left.`,
    concerns: ["engineering", "logistics"],
  }),
  T({
    id: "food_short",
    title: "food running out",
    sector: "works",
    weight: 3,
    requires: (w) => w.food.days < 2,
    onStart: () => undefined,
    resolved: (w) => w.food.days >= 3,
    describe: (w) => `Sector C, Works: ${w.food.days.toFixed(1)} days of food left at ${w.food.ration} rations.`,
    concerns: ["logistics"],
  }),
  T({
    id: "fuel_short",
    title: "fuel running out",
    sector: "works",
    weight: 3,
    requires: (w) => w.fuel.units < 20,
    onStart: () => undefined,
    resolved: (w) => w.fuel.units >= 30,
    describe: (w) => `Sector C, Works: ${Math.round(w.fuel.units)} fuel left. The generator burns up to 8 a night.`,
    concerns: ["logistics", "engineering"],
  }),
  T({
    id: "power_dark",
    title: "colony dark",
    sector: "core",
    weight: 4,
    requires: (w) => w.power.output < 0.3,
    onStart: (w, rec) => {
      add(w, rec, "morale", -0.05, "Power below 30% lowered morale.", 0, 1);
    },
    resolved: (w) => w.power.output >= 0.5,
    describe: (w) => `Sector A, Core: generator at ${pct(w.power.output)}. Battery ${pct(w.power.reserve)}, policy ${w.power.reservePolicy}.`,
    concerns: ["engineering", "logistics"],
  }),
  T({
    id: "ward_cold",
    title: "ward unheated",
    sector: "infirmary",
    weight: 3,
    requires: (w) => !w.sectors[w.medicine.ward].heated && w.people.critical > 0,
    onStart: () => undefined,
    resolved: (w) => w.sectors[w.medicine.ward].heated,
    describe: (w) => `Sector D, Infirmary: the ward (${w.medicine.ward}) was unheated last night. ${w.people.critical} critical patients.`,
    concerns: ["engineering", "medical"],
  }),
];

export const CRISIS_BY_ID: ReadonlyMap<string, CrisisTemplate> = new Map(CRISES.map((c) => [c.id, c]));

if (new Set(CRISES.map((c) => c.id)).size !== CRISES.length) throw new Error("duplicate crisis id");
