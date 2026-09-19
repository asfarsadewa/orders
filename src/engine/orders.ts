// The order ledger: who an order is for, when it becomes a standing order,
// how standing orders are superseded, and the precedent memory each
// department keeps. All of it is arithmetic on measurements.

import { THRESHOLDS } from "./thresholds";
import { DEPARTMENTS, PRIORITY_NOULS, type Department, type Measurements, type Objective, type OrderRecord, type PrecedentMemory, type PriorityNoul, type StandingOrder, type StandingOrderMeasure } from "./types";

/** A Noul above its gate reads as a strength in 0..1; below it reads as nothing. */
export function gate(p: number, threshold: number): number {
  return p >= threshold ? (p - threshold) / (1 - threshold) : 0;
}

/**
 * Departments whose scope Noul crossed; when none did, the objective implies
 * one; when that is empty too, the departments the order touches most, and
 * failing that everyone. An order to the colony is never an order to nobody.
 */
export function scopeOf(m: Measurements): Department[] {
  const out = DEPARTMENTS.filter((d) => m.nouls[`concerns_${d}` as const] >= THRESHOLDS.scope);
  if (out.length) return [...out];
  const implied = impliedScope(m.objective.choice);
  if (implied.length) return implied;
  const touched = DEPARTMENTS.filter((d) => m.nouls[`concerns_${d}` as const] >= THRESHOLDS.scope * 0.6);
  return touched.length ? [...touched] : [...DEPARTMENTS];
}

const IMPLIED: Record<Objective, Department[]> = {
  evacuate: ["security", "logistics"],
  rescue: ["security", "engineering", "medical"],
  repair: ["engineering"],
  restore_power: ["engineering"],
  contain: ["engineering"],
  conserve: ["logistics"],
  treat: ["medical"],
  defend: ["security"],
  investigate: ["security"],
  fortify: ["security", "engineering"],
  withdraw: ["security", "engineering"],
  transport: ["logistics"],
  negotiate: ["security"],
  abandon: ["logistics", "engineering"],
  other: [],
};

export function impliedScope(objective: Objective): Department[] {
  return [...IMPLIED[objective]];
}

export function isStandingOrder(m: Measurements): boolean {
  return m.nouls.is_standing_order >= THRESHOLDS.isStandingOrder;
}

export function isQuestion(m: Measurements): boolean {
  return m.nouls.is_question >= THRESHOLDS.isQuestion && m.objective.choice === "other";
}

export function addressesSystem(m: Measurements): boolean {
  return m.nouls.addresses_system >= THRESHOLDS.addressesSystem;
}

export function makeStandingOrder(record: OrderRecord, index: number): StandingOrder {
  return {
    id: `SO-${index}`,
    issuedDay: record.day,
    text: record.text,
    measurements: record.measurements,
    scope: record.scope,
    authority: 1,
    supersededBy: null,
    supersededDay: null,
  };
}

export function activeStanding(standing: readonly StandingOrder[]): StandingOrder[] {
  return standing.filter((s) => s.supersededBy === null);
}

/**
 * The measure a new order carries about one standing order. Measurements bind
 * by standing-order id (D31); streams measured before that bind by position in
 * the active list, which is only exact while nothing in it changes.
 */
export function standingMeasure(m: Measurements, so: StandingOrder, index: number): StandingOrderMeasure | undefined {
  if (m.standing.some((s) => s.standingOrderId !== undefined)) return m.standing.find((s) => s.standingOrderId === so.id);
  return m.standing[index];
}

/** Marks standing orders that the new order overrides. */
export function applyOverrides(standing: StandingOrder[], m: Measurements, byOrderId: string, day: number): string[] {
  const active = activeStanding(standing);
  const superseded: string[] = [];
  active.forEach((so, i) => {
    const s = standingMeasure(m, so, i);
    const revokeAll = m.nouls.revokes_standing_orders >= THRESHOLDS.revokesStanding;
    if ((s && s.override >= THRESHOLDS.standingOverride) || revokeAll) {
      so.supersededBy = byOrderId;
      so.supersededDay = day;
      superseded.push(so.id);
    }
  });
  return superseded;
}

/** Standing orders that a new order conflicts with and does not override. */
export function standingConflicts(standing: readonly StandingOrder[], m: Measurements): { so: StandingOrder; conflict: number }[] {
  const active = activeStanding(standing);
  const out: { so: StandingOrder; conflict: number }[] = [];
  active.forEach((so, i) => {
    const s = standingMeasure(m, so, i);
    if (s && s.conflict >= THRESHOLDS.standingConflict && s.override < THRESHOLDS.standingOverride) out.push({ so, conflict: s.conflict });
  });
  return out;
}

export function emptyPrecedent(): PrecedentMemory {
  const mem = {} as PrecedentMemory;
  for (const d of DEPARTMENTS) {
    mem[d] = {} as Record<PriorityNoul, number>;
    for (const p of PRIORITY_NOULS) mem[d][p] = 0;
  }
  return mem;
}

/** How fast a department learns from a new order (0..1 blend toward the new priorities). */
export const PRECEDENT_LEARN = 0.35;
/** Nightly fade of what was learned. */
export const PRECEDENT_DECAY = 0.88;

/** Blends an order's stated priorities into the memory of every department it was for. */
export function learnPrecedent(mem: PrecedentMemory, m: Measurements, scope: readonly Department[]): void {
  for (const d of scope) {
    for (const p of PRIORITY_NOULS) {
      const stated = gate(m.nouls[p], THRESHOLDS.priority);
      if (stated > 0) mem[d][p] = mem[d][p] + (stated - mem[d][p]) * PRECEDENT_LEARN;
    }
  }
}

export function decayPrecedent(mem: PrecedentMemory): void {
  for (const d of DEPARTMENTS) for (const p of PRIORITY_NOULS) mem[d][p] = Math.round(mem[d][p] * PRECEDENT_DECAY * 1000) / 1000;
}

/** The strongest learned priority for a department, for the UI. */
export function strongestPrecedent(mem: PrecedentMemory, d: Department): { priority: PriorityNoul; weight: number } | null {
  let best: PriorityNoul | null = null;
  for (const p of PRIORITY_NOULS) if (best === null || mem[d][p] > mem[d][best]) best = p;
  return best && mem[d][best] > 0.15 ? { priority: best, weight: mem[d][best] } : null;
}
