// The finite action library. Every action an officer can take is here, with
// the objectives and priorities it serves (what the utility reads), what it
// asks from the shared pool (what allocation reads), how pressing it is on its
// own (what initiative reads), and what it does to the world (recorded as
// effects). Officers never do anything that is not in this file.

import { add, change, evacuateOut, injure, kill, movePeople, type Recorder } from "../engine/world";
import type { Rng } from "../engine/rng";
import type { ActionSpec, Department, ResourceRequest, SectorId, World } from "../engine/types";
import { FUEL } from "./scenario";

export interface ActionContext {
  /** The sector the order pointed at, if any. */
  sector: SectorId | null;
  /** Urgency 0..3 of the order, or 0 when acting on initiative. */
  urgency: number;
  rng: Rng;
  /** Fraction of each resource request that was granted. */
  granted: Partial<Record<"fuel" | "vehicles" | "crewHours" | "power" | "medicine" | "water", number>>;
}

export interface ActionDef extends ActionSpec {
  /** What the action asks from the shared pool today. */
  requests(w: World): ResourceRequest[];
  /** How pressing this action is on its own, 0..1, for officers acting without an order. */
  urge(w: World): number;
  /** A reason the action cannot be taken today, or null. */
  blocked?(w: World): string | null;
  /** Applies the action at the granted fraction and records every effect. */
  apply(w: World, rec: Recorder, fraction: number, ctx: ActionContext): void;
}

const hours = (department: Department, amount: number): ResourceRequest => ({ key: "crewHours", amount, department });
const fuel = (amount: number): ResourceRequest => ({ key: "fuel", amount });
const trucks = (amount: number): ResourceRequest => ({ key: "vehicles", amount });
const medicine = (amount: number): ResourceRequest => ({ key: "medicine", amount });

function worked(w: World, d: Department, amount = 1): void {
  w.tonight.worked[d] = Math.max(w.tonight.worked[d] ?? 0, amount);
}

/** The most threatened sector with people in it, for evacuations that name none. */
export function dangerSector(w: World): SectorId {
  const score = (s: SectorId) => (w.sectors[s].people > 0 ? w.sectors[s].fire * 2 + w.sectors[s].damage + (w.sectors[s].heated ? 0 : 0.5) + (s === "habitat" && w.people.trapped > 0 ? 0.6 : 0) : -1);
  return (["habitat", "works", "infirmary", "core"] as SectorId[]).sort((a, b) => score(b) - score(a))[0];
}

function crewHurt(w: World, rec: Recorder, d: Department, chance: number, rng: Rng, note: string, lethal = 0): void {
  if (rng.next() < chance) {
    if (lethal > 0 && rng.next() < lethal) {
      add(w, rec, `crews.${d}.dead`, 1, `${note} One of the ${d} crew was killed.`);
      add(w, rec, "people.total", -1, `${note} One of the ${d} crew was killed.`);
      add(w, rec, "people.dead", 1, `${note} One of the ${d} crew was killed.`);
      add(w, rec, "morale", -0.04, `A ${d} crew member died on duty.`, 0, 1);
    } else {
      add(w, rec, `crews.${d}.injured`, 1, `${note} One of the ${d} crew was hurt.`);
      add(w, rec, "people.injured", 1, `${note} One of the ${d} crew was hurt.`);
    }
  }
}

function revealContact(w: World, rec: Recorder, truth: World["security"]["contact"], how: string): void {
  if (w.security.contact !== "unknown") return;
  change(w, rec, "security.contact", truth, `${how}. The contact outside is ${truth === "refugees" ? "refugees, families on foot" : truth === "raiders" ? "an armed band near the fence" : "scouts from a relief column"}.`);
  if (truth === "refugees") add(w, rec, "morale", 0.02, "The contact is families. Morale rose.", 0, 1);
  if (truth === "raiders") add(w, rec, "morale", -0.03, "The contact is armed. Morale fell.", 0, 1);
  if (truth === "relief") add(w, rec, "morale", 0.06, "A relief column is near. Morale rose.", 0, 1);
}

/** The hidden truth about the contact is supplied by the tick through ctx via this slot. */
export const CONTACT_TRUTH: { value: "refugees" | "raiders" | "relief" } = { value: "refugees" };

// ---------------------------------------------------------------------------
// Security

const SECURITY: ActionDef[] = [
  {
    id: "sec_routine",
    department: "security",
    label: "ROUTINE PATROL",
    objectives: {},
    priorities: {},
    risk: 0.05,
    speed: 1,
    initiativeBase: 0,
    passive: true,
    requests: () => [hours("security", 30)],
    urge: () => 0,
    apply(w, rec, f) {
      add(w, rec, "security.threat", -0.02 * f, "Routine patrol.", 0, 1);
      worked(w, "security", 0.3);
    },
  },
  {
    id: "sec_escort",
    department: "security",
    label: "ESCORT THE EVACUATION",
    objectives: { evacuate: 0.9, transport: 0.4, rescue: 0.3, defend: 0.3 },
    priorities: { priority_people: 0.6, priority_wounded: 0.3, priority_security: -0.2 },
    constraints: { avoid_combat: 0.3 },
    risk: 0.3,
    speed: 0.8,
    initiativeBase: 0.5,
    requests: () => [hours("security", 60)],
    urge: (w) => (w.people.trapped > 0 || Object.values(w.sectors).some((s) => s.fire > 0.3) ? 0.5 : 0.1),
    apply(w, rec, f, ctx) {
      change(w, rec, "tonight.escort", true, "Security is with the convoy and the people moving on foot.");
      const from = ctx.sector && ctx.sector !== "perimeter" ? ctx.sector : dangerSector(w);
      const to = from === "core" ? "habitat" : "core";
      const moved = movePeople(w, rec, from, to, Math.round(16 * f), `Security walked ${Math.round(16 * f)} colonists from the ${from} to the ${to}.`);
      if (moved) add(w, rec, "morale", 0.01, "The escort raised morale.", 0, 1);
      worked(w, "security", 1);
    },
  },
  {
    id: "sec_hold_gate",
    department: "security",
    label: "HOLD THE GATE",
    objectives: { defend: 0.9, fortify: 0.3 },
    priorities: { priority_security: 0.6, priority_crew_safety: 0.2 },
    constraints: { maintain_position: 0.8, avoid_combat: 0.3, permission_to_use_force: 0.2 },
    risk: 0.2,
    speed: 1,
    initiativeBase: 0.4,
    requests: () => [hours("security", 50)],
    urge: (w) => Math.max(0, w.security.threat - 0.3),
    apply(w, rec, f) {
      change(w, rec, "security.guarded", true, "A guard stands at the gate tonight.");
      add(w, rec, "security.threat", -0.08 * f, "The gate is held. Threat decreased.", 0, 1);
      add(w, rec, "security.perimeter", 0.04 * f, "The gate is held. The perimeter improved.", 0, 1);
      worked(w, "security", 0.7);
    },
  },
  {
    id: "sec_investigate",
    department: "security",
    label: "INVESTIGATE THE CONTACT",
    objectives: { investigate: 0.95, defend: 0.3 },
    priorities: { priority_security: 0.5 },
    constraints: { avoid_combat: 0.4, maintain_position: -0.6 },
    sectors: ["perimeter"],
    risk: 0.45,
    speed: 0.7,
    initiativeBase: 0.7,
    requests: () => [hours("security", 40), fuel(FUEL.truckTrip), trucks(1)],
    urge: (w) => (w.security.contact === "unknown" ? 0.55 + w.security.threat * 0.5 : 0),
    blocked: (w) => (w.security.contact !== "unknown" ? "the contact is already known" : null),
    apply(w, rec, f, ctx) {
      revealContact(w, rec, CONTACT_TRUTH.value, "Security investigated");
      add(w, rec, "security.threat", -0.15 * f, "The contact is identified. Threat decreased.", 0, 1);
      const withTruck = (ctx.granted.vehicles ?? 0) >= 0.99;
      if (CONTACT_TRUTH.value === "raiders") crewHurt(w, rec, "security", 0.35 * (withTruck ? 0.6 : 1), ctx.rng, "The band fired on the patrol.");
      worked(w, "security", 0.8);
    },
  },
  {
    id: "sec_patrol",
    department: "security",
    label: "PATROL THE PERIMETER",
    objectives: { defend: 0.6, investigate: 0.3 },
    priorities: { priority_security: 0.5, priority_crew_safety: 0.3 },
    risk: 0.15,
    speed: 0.9,
    initiativeBase: 0.5,
    requests: () => [hours("security", 45)],
    urge: (w) => 0.2 + w.security.threat * 0.4,
    apply(w, rec, f, ctx) {
      add(w, rec, "security.threat", -0.08 * f, "Patrols on the fence decreased the threat.", 0, 1);
      add(w, rec, "security.perimeter", 0.03 * f, "Patrols on the fence improved the perimeter.", 0, 1);
      if (w.security.contact === "unknown" && ctx.rng.next() < 0.35 * f) revealContact(w, rec, CONTACT_TRUTH.value, "A patrol identified the contact");
      worked(w, "security", 0.7);
    },
  },
  {
    id: "sec_fortify",
    department: "security",
    label: "FORTIFY THE GATE",
    objectives: { fortify: 0.95, defend: 0.5 },
    priorities: { priority_security: 0.6, priority_infrastructure: 0.3 },
    constraints: { maintain_position: 0.4 },
    sectors: ["perimeter"],
    risk: 0.1,
    speed: 0.5,
    initiativeBase: 0.3,
    requests: () => [hours("security", 70)],
    urge: (w) => Math.max(0, w.security.threat - 0.45) + (1 - w.security.perimeter) * 0.3,
    apply(w, rec, f) {
      add(w, rec, "security.perimeter", 0.25 * f, "The gate is braced and the fence is repaired.", 0, 1);
      change(w, rec, "security.guarded", true, "The work party guards the gate.");
      worked(w, "security", 1);
    },
  },
  {
    id: "sec_engage",
    department: "security",
    label: "ENGAGE THE CONTACT",
    tags: ["force"],
    objectives: { defend: 0.7, investigate: 0.2 },
    priorities: { priority_security: 0.8, priority_speed: 0.4, priority_crew_safety: -0.5, priority_people: -0.2 },
    constraints: { permission_to_use_force: 0.9, avoid_combat: -1, avoid_casualties: -0.6, maintain_position: -0.5 },
    sectors: ["perimeter"],
    risk: 0.8,
    speed: 0.9,
    initiativeBase: 0.35,
    requests: () => [hours("security", 70)],
    urge: (w) => (w.security.contact === "raiders" ? Math.max(0, w.security.threat - 0.4) : w.security.contact === "unknown" ? Math.max(0, w.security.threat - 0.6) : 0),
    blocked: (w) => (w.security.contact === "none" ? "there is nobody outside to engage" : null),
    apply(w, rec, f, ctx) {
      const truth = w.security.contact === "unknown" ? CONTACT_TRUTH.value : w.security.contact;
      revealContact(w, rec, CONTACT_TRUTH.value, "The squad engaged");
      if (truth === "raiders") {
        add(w, rec, "security.threat", -0.5 * f, "The raiders were driven off. Threat decreased.", 0, 1);
        crewHurt(w, rec, "security", 0.7, ctx.rng, "There was a firefight at the treeline.", 0.3);
        crewHurt(w, rec, "security", 0.4, ctx.rng, "There was a firefight at the treeline.");
        add(w, rec, "morale", 0.03, "The raiders were driven off. Morale rose.", 0, 1);
      } else if (truth === "refugees") {
        add(w, rec, "morale", -0.15, "Security fired on families at the fence. Morale fell.", 0, 1);
        change(w, rec, "security.contact", "none", "The refugees fled. There is no contact outside.");
        add(w, rec, "security.threat", -0.2, "There is no contact outside. Threat decreased.", 0, 1);
      } else if (truth === "relief") {
        add(w, rec, "morale", -0.1, "Security fired on the relief scouts. Morale fell.", 0, 1);
        change(w, rec, "security.reliefLost", true, "The relief column will not come.");
        change(w, rec, "security.contact", "none", "The scouts withdrew.");
        change(w, rec, "security.reliefDay", null as unknown as number, "No relief column is coming.");
      }
      worked(w, "security", 1);
    },
  },
  {
    id: "sec_withdraw",
    department: "security",
    label: "WITHDRAW TO THE CORE",
    objectives: { withdraw: 0.9 },
    priorities: { priority_crew_safety: 0.7, priority_security: -0.4 },
    constraints: { avoid_casualties: 0.7, maintain_position: -0.7 },
    risk: 0.05,
    speed: 1,
    initiativeBase: 0.2,
    requests: () => [hours("security", 10)],
    urge: (w) => (w.crews.security.fatigue > 0.85 ? 0.4 : 0),
    blocked: (w) => (w.security.threat < 0.5 && w.crews.security.fatigue < 0.7 ? "nothing to withdraw from" : null),
    apply(w, rec) {
      add(w, rec, "security.perimeter", -0.1, "The fence is not watched. The perimeter fell.", 0, 1);
      add(w, rec, "security.threat", 0.08, "The fence is not watched. Threat increased.", 0, 1);
      add(w, rec, "crews.security.fatigue", -0.2, "The squad rested inside.", 0, 1);
    },
  },
  {
    id: "sec_rescue",
    department: "security",
    label: "SEARCH AND RESCUE",
    objectives: { rescue: 0.95, evacuate: 0.3 },
    priorities: { priority_people: 0.7, priority_wounded: 0.5, priority_speed: 0.3, priority_crew_safety: -0.3 },
    constraints: { avoid_casualties: -0.2 },
    sectors: ["habitat"],
    risk: 0.5,
    speed: 0.6,
    initiativeBase: 0.7,
    requests: () => [hours("security", 80)],
    urge: (w) => (w.people.trapped > 0 ? 0.7 : 0),
    blocked: (w) => (w.people.trapped === 0 ? "nobody is trapped" : null),
    apply(w, rec, f, ctx) {
      const shored = w.tonight.shored;
      const freed = Math.min(w.people.trapped, Math.round(14 * f * (1 + 0.5 * shored)));
      if (freed > 0) {
        add(w, rec, "people.trapped", -freed, `${freed} colonists were rescued from the habitat.`, 0);
        const hurt = Math.round(freed * (w.tonight.fieldTeam ? 0.2 : 0.35));
        if (hurt) add(w, rec, "people.injured", hurt, `${hurt} of the rescued are injured.`);
        add(w, rec, "morale", Math.min(0.08, 0.005 * freed), `The rescue of ${freed} colonists raised morale.`, 0, 1);
      }
      crewHurt(w, rec, "security", 0.45 * (1 - 0.5 * shored) * f, ctx.rng, "The roof shifted during the dig.", shored > 0 ? 0 : 0.15);
      worked(w, "security", 1);
    },
  },
  {
    id: "sec_negotiate",
    department: "security",
    label: "TALK AT THE GATE",
    objectives: { negotiate: 0.95, investigate: 0.3 },
    priorities: { priority_people: 0.3, priority_security: 0.3 },
    constraints: { avoid_combat: 0.6, permission_to_use_force: -0.3 },
    sectors: ["perimeter"],
    risk: 0.35,
    speed: 0.7,
    initiativeBase: 0.3,
    requests: () => [hours("security", 30)],
    urge: (w) => (w.security.contact === "refugees" && w.security.admitted === 0 ? 0.35 : w.security.contact === "relief" && w.security.reliefDay === null ? 0.6 : 0),
    blocked: (w) => (w.security.contact === "none" ? "there is nobody outside to talk to" : null),
    apply(w, rec, f, ctx) {
      revealContact(w, rec, CONTACT_TRUTH.value, "The contact answered");
      const truth = w.security.contact;
      if (truth === "refugees") {
        const n = Math.round((18 + ctx.rng.int(10)) * f);
        if (n > 0) {
          add(w, rec, "people.total", n, `${n} refugees admitted through the gate.`);
          add(w, rec, "sectors.habitat.people", n, `${n} refugees housed in the habitat.`);
          add(w, rec, "people.injured", Math.round(n * 0.25), "Some of the refugees have frostbite.");
          add(w, rec, "security.admitted", n, `${n} refugees were admitted.`);
          change(w, rec, "food.days", w.food.days * (w.people.total / (w.people.total + n)), `${n} more people. Food days decreased.`);
          add(w, rec, "morale", 0.03, "The colony admitted the refugees. Morale rose.", 0, 1);
          change(w, rec, "security.contact", "none", "There is no contact outside the gate.");
        }
      } else if (truth === "raiders") {
        const paid = Math.min(w.fuel.units, 10);
        add(w, rec, "fuel.units", -paid, `The raiders took ${paid} fuel.`, 0);
        add(w, rec, "food.days", -0.6, "The raiders took food.", 0);
        add(w, rec, "security.threat", -0.35 * f, "The raiders withdrew. Threat decreased.", 0, 1);
        add(w, rec, "morale", -0.03, "The tribute lowered morale.", 0, 1);
      } else if (truth === "relief") {
        if (w.security.reliefDay === null && !w.security.reliefLost) {
          change(w, rec, "security.reliefDay", w.day + 3, "The relief column arrives at the pass in three days.");
          add(w, rec, "morale", 0.08, "The relief column is coming. Morale rose.", 0, 1);
        }
      }
      worked(w, "security", 0.5);
    },
  },
  {
    id: "sec_split",
    department: "security",
    label: "SPLIT THE SQUAD",
    objectives: { evacuate: 0.5, defend: 0.5 },
    priorities: { priority_people: 0.4, priority_security: 0.4 },
    risk: 0.4,
    speed: 0.7,
    initiativeBase: 0.3,
    requests: () => [hours("security", 90)],
    urge: (w) => (w.security.threat > 0.4 && (w.people.trapped > 0 || Object.values(w.sectors).some((s) => s.fire > 0.3)) ? 0.5 : 0),
    apply(w, rec, f) {
      change(w, rec, "tonight.escort", true, "Half the squad escorts the people moving.");
      change(w, rec, "security.guarded", true, "Half the squad guards the gate.");
      add(w, rec, "security.threat", -0.04 * f, "Half a guard on the gate decreased the threat.", 0, 1);
      worked(w, "security", 1);
    },
  },
  {
    id: "sec_stand_down",
    department: "security",
    label: "STAND DOWN",
    objectives: { withdraw: 0.4 },
    priorities: { priority_crew_safety: 0.5 },
    risk: 0,
    speed: 1,
    initiativeBase: 0.2,
    requests: () => [],
    urge: (w) => (w.crews.security.fatigue > 0.8 ? 0.5 : 0),
    apply(w, rec) {
      add(w, rec, "crews.security.fatigue", -0.3, "The squad stood down.", 0, 1);
    },
  },
];

// ---------------------------------------------------------------------------
// Logistics

const LOGISTICS: ActionDef[] = [
  {
    id: "log_routine",
    department: "logistics",
    label: "DISTRIBUTE RATIONS",
    objectives: {},
    priorities: {},
    risk: 0,
    speed: 1,
    initiativeBase: 0,
    passive: true,
    requests: () => [hours("logistics", 30)],
    urge: () => 0,
    apply(w, rec) {
      if (w.food.days > 8 && w.food.ration !== "full") change(w, rec, "food.ration", "full", "Food stock is above eight days. Full rations resumed.");
      worked(w, "logistics", 0.3);
    },
  },
  {
    id: "log_trucks",
    department: "logistics",
    label: "DISPATCH THE TRUCKS",
    tags: ["fuel", "trucks"],
    objectives: { evacuate: 0.95, transport: 0.5, rescue: 0.2 },
    priorities: { priority_people: 0.6, priority_speed: 0.3, priority_wounded: 0.2, priority_fuel: -0.4 },
    constraints: { preserve_reserve: -0.3, resource_cap_present: -0.2 },
    risk: 0.25,
    speed: 0.8,
    initiativeBase: 0.4,
    requests: (w) => {
      const n = w.vehicles.held ? 0 : w.vehicles.operational;
      return [trucks(n), fuel(n * 2 * FUEL.truckTrip), hours("logistics", 50)];
    },
    urge: (w) => (Object.values(w.sectors).some((s) => s.fire > 0.4) ? 0.5 : 0.1),
    blocked: (w) => (w.vehicles.operational === 0 ? "no truck runs" : w.vehicles.held ? "the trucks are held in the bay" : null),
    apply(w, rec, f, ctx) {
      const trips = Math.floor(w.vehicles.operational * 2 * f);
      const from = ctx.sector && ctx.sector !== "perimeter" ? ctx.sector : dangerSector(w);
      const to = from === "core" ? "habitat" : "core";
      const cap = trips * 12 * (w.tonight.escort ? 1.25 : 1);
      const moved = movePeople(w, rec, from, to, cap, `${trips} truck trips moved ${Math.min(cap, w.sectors[from].people)} colonists from the ${from} to the ${to}.`);
      add(w, rec, "fuel.units", -trips * FUEL.truckTrip, `${trips} trips burned ${trips * FUEL.truckTrip} fuel.`, 0);
      if (moved > 30) add(w, rec, "morale", -0.01, "Crowding in the core lowered morale.", 0, 1);
      worked(w, "logistics", 1);
    },
  },
  {
    id: "log_convoy",
    department: "logistics",
    label: "CONVOY TO THE PASS",
    tags: ["fuel", "trucks"],
    objectives: { evacuate: 0.9, transport: 0.6, abandon: 0.3 },
    priorities: { priority_people: 0.6, priority_wounded: 0.2, priority_fuel: -0.5, priority_infrastructure: -0.2 },
    constraints: { preserve_reserve: -0.4 },
    sectors: ["perimeter"],
    risk: 0.4,
    speed: 0.6,
    initiativeBase: 0.3,
    requests: (w) => {
      const n = w.vehicles.held ? 0 : w.vehicles.operational;
      return [trucks(n), fuel(n * FUEL.convoyTrip), hours("logistics", 60)];
    },
    urge: (w) => (w.roadOpen ? 0.4 : 0),
    blocked: (w) => (!w.roadOpen ? "the road out is not open" : w.vehicles.operational === 0 ? "no truck runs" : null),
    apply(w, rec, f, ctx) {
      const trips = Math.floor(w.vehicles.operational * f);
      let out = 0;
      for (const s of ["core", "habitat", "works", "infirmary"] as SectorId[]) {
        const want = trips * 12 - out;
        if (want <= 0) break;
        out += evacuateOut(w, rec, s, want, `The convoy carried colonists from ${s} to the pass.`);
      }
      add(w, rec, "fuel.units", -trips * FUEL.convoyTrip, `${trips} trucks to the pass burned ${trips * FUEL.convoyTrip} fuel.`, 0);
      if (w.security.contact === "raiders" && w.security.threat > 0.4 && !w.tonight.escort && ctx.rng.next() < 0.35) {
        add(w, rec, "vehicles.operational", -1, "Raiders destroyed a truck on the road.", 0);
        injure(w, rec, 2, "Raiders fired on the convoy.");
      }
      if (out > 0) add(w, rec, "morale", -0.02, "The departure lowered morale.", 0, 1);
      worked(w, "logistics", 1);
    },
  },
  {
    id: "log_reserve_pumps",
    department: "logistics",
    label: "RESERVE FUEL FOR THE PUMPS",
    objectives: { conserve: 0.9 },
    priorities: { priority_water: 0.7, priority_fuel: 0.6, priority_speed: -0.2 },
    constraints: { preserve_reserve: 0.9, resource_cap_present: 0.4 },
    risk: 0,
    speed: 1,
    initiativeBase: 0.5,
    requests: () => [fuel(FUEL.pumpsNight), hours("logistics", 10)],
    urge: (w) => (w.power.output < 0.55 && w.water.days < 3 ? 0.6 : w.water.days < 1.5 ? 0.4 : 0.1),
    blocked: (w) => (w.fuel.units < FUEL.pumpsNight ? "fewer than ten units of fuel remain" : w.fuel.reservedForPumps ? "fuel is already held for the pumps" : null),
    apply(w, rec, f) {
      if (f >= 0.99) change(w, rec, "fuel.reservedForPumps", true, `${FUEL.pumpsNight} fuel is held for the pumps tonight.`);
      change(w, rec, "fuel.priority", "pumps", "Tonight the pumps get fuel before the generator.");
      worked(w, "logistics", 0.2);
    },
  },
  {
    id: "log_fuel_generator_first",
    department: "logistics",
    label: "GENERATOR FIRST",
    objectives: { conserve: 0.6, restore_power: 0.4 },
    priorities: { priority_power: 0.7, priority_fuel: 0.4, priority_water: -0.3 },
    constraints: { preserve_reserve: 0.4 },
    risk: 0,
    speed: 1,
    initiativeBase: 0.2,
    requests: () => [hours("logistics", 10)],
    urge: (w) => (w.fuel.priority === "pumps" && w.fuel.units < 30 ? 0.3 : 0),
    blocked: (w) => (w.fuel.priority === "generator" && !w.fuel.reservedForPumps ? "the generator already drinks first" : null),
    apply(w, rec) {
      change(w, rec, "fuel.priority", "generator", "Tonight the generator gets fuel first.");
      change(w, rec, "fuel.reservedForPumps", false, "No fuel is held for the pumps.");
    },
  },
  {
    id: "log_ration_reduce",
    department: "logistics",
    label: "REDUCE RATIONS",
    objectives: { conserve: 0.9 },
    priorities: { priority_food: 0.8, priority_people: -0.1 },
    constraints: { resource_cap_present: 0.5 },
    risk: 0,
    speed: 1,
    initiativeBase: 0.5,
    requests: () => [hours("logistics", 10)],
    urge: (w) => (w.food.ration === "full" && w.food.days < 4 ? 0.6 : 0),
    blocked: (w) => (w.food.ration !== "full" ? "rations are already reduced" : null),
    apply(w, rec) {
      change(w, rec, "food.ration", "reduced", "Rations are reduced to two thirds.");
      add(w, rec, "morale", -0.03, "Reduced rations lowered morale.", 0, 1);
    },
  },
  {
    id: "log_ration_minimal",
    department: "logistics",
    label: "MINIMAL RATIONS",
    objectives: { conserve: 0.85 },
    priorities: { priority_food: 0.9, priority_people: -0.3 },
    constraints: { resource_cap_present: 0.6 },
    risk: 0.1,
    speed: 1,
    initiativeBase: 0.3,
    requests: () => [hours("logistics", 10)],
    urge: (w) => (w.food.days < 2 && w.food.ration !== "minimal" ? 0.5 : 0),
    blocked: (w) => (w.food.ration === "minimal" ? "rations are already minimal" : null),
    apply(w, rec) {
      change(w, rec, "food.ration", "minimal", "Rations are reduced to the minimum.");
      add(w, rec, "morale", -0.06, "Minimal rations lowered morale.", 0, 1);
    },
  },
  {
    id: "log_ration_full",
    department: "logistics",
    label: "FULL RATIONS",
    tags: ["food"],
    objectives: { other: 0.3 },
    priorities: { priority_people: 0.3, priority_food: -0.5 },
    risk: 0,
    speed: 1,
    initiativeBase: 0.2,
    requests: () => [hours("logistics", 10)],
    urge: (w) => (w.food.ration !== "full" && w.food.days > 7 ? 0.4 : 0),
    blocked: (w) => (w.food.ration === "full" ? "rations are already full" : null),
    apply(w, rec) {
      change(w, rec, "food.ration", "full", "Full rations are restored.");
      add(w, rec, "morale", 0.03, "Full rations raised morale.", 0, 1);
    },
  },
  {
    id: "log_haul_water",
    department: "logistics",
    label: "HAUL WATER FROM THE RESERVOIR",
    tags: ["fuel", "trucks"],
    objectives: { transport: 0.8, conserve: 0.2 },
    priorities: { priority_water: 0.8, priority_fuel: -0.2, priority_crew_safety: -0.2 },
    risk: 0.2,
    speed: 0.6,
    initiativeBase: 0.5,
    requests: () => [trucks(1), fuel(FUEL.truckTrip), hours("logistics", 40)],
    urge: (w) => (w.water.days < 1.5 ? 0.6 : w.water.days < 2.5 && w.water.pumpHealth < 0.5 ? 0.3 : 0),
    blocked: (w) => (w.vehicles.operational === 0 ? "no truck runs" : null),
    apply(w, rec, f, ctx) {
      add(w, rec, "water.days", 0.9 * f, `The trucks hauled ${(0.9 * f).toFixed(1)} days of water from the reservoir.`, 0, 6);
      add(w, rec, "fuel.units", -FUEL.truckTrip * f, "The water run used fuel.", 0);
      if (w.security.contact === "raiders" && w.security.threat > 0.5 && !w.tonight.escort) crewHurt(w, rec, "logistics", 0.3, ctx.rng, "Raiders fired on the water truck.");
      worked(w, "logistics", 0.8);
    },
  },
  {
    id: "log_move_medicine",
    department: "logistics",
    label: "MOVE THE MEDICINE TO THE CORE",
    objectives: { transport: 0.8, conserve: 0.4 },
    priorities: { priority_medicine: 0.9 },
    constraints: { do_not_abandon_equipment: 0.5 },
    sectors: ["infirmary", "core"],
    risk: 0.05,
    speed: 0.8,
    initiativeBase: 0.3,
    requests: () => [hours("logistics", 30)],
    urge: (w) => (w.sectors.infirmary.fire > 0 && !w.medicine.safe ? 0.7 : 0),
    blocked: (w) => (w.medicine.safe ? "the medicine is already in the core" : null),
    apply(w, rec, f) {
      if (f >= 0.5) change(w, rec, "medicine.safe", true, "The medicine store is in the core.");
      worked(w, "logistics", 0.5);
    },
  },
  {
    id: "log_move_fuel",
    department: "logistics",
    label: "MOVE THE FUEL TO THE CORE",
    objectives: { transport: 0.8, conserve: 0.4, abandon: 0.2 },
    priorities: { priority_fuel: 0.9, priority_infrastructure: 0.2 },
    constraints: { do_not_abandon_equipment: 0.5 },
    sectors: ["works", "core"],
    risk: 0.15,
    speed: 0.6,
    initiativeBase: 0.3,
    requests: () => [trucks(1), hours("logistics", 50)],
    urge: (w) => (w.sectors.works.fire > 0 && !w.fuel.safe ? 0.7 : 0),
    blocked: (w) => (w.fuel.safe ? "the fuel is already in the core" : null),
    apply(w, rec, f) {
      if (f >= 0.5) change(w, rec, "fuel.safe", true, "The fuel drums are in the core.");
      worked(w, "logistics", 0.8);
    },
  },
  {
    id: "log_repair_truck",
    department: "logistics",
    label: "REPAIR A TRUCK",
    objectives: { repair: 0.8 },
    priorities: { priority_infrastructure: 0.3, priority_speed: -0.2 },
    risk: 0.05,
    speed: 0.4,
    initiativeBase: 0.3,
    requests: () => [hours("logistics", 40)],
    urge: (w) => (w.vehicles.operational < w.vehicles.total ? 0.25 : 0),
    blocked: (w) => (w.vehicles.operational >= w.vehicles.total ? "every truck runs" : null),
    apply(w, rec, f) {
      if (f >= 0.6) add(w, rec, "vehicles.operational", 1, "A truck is repaired.", 0, w.vehicles.total);
      worked(w, "logistics", 0.6);
    },
  },
  {
    id: "log_shelter",
    department: "logistics",
    label: "SHELTER PEOPLE IN THE CORE",
    objectives: { evacuate: 0.6, transport: 0.5 },
    priorities: { priority_people: 0.6, priority_wounded: 0.2 },
    sectors: ["habitat", "core"],
    risk: 0.1,
    speed: 0.7,
    initiativeBase: 0.4,
    requests: () => [hours("logistics", 40)],
    urge: (w) => (!w.sectors.habitat.heated && w.weather.tempC < -5 ? 0.5 : 0),
    apply(w, rec, f) {
      const n = Math.round(40 * f);
      const moved = movePeople(w, rec, "habitat", "core", Math.min(n, w.sectors.habitat.people - w.people.trapped), `${n} colonists moved to shelter in the core.`);
      if (moved > 20) add(w, rec, "morale", -0.01, "Crowding in the core lowered morale.", 0, 1);
      worked(w, "logistics", 0.7);
    },
  },
  {
    id: "log_return_home",
    department: "logistics",
    label: "RETURN PEOPLE TO THE HABITAT",
    objectives: { transport: 0.5, other: 0.3 },
    priorities: { priority_people: 0.2 },
    sectors: ["habitat", "core"],
    risk: 0.05,
    speed: 0.7,
    initiativeBase: 0.2,
    requests: () => [hours("logistics", 30)],
    urge: (w) => (w.sectors.core.people > 60 && w.sectors.habitat.heated && w.sectors.habitat.fire === 0 ? 0.35 : 0),
    blocked: (w) => (w.sectors.core.people <= 25 ? "nobody is sheltering in the core" : null),
    apply(w, rec, f) {
      const n = Math.round((w.sectors.core.people - 20) * f);
      movePeople(w, rec, "core", "habitat", n, `${n} colonists returned to the habitat.`);
      add(w, rec, "morale", 0.02, "The return to the habitat raised morale.", 0, 1);
      worked(w, "logistics", 0.5);
    },
  },
  {
    id: "log_hold_trucks",
    department: "logistics",
    label: "HOLD THE TRUCKS",
    objectives: { conserve: 0.6 },
    priorities: { priority_fuel: 0.6, priority_speed: -0.3 },
    constraints: { preserve_reserve: 0.6, maintain_position: 0.3 },
    risk: 0,
    speed: 1,
    initiativeBase: 0.2,
    requests: (w) => [trucks(w.vehicles.operational), hours("logistics", 5)],
    urge: (w) => (w.fuel.units < 25 && !w.vehicles.held ? 0.3 : 0),
    blocked: (w) => (w.vehicles.held ? "the trucks are already held" : null),
    apply(w, rec) {
      change(w, rec, "vehicles.held", true, "The trucks are held in the bay.");
    },
  },
  {
    id: "log_release_trucks",
    department: "logistics",
    label: "RELEASE THE TRUCKS",
    objectives: { transport: 0.4, other: 0.2 },
    priorities: {},
    risk: 0,
    speed: 1,
    initiativeBase: 0.1,
    requests: () => [hours("logistics", 5)],
    urge: () => 0,
    blocked: (w) => (!w.vehicles.held ? "the trucks are not held" : null),
    apply(w, rec) {
      change(w, rec, "vehicles.held", false, "The trucks are released.");
    },
  },
];

// ---------------------------------------------------------------------------
// Medical

const MEDICAL: ActionDef[] = [
  {
    id: "med_routine",
    department: "medical",
    label: "WARD ROUNDS",
    objectives: {},
    priorities: {},
    risk: 0,
    speed: 1,
    initiativeBase: 0,
    passive: true,
    requests: () => [hours("medical", 30)],
    urge: () => 0,
    apply(w, rec) {
      change(w, rec, "tonight.treatment", Math.max(w.tonight.treatment, 0.3), "Ward rounds are done.");
      worked(w, "medical", 0.4);
    },
  },
  {
    id: "med_treat_all",
    department: "medical",
    label: "TREAT EVERYONE",
    tags: ["medicine"],
    objectives: { treat: 0.95 },
    priorities: { priority_wounded: 0.8, priority_people: 0.5, priority_medicine: -0.6 },
    constraints: { permission_to_use_reserve: 0.3, preserve_reserve: -0.4, resource_cap_present: -0.4 },
    risk: 0,
    speed: 0.8,
    initiativeBase: 0.6,
    requests: (w) => [hours("medical", 60), medicine(Math.min(w.medicine.stock, 0.04))],
    urge: (w) => (w.people.critical > 3 || w.people.injured > 20 ? 0.6 : 0.2),
    apply(w, rec, f) {
      change(w, rec, "medicine.policy", "full", "All patients receive treatment.");
      change(w, rec, "tonight.treatment", Math.max(w.tonight.treatment, f), "Full triage is in effect.");
      add(w, rec, "morale", 0.02, "Full treatment raised morale.", 0, 1);
      worked(w, "medical", 1);
    },
  },
  {
    id: "med_conserve",
    department: "medical",
    label: "CRITICAL CASES ONLY",
    objectives: { conserve: 0.9, treat: 0.3 },
    priorities: { priority_medicine: 0.9, priority_wounded: -0.4 },
    constraints: { resource_cap_present: 0.6, preserve_reserve: 0.6 },
    risk: 0.1,
    speed: 1,
    initiativeBase: 0.3,
    requests: () => [hours("medical", 30)],
    urge: (w) => (w.medicine.stock < 0.2 && w.medicine.policy === "full" ? 0.5 : 0),
    blocked: (w) => (w.medicine.policy === "critical_only" ? "the ward already treats only the critical" : null),
    apply(w, rec) {
      change(w, rec, "medicine.policy", "critical_only", "Only critical patients receive treatment.");
      change(w, rec, "tonight.treatment", Math.max(w.tonight.treatment, 0.6), "Triage for critical patients is in effect.");
      add(w, rec, "morale", -0.02, "Untreated patients lowered morale.", 0, 1);
      worked(w, "medical", 0.5);
    },
  },
  {
    id: "med_field_team",
    department: "medical",
    label: "FIELD TEAM TO THE SITE",
    tags: ["field"],
    objectives: { rescue: 0.6, treat: 0.7 },
    priorities: { priority_wounded: 0.7, priority_people: 0.5, priority_crew_safety: -0.4 },
    constraints: { avoid_casualties: -0.2 },
    sectors: ["habitat", "core", "works"],
    risk: 0.5,
    speed: 0.6,
    initiativeBase: 0.6,
    requests: () => [hours("medical", 50)],
    urge: (w) => (w.people.trapped > 0 ? 0.6 : Object.values(w.sectors).some((s) => s.fire > 0.4) ? 0.4 : 0),
    apply(w, rec, f, ctx) {
      change(w, rec, "tonight.fieldTeam", true, "Medics are at the rescue site.");
      const stabilised = Math.min(w.people.critical, Math.round(2 * f));
      if (stabilised) {
        add(w, rec, "people.critical", -stabilised, `${stabilised} critical patients stabilised in the field.`, 0);
        add(w, rec, "people.injured", stabilised, `${stabilised} critical patients stabilised in the field.`);
      }
      const fire = ctx.sector ? w.sectors[ctx.sector].fire : 0;
      crewHurt(w, rec, "medical", 0.25 * (1 + fire) * f, ctx.rng, "A medic was hurt at the site.");
      worked(w, "medical", 1);
    },
  },
  {
    id: "med_move_patients",
    department: "medical",
    label: "MOVE THE PATIENTS TO THE CORE",
    objectives: { evacuate: 0.85, transport: 0.4 },
    priorities: { priority_wounded: 0.8, priority_people: 0.3 },
    sectors: ["infirmary", "core"],
    risk: 0.2,
    speed: 0.6,
    initiativeBase: 0.5,
    requests: () => [hours("medical", 50), trucks(1), fuel(FUEL.truckTrip)],
    urge: (w) => (w.medicine.ward === "infirmary" && (!w.sectors.infirmary.heated || w.sectors.infirmary.fire > 0.2) ? 0.6 : 0),
    blocked: (w) => (w.medicine.ward === "core" ? "the patients are already in the core" : null),
    apply(w, rec, f) {
      if (f >= 0.5) {
        movePeople(w, rec, "infirmary", "core", w.sectors.infirmary.people, "The wards moved to the core.");
        change(w, rec, "medicine.ward", "core", "The patients are in the core.");
      }
      worked(w, "medical", 0.8);
    },
  },
  {
    id: "med_return_patients",
    department: "medical",
    label: "REOPEN THE INFIRMARY",
    objectives: { transport: 0.4, other: 0.3 },
    priorities: { priority_wounded: 0.3 },
    sectors: ["infirmary", "core"],
    risk: 0.1,
    speed: 0.6,
    initiativeBase: 0.2,
    requests: () => [hours("medical", 40)],
    urge: (w) => (w.medicine.ward === "core" && w.sectors.infirmary.heated && w.sectors.infirmary.fire === 0 ? 0.3 : 0),
    blocked: (w) => (w.medicine.ward === "infirmary" ? "the wards are in the infirmary" : null),
    apply(w, rec, f) {
      if (f >= 0.5) {
        movePeople(w, rec, "core", "infirmary", 20, "The wards moved back to the infirmary.");
        change(w, rec, "medicine.ward", "infirmary", "The infirmary is open again.");
      }
      worked(w, "medical", 0.6);
    },
  },
  {
    id: "med_quarantine",
    department: "medical",
    label: "QUARANTINE",
    objectives: { contain: 0.9 },
    priorities: { priority_people: 0.5, priority_medicine: 0.2 },
    risk: 0.1,
    speed: 0.8,
    initiativeBase: 0.6,
    requests: () => [hours("medical", 40)],
    urge: (w) => (w.water.contaminated ? 0.7 : 0),
    apply(w, rec) {
      change(w, rec, "tonight.quarantine", true, "Quarantine is in effect. The water is boiled.");
      add(w, rec, "morale", -0.02, "The quarantine lowered morale.", 0, 1);
      worked(w, "medical", 0.8);
    },
  },
  {
    id: "med_cold_response",
    department: "medical",
    label: "COLD RESPONSE",
    objectives: { treat: 0.6, defend: 0.2 },
    priorities: { priority_people: 0.6, priority_wounded: 0.4 },
    risk: 0.05,
    speed: 0.9,
    initiativeBase: 0.5,
    requests: (w) => [hours("medical", 40), medicine(Math.min(w.medicine.stock, 0.02))],
    urge: (w) => (w.weather.tempC < -8 && (!w.sectors.habitat.heated || w.power.output < 0.6) ? 0.5 : 0.1),
    apply(w, rec) {
      change(w, rec, "tonight.coldResponse", true, "Cold response is in effect.");
      worked(w, "medical", 0.7);
    },
  },
  {
    id: "med_rest",
    department: "medical",
    label: "STAFF REST",
    objectives: { withdraw: 0.4 },
    priorities: { priority_crew_safety: 0.6, priority_wounded: -0.3 },
    risk: 0,
    speed: 1,
    initiativeBase: 0.3,
    requests: () => [],
    urge: (w) => (w.crews.medical.fatigue > 0.75 ? 0.5 : 0),
    apply(w, rec) {
      add(w, rec, "crews.medical.fatigue", -0.35, "The medical staff rested.", 0, 1);
      change(w, rec, "tonight.treatment", Math.max(w.tonight.treatment, 0.2), "A reduced crew is on the ward.");
    },
  },
];

// ---------------------------------------------------------------------------
// Engineering

const ENGINEERING: ActionDef[] = [
  {
    id: "eng_routine",
    department: "engineering",
    label: "MAINTENANCE ROUNDS",
    objectives: {},
    priorities: {},
    risk: 0.05,
    speed: 1,
    initiativeBase: 0,
    passive: true,
    requests: () => [hours("engineering", 30)],
    urge: () => 0,
    apply(w, rec) {
      if (w.sectors.core.fire === 0) add(w, rec, "power.generatorHealth", 0.02, "Maintenance on the generator.", 0, 1);
      add(w, rec, "water.pumpHealth", 0.02, "Maintenance on the pumps.", 0, 1);
      worked(w, "engineering", 0.4);
    },
  },
  {
    id: "eng_fight_fire",
    department: "engineering",
    label: "FIGHT THE FIRE",
    tags: ["fire"],
    objectives: { contain: 0.95, defend: 0.3, repair: 0.2 },
    priorities: { priority_infrastructure: 0.7, priority_power: 0.5, priority_people: 0.3, priority_crew_safety: -0.5 },
    constraints: { avoid_casualties: -0.3 },
    sectors: ["core", "habitat", "works", "infirmary"],
    risk: 0.55,
    speed: 0.8,
    initiativeBase: 0.8,
    requests: () => [hours("engineering", 80), { key: "water", amount: 0.3 }],
    urge: (w) => Math.max(...Object.values(w.sectors).map((s) => s.fire)),
    blocked: (w) => (Object.values(w.sectors).every((s) => s.fire === 0) ? "nothing is burning" : null),
    apply(w, rec, f, ctx) {
      const burning = (["core", "habitat", "works", "infirmary"] as SectorId[]).filter((s) => w.sectors[s].fire > 0);
      const s = ctx.sector && burning.includes(ctx.sector) ? ctx.sector : burning.sort((a, b) => w.sectors[b].fire - w.sectors[a].fire)[0];
      const fire = w.sectors[s].fire;
      change(w, rec, `tonight.fireFought.${s}`, f, `Fire crews are in ${s} at ${Math.round(f * 100)}% strength.`);
      add(w, rec, `sectors.${s}.fire`, -0.25 * f, `The fire in ${s} was reduced during the day.`, 0, 1);
      add(w, rec, "water.days", -0.3 * f, "The fire crews used water.", 0);
      crewHurt(w, rec, "engineering", 0.5 * fire * f, ctx.rng, `The ${s} fire burned a crew member.`, fire > 0.7 ? 0.2 : 0);
      worked(w, "engineering", 1);
    },
  },
  {
    id: "eng_repair_generator",
    department: "engineering",
    label: "REPAIR THE GENERATOR",
    objectives: { repair: 0.95, restore_power: 0.8 },
    priorities: { priority_power: 0.8, priority_infrastructure: 0.7 },
    sectors: ["core"],
    risk: 0.25,
    speed: 0.5,
    initiativeBase: 0.7,
    requests: () => [hours("engineering", 80)],
    urge: (w) => (w.power.generatorHealth < 0.7 && w.sectors.core.fire < 0.3 ? 0.4 + (0.7 - w.power.generatorHealth) : 0),
    blocked: (w) => (w.sectors.core.fire >= 0.3 ? "the generator hall is burning" : w.power.generatorHealth >= 0.98 ? "the generator is sound" : null),
    apply(w, rec, f, ctx) {
      add(w, rec, "power.generatorHealth", 0.22 * f, `Generator repairs at ${Math.round(f * 100)}% effort.`, 0, 1);
      crewHurt(w, rec, "engineering", 0.15 * f, ctx.rng, "An accident in the generator hall.");
      worked(w, "engineering", 1);
    },
  },
  {
    id: "eng_isolate",
    department: "engineering",
    label: "ISOLATE THE GENERATOR",
    objectives: { contain: 0.7, abandon: 0.3, withdraw: 0.2 },
    priorities: { priority_infrastructure: 0.5, priority_crew_safety: 0.5, priority_power: -0.5 },
    constraints: { permission_to_sacrifice_equipment: 0.3, fallback_present: 0.4 },
    sectors: ["core"],
    risk: 0.2,
    speed: 0.9,
    initiativeBase: 0.4,
    requests: () => [hours("engineering", 30)],
    urge: (w) => (w.sectors.core.fire > 0.5 ? 0.5 : 0),
    blocked: (w) => (w.sectors.core.fire === 0 ? "the core is not burning" : null),
    apply(w, rec) {
      change(w, rec, "power.isolated", 2, "The generator is isolated for two days. Output is capped at 40%.");
      add(w, rec, "sectors.core.fire", -0.2, "The isolation slowed the fire.", 0, 1);
      worked(w, "engineering", 0.5);
    },
  },
  {
    id: "eng_power_infirmary",
    department: "engineering",
    label: "POWER TO THE INFIRMARY",
    tags: ["divert"],
    objectives: { restore_power: 0.8, transport: 0.2, treat: 0.2 },
    priorities: { priority_power: 0.4, priority_wounded: 0.6, priority_medicine: 0.4 },
    sectors: ["infirmary"],
    risk: 0.05,
    speed: 1,
    initiativeBase: 0.75,
    requests: () => [hours("engineering", 20)],
    urge: (w) => (!w.sectors[w.medicine.ward].heated && w.people.critical > 0 ? 0.7 : 0),
    blocked: (w) => (w.power.priority === "infirmary" ? "the infirmary already has priority" : null),
    apply(w, rec) {
      change(w, rec, "power.priority", "infirmary", "The infirmary has power priority.");
    },
  },
  {
    id: "eng_power_habitat",
    department: "engineering",
    label: "POWER TO THE HABITAT",
    tags: ["divert"],
    objectives: { restore_power: 0.8, transport: 0.2 },
    priorities: { priority_power: 0.4, priority_people: 0.6 },
    sectors: ["habitat"],
    risk: 0.05,
    speed: 1,
    initiativeBase: 0.4,
    requests: () => [hours("engineering", 20)],
    urge: (w) => (!w.sectors.habitat.heated && w.weather.tempC < -5 ? 0.5 : 0),
    blocked: (w) => (w.power.priority === "habitat" ? "the habitat already has priority" : null),
    apply(w, rec) {
      change(w, rec, "power.priority", "habitat", "The habitat has power priority.");
    },
  },
  {
    id: "eng_power_works",
    department: "engineering",
    label: "POWER TO THE PUMPS",
    tags: ["divert"],
    objectives: { restore_power: 0.8, repair: 0.2 },
    priorities: { priority_power: 0.4, priority_water: 0.7, priority_infrastructure: 0.3 },
    sectors: ["works"],
    risk: 0.05,
    speed: 1,
    initiativeBase: 0.5,
    requests: () => [hours("engineering", 20)],
    urge: (w) => (!w.sectors.works.heated && w.weather.tempC < -8 ? 0.5 : w.water.days < 2 ? 0.3 : 0),
    blocked: (w) => (w.power.priority === "works" ? "the pumps already have priority" : null),
    apply(w, rec) {
      change(w, rec, "power.priority", "works", "The works have power priority.");
    },
  },
  {
    id: "eng_shed_load",
    department: "engineering",
    label: "SHED NON-ESSENTIAL LOAD",
    objectives: { conserve: 0.8, restore_power: 0.3 },
    priorities: { priority_power: 0.6, priority_infrastructure: 0.4, priority_people: -0.2 },
    constraints: { preserve_reserve: 0.4 },
    risk: 0,
    speed: 1,
    initiativeBase: 0.5,
    requests: () => [hours("engineering", 15)],
    urge: (w) => (w.power.output < 0.7 && !w.power.shedding ? 0.5 : 0),
    blocked: (w) => (w.power.shedding ? "load is already shed" : null),
    apply(w, rec) {
      change(w, rec, "power.shedding", true, "Non-essential load is shed.");
      add(w, rec, "morale", -0.02, "Load shedding lowered morale.", 0, 1);
    },
  },
  {
    id: "eng_restore_load",
    department: "engineering",
    label: "RESTORE FULL LOAD",
    objectives: { restore_power: 0.5, other: 0.2 },
    priorities: { priority_people: 0.3, priority_power: -0.3 },
    risk: 0,
    speed: 1,
    initiativeBase: 0.2,
    requests: () => [hours("engineering", 15)],
    urge: (w) => (w.power.shedding && w.power.output > 0.9 ? 0.4 : 0),
    blocked: (w) => (!w.power.shedding ? "nothing is shed" : null),
    apply(w, rec) {
      change(w, rec, "power.shedding", false, "Full load is restored.");
      add(w, rec, "morale", 0.02, "The restored load raised morale.", 0, 1);
    },
  },
  {
    id: "eng_bridge_reserve",
    department: "engineering",
    label: "BRIDGE WITH THE BATTERY",
    tags: ["reserve"],
    objectives: { restore_power: 0.85 },
    priorities: { priority_power: 0.5, priority_people: 0.4, priority_infrastructure: -0.3 },
    constraints: { permission_to_use_reserve: 0.9, preserve_reserve: -0.9 },
    risk: 0.1,
    speed: 1,
    initiativeBase: 0.3,
    requests: () => [hours("engineering", 15)],
    urge: (w) => (w.power.output < 0.6 && w.power.reserve > 0.5 ? 0.35 : 0),
    blocked: (w) => (w.power.reserve <= 0.02 ? "the battery is flat" : w.power.reservePolicy === "bridge" ? "the battery is already bridging" : null),
    apply(w, rec) {
      change(w, rec, "power.reservePolicy", "bridge", "The battery covers the night's shortfall.");
    },
  },
  {
    id: "eng_hold_reserve",
    department: "engineering",
    label: "HOLD THE RESERVE",
    objectives: { conserve: 0.7 },
    priorities: { priority_power: 0.3, priority_infrastructure: 0.5, priority_people: -0.2 },
    constraints: { preserve_reserve: 0.9, permission_to_use_reserve: -0.5 },
    risk: 0,
    speed: 1,
    initiativeBase: 0.3,
    requests: () => [hours("engineering", 10)],
    urge: (w) => (w.power.reservePolicy === "bridge" && w.power.reserve < 0.3 ? 0.4 : 0),
    blocked: (w) => (w.power.reservePolicy === "hold" ? "the reserve is already held" : null),
    apply(w, rec) {
      change(w, rec, "power.reservePolicy", "hold", "The battery is held.");
    },
  },
  {
    id: "eng_repair_pumps",
    department: "engineering",
    label: "REPAIR THE PUMPS",
    objectives: { repair: 0.95 },
    priorities: { priority_water: 0.9, priority_infrastructure: 0.6 },
    sectors: ["works"],
    risk: 0.15,
    speed: 0.5,
    initiativeBase: 0.7,
    requests: () => [hours("engineering", 70)],
    urge: (w) => (w.water.pumpHealth < 0.6 ? 0.4 + (0.6 - w.water.pumpHealth) : 0),
    blocked: (w) => (w.sectors.works.fire >= 0.3 ? "the pump house is burning" : w.water.pumpHealth >= 0.98 ? "the pumps are sound" : null),
    apply(w, rec, f, ctx) {
      add(w, rec, "water.pumpHealth", 0.25 * f, `Pump repairs at ${Math.round(f * 100)}% effort.`, 0, 1);
      crewHurt(w, rec, "engineering", 0.1 * f, ctx.rng, "An accident in the pump house.");
      worked(w, "engineering", 1);
    },
  },
  {
    id: "eng_thaw_pipes",
    department: "engineering",
    label: "THAW THE PIPES",
    objectives: { repair: 0.85, restore_power: 0.1 },
    priorities: { priority_water: 0.8, priority_infrastructure: 0.4, priority_fuel: -0.2 },
    sectors: ["works"],
    risk: 0.2,
    speed: 0.5,
    initiativeBase: 0.7,
    requests: () => [hours("engineering", 60), fuel(FUEL.thawDay)],
    urge: (w) => (w.water.pipesFrozen ? 0.7 : 0),
    blocked: (w) => (!w.water.pipesFrozen ? "the pipes are not frozen" : null),
    apply(w, rec, f) {
      add(w, rec, "fuel.units", -FUEL.thawDay * f, "The heaters used fuel.", 0);
      if (f >= 0.5) change(w, rec, "water.pipesFrozen", false, "The pipes are thawed.");
      worked(w, "engineering", 1);
    },
  },
  {
    id: "eng_shore_habitat",
    department: "engineering",
    label: "SHORE UP THE HABITAT",
    objectives: { repair: 0.7, rescue: 0.6, fortify: 0.5 },
    priorities: { priority_people: 0.5, priority_infrastructure: 0.6, priority_wounded: 0.2 },
    sectors: ["habitat"],
    risk: 0.4,
    speed: 0.5,
    initiativeBase: 0.7,
    requests: () => [hours("engineering", 80)],
    urge: (w) => (w.people.trapped > 0 ? 0.7 : w.shelter.integrity < 0.6 ? 0.5 : 0),
    apply(w, rec, f, ctx) {
      add(w, rec, "shelter.integrity", 0.2 * f, "The habitat roof is shored.", 0, 1);
      change(w, rec, "tonight.shored", f, "The rescue site is shored.");
      const freed = Math.min(w.people.trapped, Math.round(6 * f));
      if (freed > 0) {
        add(w, rec, "people.trapped", -freed, `Engineering freed ${freed} of the trapped.`, 0);
        add(w, rec, "people.injured", Math.round(freed * 0.3), "Some of the freed are injured.");
      }
      crewHurt(w, rec, "engineering", 0.3 * f, ctx.rng, "A beam fell during the shoring.");
      worked(w, "engineering", 1);
    },
  },
  {
    id: "eng_overrun",
    department: "engineering",
    label: "RUN THE GENERATOR HOT",
    tags: ["overrun"],
    objectives: { restore_power: 0.6 },
    priorities: { priority_people: 0.7, priority_water: 0.3, priority_infrastructure: -0.4, priority_power: 0.2 },
    constraints: { permission_to_sacrifice_equipment: 0.3 },
    risk: 0.2,
    speed: 1,
    initiativeBase: 0.3,
    requests: () => [hours("engineering", 20)],
    urge: (w) => (w.weather.tempC < -12 && w.power.output < 0.8 && w.power.generatorHealth > 0.4 ? 0.3 : 0),
    blocked: (w) => (w.power.generatorHealth < 0.3 ? "the generator would not survive it" : w.weather.tempC > -10 || w.power.output >= 0.85 ? "no need to run hot tonight" : null),
    apply(w, rec) {
      change(w, rec, "tonight.overrun", true, "The generator runs above its rating tonight.");
      add(w, rec, "power.generatorHealth", -0.05, "Running hot reduced generator health.", 0, 1);
    },
  },
  {
    id: "eng_pull_team",
    department: "engineering",
    label: "PULL THE TEAM OUT",
    objectives: { withdraw: 0.9, abandon: 0.3 },
    priorities: { priority_crew_safety: 0.8, priority_infrastructure: -0.5 },
    constraints: { avoid_casualties: 0.7 },
    risk: 0,
    speed: 1,
    initiativeBase: 0.3,
    requests: () => [],
    urge: (w) => (w.sectors.core.fire > 0.75 || w.crews.engineering.fatigue > 0.85 ? 0.4 : 0),
    blocked: (w) => (w.sectors.core.fire < 0.3 && w.sectors.works.fire < 0.3 && w.crews.engineering.fatigue < 0.7 ? "the crew is not in danger" : null),
    apply(w, rec) {
      add(w, rec, "crews.engineering.fatigue", -0.2, "The engineering crew withdrew and rested.", 0, 1);
    },
  },
];

function clarify(department: Department): ActionDef {
  return {
    id: `${department}_clarify`,
    department,
    label: "REQUEST CLARIFICATION",
    objectives: {},
    priorities: {},
    risk: 0,
    speed: 0,
    initiativeBase: 0,
    passive: true,
    requests: () => [],
    urge: () => 0,
    apply() {
      // The routine runs instead; the officer's question is recorded by the resolver.
    },
  };
}

export const ACTIONS: readonly ActionDef[] = [...SECURITY, ...LOGISTICS, ...MEDICAL, ...ENGINEERING, ...(["security", "logistics", "medical", "engineering"] as Department[]).map(clarify)];

export const ACTION_BY_ID: ReadonlyMap<string, ActionDef> = new Map(ACTIONS.map((a) => [a.id, a]));

export function actionsFor(department: Department): ActionDef[] {
  return ACTIONS.filter((a) => a.department === department);
}

export function routineFor(department: Department): ActionDef {
  return ACTION_BY_ID.get(`${{ security: "sec", logistics: "log", medical: "med", engineering: "eng" }[department]}_routine`)!;
}

export function clarifyFor(department: Department): ActionDef {
  return ACTION_BY_ID.get(`${department}_clarify`)!;
}

// Every action id must be unique.
if (new Set(ACTIONS.map((a) => a.id)).size !== ACTIONS.length) throw new Error("duplicate action id");

// Keep `kill` referenced for actions that may need it later; the fire tick uses it.
void kill;
