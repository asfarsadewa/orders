// Post-run analysis, all computed from the event stream and the day reports.

import { ACTION_BY_ID } from "../content/actions";
import { OFFICERS } from "../content/officers";
import type { Department, GameState, OrderRecord } from "./types";

export interface RunReport {
  days: number;
  orders: number;
  clarifications: number;
  answered: number;
  mostAmbiguous: OrderRecord | null;
  clearest: OrderRecord | null;
  mostExpensive: { order: OrderRecord; fuel: number } | null;
  largestDivergence: { day: number; actions: Record<Department, string>; order: OrderRecord | null } | null;
  challengedMost: { department: Department; count: number } | null;
  precedentConflicts: number;
  standingOrders: number;
  deaths: number;
  evacuated: number;
  crewCasualties: Record<Department, number>;
  /** Orders that were clear (clarity ≥ 2) and preceded a night with three or more deaths. */
  clearButCostly: OrderRecord[];
  /** The resource that fell furthest as a fraction of its start. */
  sacrificed: { name: string; fraction: number } | null;
  trust: Record<Department, number>;
}

export function runReport(state: GameState): RunReport {
  const orders = [...state.ledger, ...state.today];
  const reports = state.reports;
  const byClarity = [...orders].sort((a, b) => a.measurements.scores.clarity.score - b.measurements.scores.clarity.score);
  const utterances = reports.flatMap((r) => r.utterances);
  const clarifications = utterances.filter((u) => u.act === "clarify").length;
  const answered = orders.reduce((s, o) => s + o.answered.length, 0);

  let mostExpensive: RunReport["mostExpensive"] = null;
  for (const r of reports) {
    for (const d of r.decisions) {
      const fuel = d.effects.filter((e) => e.path === "fuel.units").reduce((s, e) => s + ((e.from as number) - (e.to as number)), 0);
      const order = orders.find((o) => o.id === d.orders[d.orders.length - 1]);
      if (order && fuel > (mostExpensive?.fuel ?? 0)) mostExpensive = { order, fuel: Math.round(fuel) };
    }
  }

  let largestDivergence: RunReport["largestDivergence"] = null;
  let bestSpread = 0;
  for (const r of reports) {
    const ordered = r.decisions.filter((d) => d.basis === "order");
    const distinct = new Set(ordered.map((d) => d.action)).size;
    const spread = ordered.length >= 2 ? distinct / ordered.length + ordered.length * 0.1 : 0;
    if (spread > bestSpread) {
      bestSpread = spread;
      const actions = {} as Record<Department, string>;
      for (const d of r.decisions) actions[d.department] = ACTION_BY_ID.get(d.action)?.label ?? d.action;
      largestDivergence = { day: r.day, actions, order: orders.find((o) => o.id === ordered[0]?.orders[0]) ?? null };
    }
  }

  const challenges: Record<Department, number> = { security: 0, logistics: 0, medical: 0, engineering: 0 };
  for (const u of utterances) if (u.act === "object" || u.act === "challenge_precedent" || u.act === "warn" || u.act === "clarify") challenges[u.department]++;
  const top = (Object.keys(challenges) as Department[]).sort((a, b) => challenges[b] - challenges[a])[0];

  const crewCasualties: Record<Department, number> = { security: 0, logistics: 0, medical: 0, engineering: 0 };
  for (const d of Object.keys(crewCasualties) as Department[]) crewCasualties[d] = state.world.crews[d].injured + state.world.crews[d].dead;

  const clearButCostly: OrderRecord[] = [];
  for (const r of reports) {
    const deaths = r.night.filter((e) => e.path === "people.dead").reduce((s, e) => s + ((e.to as number) - (e.from as number)), 0);
    if (deaths >= 3) for (const o of orders.filter((o) => o.day === r.day && o.measurements.scores.clarity.score >= 2)) clearButCostly.push(o);
  }

  const first = reports[0]?.world;
  const last = state.world;
  let sacrificed: RunReport["sacrificed"] = null;
  if (first) {
    const pairs: [string, number, number][] = [
      ["fuel", 120, last.fuel.units],
      ["water", 4, last.water.days],
      ["food", 11, last.food.days],
      ["medicine", 0.55, last.medicine.stock],
      ["battery", 0.8, last.power.reserve],
      ["generator", 0.78, last.power.generatorHealth],
    ];
    for (const [name, start, end] of pairs) {
      const fraction = Math.round((1 - end / start) * 100) / 100;
      if (fraction > (sacrificed?.fraction ?? 0)) sacrificed = { name, fraction };
    }
  }

  return {
    days: reports.length,
    orders: orders.length,
    clarifications,
    answered,
    mostAmbiguous: byClarity[0] ?? null,
    clearest: byClarity[byClarity.length - 1] ?? null,
    mostExpensive,
    largestDivergence,
    challengedMost: top && challenges[top] > 0 ? { department: top, count: challenges[top] } : null,
    precedentConflicts: utterances.filter((u) => u.act === "challenge_precedent").length,
    standingOrders: state.standing.length,
    deaths: state.world.people.dead,
    evacuated: state.world.people.evacuated,
    crewCasualties,
    clearButCostly,
    sacrificed,
    trust: { ...state.trust },
  };
}

export function officerName(d: Department): string {
  return OFFICERS[d].name;
}
