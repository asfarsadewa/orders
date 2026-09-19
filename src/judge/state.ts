// Builds the compact state one order is judged against. Never the whole
// simulation: the situation as lines, the resources as sentences with the
// numbers that matter to precedence, the active standing orders, the recent
// orders, and any question an officer is waiting on.

import { CRISIS_BY_ID } from "../content/crises";
import { OFFICERS } from "../content/officers";
import { FUEL } from "../content/scenario";
import { activeStanding } from "../engine/orders";
import type { GameState, World } from "../engine/types";
import { DEPARTMENT_DESCRIPTIONS, MAX_PENDING, MAX_STANDING, SECTOR_DESCRIPTIONS, type JudgeState } from "./questions";
import { CLARIFY_QUESTION } from "../content/lines/clarify";

export const RECENT_ORDERS = 4;

export function situationLines(w: World): string[] {
  const lines = w.crises.map((c) => CRISIS_BY_ID.get(c.template)?.describe(w, c) ?? c.template);
  const cold = w.weather.tempC < -5 ? `, ${["core", "habitat", "works", "infirmary"].filter((s) => !w.sectors[s as keyof World["sectors"]].heated).length} sectors were unheated last night` : "";
  lines.push(`Weather: ${w.weather.kind}, ${w.weather.tempC} C tonight${cold}.`);
  if (w.roadOpen) lines.push("The road to the pass is open; trucks can carry people out.");
  return lines;
}

export function resourceLines(w: World): Record<string, string> {
  const patients = w.people.injured + w.people.critical;
  return {
    power: `generator at ${Math.round(w.power.output * 100)}% of demand, health ${Math.round(w.power.generatorHealth * 100)}%; battery reserve ${Math.round(w.power.reserve * 100)}%, policy ${w.power.reservePolicy}${w.power.shedding ? "; non-essential load shed" : ""}`,
    water: `${w.water.days.toFixed(1)} days stored; pumps ${Math.round(w.water.pumpHealth * 100)}%${w.water.pipesFrozen ? ", pipes frozen" : ""}${w.water.contaminated ? ", contaminated" : ""}`,
    food: `${w.food.days.toFixed(1)} days at ${w.food.ration} rations`,
    medicine: `${Math.round(w.medicine.stock * 100)}% of stock; ${patients} patients, ${w.people.critical} critical; ward in the ${w.medicine.ward}`,
    fuel: `${Math.round(w.fuel.units)} units; the generator burns ${FUEL.generatorNight} a night, the pumps ${FUEL.pumpsNight} a night on backup, one truck trip costs ${FUEL.truckTrip}${w.fuel.reservedForPumps ? `; ${FUEL.pumpsNight} held for the pumps tonight` : ""}`,
    vehicles: `${w.vehicles.operational} of ${w.vehicles.total} trucks running${w.vehicles.held ? ", held in the bay" : ""}`,
    people: `${w.people.total} colonists inside; ${w.people.trapped} trapped; ${w.people.evacuated} evacuated; ${w.people.dead} dead; morale ${Math.round(w.morale * 100)}%`,
  };
}

export function buildJudgeState(state: GameState, order: string): JudgeState {
  const w = state.world;
  return {
    order,
    day: state.day,
    departments: DEPARTMENT_DESCRIPTIONS,
    sectors: SECTOR_DESCRIPTIONS,
    situation: situationLines(w),
    resources: resourceLines(w),
    standing_orders: activeStanding(state.standing)
      .slice(0, MAX_STANDING)
      .map((s) => ({ id: s.id, day: s.issuedDay, text: s.text })),
    recent_orders: [...state.ledger, ...state.today].slice(-RECENT_ORDERS).map((o) => ({ day: o.day, text: o.text })),
    pending_clarifications: state.pending
      .filter((p) => !p.answeredBy)
      .slice(0, MAX_PENDING)
      .map((p) => ({ id: p.id, officer: `${OFFICERS[p.department].name} (${p.department})`, question: CLARIFY_QUESTION[p.department][p.reason] })),
  };
}
