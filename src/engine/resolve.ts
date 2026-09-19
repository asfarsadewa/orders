// Officer resolution: the same measurements, four different actions. Each
// officer scores every action in their library with an explicit additive
// utility whose every term is recorded, may prefer to ask instead of act, and
// then the chosen actions compete for the shared pool. Nothing here is hidden;
// the inspector prints these terms.

import { ACTIONS, actionsFor, clarifyFor, routineFor, type ActionDef } from "../content/actions";
import { OFFICERS } from "../content/officers";
import { crewHours, fuelForTrucks } from "./world";
import { activeStanding, gate, standingConflicts } from "./orders";
import { THRESHOLDS } from "./thresholds";
import { trustFactors } from "./trust";
import {
  CONSTRAINT_NOULS,
  DEPARTMENTS,
  OBJECTIVES,
  PRIORITY_NOULS,
  SCORE_MAX,
  type Allocation,
  type Allocations,
  type Candidate,
  type ClarifyReason,
  type Decision,
  type Department,
  type Doctrine,
  type GameState,
  type Measurements,
  type OrderRecord,
  type PriorityNoul,
  type ResourceKey,
  type SectorId,
  type StandingOrder,
  type Target,
  type UtilityTerm,
  type World,
} from "./types";

/** The weights of the utility. Engine constants; tuned by `npm run sim`, not by the model. */
export const W = {
  objective: 2.0,
  priority: 1.5,
  constraint: 1.2,
  permissionPenalty: 0.7,
  urgency: 0.6,
  risk: 1.2,
  sectorMatch: 0.3,
  sectorMismatch: -0.4,
  /** The order names a thing (pipes, the gate, the patients) and the action works on it, or not (D35). */
  targetMatch: 0.6,
  targetMismatch: -0.7,
  targetGate: 0.5,
  discretion: 0.8,
  standing: 0.8,
  precedent: 0.7,
  initiative: 1.2,
  /** Later orders on the same day weigh a little more. */
  laterOrder: 0.1,
  /** When an order names another officer as its owner, this department's objective term is scaled by this. */
  supportObjective: 0.35,
  ownerGate: 0.6,
  /** Utility a crisis action needs to beat the routine when nobody ordered it. */
  initiativeFloor: 0.35,
  /** An officer asks instead of acting when their need to clarify crosses this. */
  clarifyFloor: 0.45,
  /** A confidently understood objective lowers the need to ask by up to this much. */
  clarifyObjectiveRelief: 0.15,
} as const;

const PERMISSIONS = ["permission_to_use_force", "permission_to_use_reserve", "permission_to_sacrifice_equipment"] as const;

/** Which doctrine multiplier a priority answers to. */
function emphasis(doc: Doctrine, p: PriorityNoul): number {
  switch (p) {
    case "priority_people":
    case "priority_wounded":
      return doc.lifePriority;
    case "priority_infrastructure":
    case "priority_power":
      return doc.infrastructureWeight;
    case "priority_water":
      return Math.max(doc.infrastructureWeight, doc.resourceCaution);
    case "priority_fuel":
    case "priority_food":
    case "priority_medicine":
      return doc.resourceCaution;
    case "priority_speed":
    case "priority_security":
      return doc.urgencyResponse;
    case "priority_crew_safety":
      return 1 + (doc.riskAversion - 0.5);
  }
}

const f2 = (x: number) => (Math.round(x * 100) / 100).toFixed(2);

function objectiveMatch(m: Measurements, a: ActionDef): number {
  let s = 0;
  for (const o of OBJECTIVES) s += (m.objective.probabilities[o] ?? 0) * (a.objectives[o] ?? 0);
  return s;
}

function priorityMatch(m: Measurements, a: ActionDef, doc: Doctrine): { value: number; parts: string[] } {
  let s = 0;
  const parts: string[] = [];
  for (const p of PRIORITY_NOULS) {
    const w = a.priorities[p];
    if (!w) continue;
    const g = gate(m.nouls[p], THRESHOLDS.priority);
    if (g <= 0) continue;
    const e = emphasis(doc, p);
    s += g * w * e;
    parts.push(`${p} ${f2(m.nouls[p])} × serves ${f2(w)} × emphasis ${f2(e)}`);
  }
  return { value: s, parts };
}

function constraintMatch(m: Measurements, a: ActionDef, doc: Doctrine): { value: number; parts: string[] } {
  let s = 0;
  const parts: string[] = [];
  for (const c of CONSTRAINT_NOULS) {
    const w = a.constraints?.[c];
    if (!w) continue;
    const g = gate(m.nouls[c], THRESHOLDS.constraint);
    if (g <= 0) continue;
    // Honouring a stated constraint is worth literalness; violating one costs literalness and more.
    const k = w > 0 ? doc.literalness : 1 + doc.literalness;
    s += g * w * k;
    parts.push(`${c} ${f2(m.nouls[c])} × ${w > 0 ? "honours" : "violates"} ${f2(Math.abs(w))} × ${f2(k)}`);
  }
  return { value: s, parts };
}

interface OrderInput {
  record: OrderRecord;
  /** 1 for today's orders, less for an older order being answered. */
  weight: number;
}

export interface OfficerContext {
  state: GameState;
  world: World;
  department: Department;
  orders: OrderInput[];
  standing: StandingOrder[];
  trust: number;
}

/** Scores one action for one officer. */
export function score(ctx: OfficerContext, a: ActionDef): Candidate {
  const { world, department, orders, standing, trust, state } = ctx;
  const doc = OFFICERS[department].doctrine;
  const tf = trustFactors(trust);
  const terms: UtilityTerm[] = [];
  let u = 0;
  const push = (name: string, value: number, note: string) => {
    if (Math.abs(value) < 0.0005) return;
    terms.push({ name, value: Math.round(value * 1000) / 1000, note });
    u += value;
  };

  const blocked = a.blocked?.(world) ?? null;
  if (blocked) return { action: a.id, utility: -Infinity, terms: [{ name: "infeasible", value: 0, note: blocked }], feasible: false, infeasibleReason: blocked };

  orders.forEach((o, i) => {
    const m = o.record.measurements;
    const w = o.weight * (1 + W.laterOrder * i) * doc.obedience * tf.obedience;
    const om = objectiveMatch(m, a);
    const ownerP = m.owner.choice === "none" ? 0 : (m.owner.probabilities[m.owner.choice] ?? 0);
    const support = m.owner.choice !== "none" && m.owner.choice !== department && ownerP >= W.ownerGate ? W.supportObjective : 1;
    push(`objective (${o.record.id})`, W.objective * om * w * support, `objective ${m.objective.choice} ${f2(m.objective.probabilities[m.objective.choice] ?? 0)} × serves ${f2(om)} × obedience ${f2(doc.obedience)} × trust ${f2(tf.obedience)}${support < 1 ? ` × support ${f2(support)} (addressed to ${m.owner.choice} ${f2(ownerP)})` : ""}`);
    const pm = priorityMatch(m, a, doc);
    push(`priorities (${o.record.id})`, W.priority * pm.value * w, pm.parts.join("; ") || "no stated priority this action serves");
    const cm = constraintMatch(m, a, doc);
    push(`constraints (${o.record.id})`, W.constraint * cm.value * w, cm.parts.join("; "));
    for (const perm of PERMISSIONS) {
      const needs = a.constraints?.[perm] ?? 0;
      if (needs > 0.5) {
        const p = m.nouls[perm];
        const penalty = -(1 - p) * doc.obedience * W.permissionPenalty * (1 - 0.5 * doc.initiative * tf.initiative);
        push(`no ${perm} (${o.record.id})`, penalty * o.weight, `${perm} ${f2(p)}: acting without it costs obedience ${f2(doc.obedience)} × (1 − ½ initiative ${f2(doc.initiative)})`);
      }
    }
    const urg = m.scores.urgency.score / SCORE_MAX;
    push(`urgency (${o.record.id})`, W.urgency * urg * doc.urgencyResponse * a.speed * o.weight, `urgency ${f2(m.scores.urgency.score)}/3 × response ${f2(doc.urgencyResponse)} × speed ${f2(a.speed)}`);
    const rt = m.scores.risk_tolerance.score / SCORE_MAX;
    push(`risk (${o.record.id})`, -W.risk * a.risk * doc.riskAversion * (1 - 0.7 * rt) * o.weight, `risk ${f2(a.risk)} × aversion ${f2(doc.riskAversion)} × (1 − 0.7 × tolerance ${f2(m.scores.risk_tolerance.score)}/3)`);
    if (m.sector.choice !== "none" && a.sectors) {
      const hit = a.sectors.includes(m.sector.choice as SectorId);
      push(`sector (${o.record.id})`, (hit ? W.sectorMatch : W.sectorMismatch) * o.weight, hit ? `order names ${m.sector.choice}; this action works there` : `order names ${m.sector.choice}; this action works in ${a.sectors.join(", ")}`);
    }
    if (m.target.choice !== "none" && a.targets) {
      const tp = m.target.probabilities[m.target.choice] ?? 0;
      if (tp >= W.targetGate) {
        const hit = a.targets.includes(m.target.choice as Target);
        push(`target (${o.record.id})`, (hit ? W.targetMatch : W.targetMismatch) * o.weight, hit ? `order is about ${m.target.choice} ${f2(tp)}; this action works on it` : `order is about ${m.target.choice} ${f2(tp)}; this action works on ${a.targets.join(", ")}`);
      }
    }
    const disc = m.scores.delegated_discretion.score / SCORE_MAX;
    const urge = a.urge(world);
    if (disc > 0 && urge > 0 && !a.passive) {
      push(`discretion (${o.record.id})`, W.discretion * disc * doc.initiative * tf.initiative * urge * o.weight, `discretion ${f2(m.scores.delegated_discretion.score)}/3 × initiative ${f2(doc.initiative)} × trust ${f2(tf.initiative)} × pressing ${f2(urge)}`);
    }
  });

  // Standing orders in this officer's scope act as weaker, persistent orders.
  for (const so of standing) {
    if (!so.scope.includes(department)) continue;
    const pm = priorityMatch(so.measurements, a, doc);
    const cm = constraintMatch(so.measurements, a, doc);
    const v = W.standing * so.authority * doc.precedentWeight * tf.precedent * (0.8 * pm.value + 0.6 * cm.value);
    push(`standing ${so.id}`, v, `${[...pm.parts, ...cm.parts].join("; ") || "nothing this action serves"} × precedent weight ${f2(doc.precedentWeight)}`);
  }

  // Precedent memory: what this department has learned the commander wants.
  {
    let s = 0;
    const parts: string[] = [];
    for (const p of PRIORITY_NOULS) {
      const mem = state.precedent[department][p];
      const w = a.priorities[p];
      if (!w || mem < 0.05) continue;
      s += mem * w * emphasis(doc, p);
      parts.push(`${p} learned ${f2(mem)} × serves ${f2(w)}`);
    }
    push("precedent", W.precedent * doc.precedentWeight * tf.precedent * s, `${parts.join("; ")} × precedent weight ${f2(doc.precedentWeight)}`);
  }

  // Initiative: what the officer would do anyway about a crisis in their domain.
  if (!a.passive) {
    const urge = a.urge(world);
    push("initiative", W.initiative * doc.initiative * tf.initiative * urge * a.initiativeBase, `initiative ${f2(doc.initiative)} × trust ${f2(tf.initiative)} × pressing ${f2(urge)} × base ${f2(a.initiativeBase)}`);
    // Risk still counts when acting unordered.
    if (orders.length === 0) push("risk", -W.risk * a.risk * doc.riskAversion * 0.6, `risk ${f2(a.risk)} × aversion ${f2(doc.riskAversion)}, unordered`);
  }

  return { action: a.id, utility: Math.round(u * 1000) / 1000, terms, feasible: true };
}

export interface ClarifyNeed {
  utility: number;
  reason: ClarifyReason;
  terms: UtilityTerm[];
}

/** How much the officer would rather ask than act, and what about. */
export function clarifyNeed(ctx: OfficerContext, best: Candidate | null): ClarifyNeed {
  const { department, orders, standing, trust, state } = ctx;
  const doc = OFFICERS[department].doctrine;
  const tf = trustFactors(trust);
  const terms: UtilityTerm[] = [];
  if (orders.length === 0) return { utility: 0, reason: "scope", terms };
  const m = orders[orders.length - 1].record.measurements;
  const clarity = m.scores.clarity.score;
  const clarityNeed = Math.max(0, (THRESHOLDS.lowClarity - clarity) / THRESHOLDS.lowClarity);
  const noTarget = m.sector.choice === "none" && m.target.choice === "none";
  const under = gate(m.nouls.underspecified, THRESHOLDS.underspecified);
  const contra = gate(m.nouls.contradictory, THRESHOLDS.contradictory);
  const resources = (["priority_fuel", "priority_water", "priority_power", "priority_food", "priority_medicine"] as const).filter((p) => m.nouls[p] >= THRESHOLDS.priority).length;
  const resourceAmb = resources >= 2 && m.nouls.gives_clear_priority < THRESHOLDS.constraint ? Math.max(0, doc.resourceCaution - 0.9) : 0;
  const soc = standingConflicts(standing, m).filter((c) => c.so.scope.includes(department));
  const soConflict = soc.length ? Math.max(...soc.map((c) => gate(c.conflict, THRESHOLDS.standingConflict))) : 0;
  let precedentConflict = 0;
  if (best) {
    const a = ACTIONS.find((x) => x.id === best.action);
    if (a) {
      for (const p of PRIORITY_NOULS) {
        const w = a.priorities[p] ?? 0;
        if (w < -0.2) precedentConflict = Math.max(precedentConflict, state.precedent[department][p] * -w);
      }
    }
  }
  const scale = (1 - 0.5 * doc.initiative * tf.initiative) * tf.clarify;
  const add = (name: string, v: number, note: string, reason: ClarifyReason) => {
    if (v > 0.0005) terms.push({ name, value: Math.round(v * 1000) / 1000, note: `${note}; reason ${reason}` });
    return v;
  };
  const parts: [number, ClarifyReason][] = [
    [add("low clarity", doc.literalness * 0.8 * clarityNeed * scale, `clarity ${f2(clarity)}/3 below ${THRESHOLDS.lowClarity} × literalness ${f2(doc.literalness)}`, noTarget ? "target" : "scope"), noTarget ? "target" : "scope"],
    [add("underspecified", doc.literalness * 0.7 * under * scale, `underspecified ${f2(m.nouls.underspecified)} × literalness ${f2(doc.literalness)}`, "scope"), "scope"],
    [add("contradictory", doc.literalness * 1.4 * contra * scale, `contradictory ${f2(m.nouls.contradictory)} × literalness ${f2(doc.literalness)}`, "contradiction"), "contradiction"],
    [add("resource precedence", doc.literalness * 0.6 * resourceAmb * scale * 2, `${resources} resources named, gives_clear_priority ${f2(m.nouls.gives_clear_priority)} × caution ${f2(doc.resourceCaution)}`, "resource_precedence"), "resource_precedence"],
    [add("standing order", doc.precedentWeight * tf.precedent * 0.9 * soConflict * scale, `conflicts with ${soc.map((c) => c.so.id).join(", ")} × precedent weight ${f2(doc.precedentWeight)}`, "standing_order"), "standing_order"],
    [add("precedent", doc.precedentWeight * tf.precedent * 0.7 * precedentConflict * scale, `the order works against what this department learned × precedent weight ${f2(doc.precedentWeight)}`, "precedent"), "precedent"],
  ];
  let utility = parts.reduce((s, [v]) => s + v, 0);
  // A clearly understood objective relieves some of the need: the officer knows what, if not every how.
  const relief = m.objective.choice === "other" ? 0 : W.clarifyObjectiveRelief * (m.objective.probabilities[m.objective.choice] ?? 0) * (1 - doc.literalness);
  if (relief > 0.0005 && utility > 0) {
    terms.push({ name: "understood objective", value: -Math.round(Math.min(relief, utility) * 1000) / 1000, note: `objective ${m.objective.choice} ${f2(m.objective.probabilities[m.objective.choice] ?? 0)} × (1 − literalness ${f2(doc.literalness)})` });
    utility = Math.max(0, utility - relief);
  }
  const reason = parts.sort((a, b) => b[0] - a[0])[0]?.[1] ?? "scope";
  return { utility: Math.round(utility * 1000) / 1000, reason, terms };
}

export interface Decided {
  decision: Decision;
  def: ActionDef;
  /** The order whose sector and urgency the action carries. */
  lead: OrderRecord | null;
}

/** Only a command is an order to act on; a question or a message to the model costs its slot and nothing more (D30). */
export function isCommand(o: OrderRecord): boolean {
  return o.kind !== "question" && o.kind !== "system_message";
}

/** Decides every officer's action for the day. Pure. */
export function decideAll(state: GameState, world: World): Decided[] {
  const standing = activeStanding(state.standing);
  const out: Decided[] = [];
  for (const d of DEPARTMENTS) {
    const today = state.today.filter((o) => isCommand(o) && o.scope.includes(d)).map((o) => ({ record: o, weight: 1 }));
    // An answered clarification brings its original order back for today at reduced weight.
    for (const p of state.pending) {
      if (p.department !== d || !p.answeredBy) continue;
      if (!state.today.some((o) => o.id === p.answeredBy)) continue;
      const original = state.ledger.find((o) => o.id === p.orderId);
      if (original && !today.some((t) => t.record.id === original.id)) today.unshift({ record: original, weight: 0.8 });
    }
    const ctx: OfficerContext = { state, world, department: d, orders: today, standing, trust: state.trust[d] };
    const routine = routineFor(d);
    const candidates = actionsFor(d)
      .filter((a) => !a.passive)
      .map((a) => score(ctx, a))
      .sort((a, b) => b.utility - a.utility);
    const best = candidates.find((c) => c.feasible) ?? null;
    const need = clarifyNeed(ctx, best);
    const openQuestion = state.pending.find((p) => p.department === d && !p.answeredBy);
    let chosen: ActionDef = routine;
    let basis: Decision["basis"] = "routine";
    let clarify: Decision["clarify"];
    const routineCand: Candidate = { action: routine.id, utility: 0, terms: [{ name: "routine", value: 0, note: "what the department does when nothing else is asked" }], feasible: true };
    const clarifyCand: Candidate = { action: clarifyFor(d).id, utility: need.utility, terms: need.terms, feasible: today.length > 0, ...(today.length ? {} : { infeasibleReason: "no order to ask about" }) };
    if (openQuestion) {
      // The officer asked and was not answered: they hold to routine and wait.
      chosen = clarifyFor(d);
      basis = "clarification";
      clarify = { reason: openQuestion.reason, pendingId: openQuestion.id };
    } else if (today.length > 0 && need.utility >= W.clarifyFloor) {
      chosen = clarifyFor(d);
      basis = "clarification";
      clarify = { reason: need.reason, pendingId: `Q-${state.day}-${d}` };
    } else if (best && best.utility > (today.length > 0 ? 0 : W.initiativeFloor)) {
      chosen = ACTIONS.find((a) => a.id === best.action)!;
      basis = today.length > 0 ? "order" : "initiative";
    }
    const lead = today.length ? today[today.length - 1].record : null;
    out.push({
      decision: {
        department: d,
        day: state.day,
        orders: today.map((t) => t.record.id),
        action: chosen.id,
        basis,
        candidates: [...candidates, clarifyCand, routineCand],
        clarify,
        effects: [],
      },
      def: chosen,
      lead,
    });
  }
  return out;
}

/** Precedence score for allocation: how strongly today's orders back this action. */
function precedence(state: GameState, d: Department, a: ActionDef): number {
  let s = 0;
  const doc = OFFICERS[d].doctrine;
  for (const o of state.today) {
    if (!isCommand(o) || !o.scope.includes(d)) continue;
    s += priorityMatch(o.measurements, a, doc).value + objectiveMatch(o.measurements, a) * 0.5;
  }
  return s;
}

/**
 * Splits the shared pool among the chosen actions. Each action first finds the
 * fraction its whole request supports, then takes only what that fraction
 * needs, so an action that cannot run takes nothing from anyone (D32).
 */
export function allocate(state: GameState, world: World, decided: Decided[]): { allocations: Allocations; perDepartment: Record<Department, Allocation> } {
  const pool: Record<ResourceKey, number> = {
    fuel: fuelForTrucks(world),
    vehicles: world.vehicles.held ? 0 : world.vehicles.operational,
    crewHours: 0,
    power: 1,
    medicine: world.medicine.stock,
    water: world.water.days,
  };
  const hoursPool: Record<Department, number> = { security: 0, logistics: 0, medical: 0, engineering: 0 };
  for (const d of DEPARTMENTS) hoursPool[d] = crewHours(world, d);
  // Hold-the-trucks is a request for the trucks themselves; it takes them out of the pool for everyone else.
  const ranked = decided
    .map((x) => ({ x, p: precedence(state, x.decision.department, x.def), init: OFFICERS[x.decision.department].doctrine.initiative }))
    .sort((a, b) => b.p - a.p || b.init - a.init);
  const anyPrecedence = ranked.some((r) => r.p > 0.05);
  const rows: Allocations["rows"] = [];
  const perDepartment = {} as Record<Department, Allocation>;
  for (const { x } of ranked) {
    const d = x.decision.department;
    // A clarification does the routine instead.
    const def = x.decision.basis === "clarification" ? routineFor(d) : x.def;
    const requests = def.requests(world).filter((r) => r.amount > 0);
    const granted: Allocation["granted"] = {};
    // 1. What each resource supports on its own. Trucks are whole: two asked, one in the bay, half met.
    const support = requests.map((r) => {
      const avail = r.key === "crewHours" ? hoursPool[r.department ?? d] : pool[r.key];
      const g = r.key === "vehicles" ? Math.min(1, Math.floor(Math.min(avail, r.amount) + 1e-9) / r.amount) : Math.min(1, avail / r.amount);
      return { r, avail, g };
    });
    // 2. The action runs at the weakest resource's fraction, and not at all below its minimum effort (D36).
    const supported = support.reduce((f, s) => Math.min(f, s.g), 1);
    const fraction = supported > 0 && supported >= (def.minEffort ?? 0) ? supported : 0;
    // 3. Take only what that fraction needs. Any part of a trip needs a whole truck. A rejected action takes nothing.
    for (const { r, avail, g } of support) {
      const used = fraction <= 0 ? 0 : r.key === "vehicles" ? Math.ceil(r.amount * fraction - 1e-9) : Math.round(r.amount * fraction * 1000) / 1000;
      if (r.key === "crewHours") hoursPool[r.department ?? d] = Math.max(0, avail - used);
      else pool[r.key] = Math.max(0, avail - used);
      granted[r.key] = g;
      rows.push({ department: d, action: def.id, key: r.key, requested: r.amount, granted: g, available: avail, used });
    }
    perDepartment[d] = { requests, granted, fraction: Math.round(fraction * 1000) / 1000, supported: Math.round(supported * 1000) / 1000 };
  }
  return {
    allocations: { rows, ruledBy: anyPrecedence ? "the priorities stated in today's orders, then initiative" : "officer initiative. No order stated a priority" },
    perDepartment,
  };
}

export { emphasis as priorityEmphasis };
