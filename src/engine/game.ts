// The reducer. A run is a seed plus an ordered stream of events; applying the
// stream reproduces every decision, allocation, effect, line and ending.
// Everything the client shows is derived from GameState.

import { ACTION_BY_ID } from "../content/actions";
import { CLARIFY_QUESTION, pickLine } from "../content/lines";
import { OFFICERS } from "../content/officers";
import { ORDERS_PER_DAY, initialWorld } from "../content/scenario";
import { evaluateEnding } from "./endings";
import { activeStanding, addressesSystem, applyOverrides, decayPrecedent, emptyPrecedent, isQuestion, isStandingOrder, learnPrecedent, makeStandingOrder, scopeOf, standingConflicts } from "./orders";
import { decideAll } from "./resolve";
import { THRESHOLDS } from "./thresholds";
import { executeDay } from "./tick";
import { TRUST_DELTA, clampTrust, initialTrust } from "./trust";
import type { DayReport, Decision, Department, GameEvent, GameState, Measurements, Mode, OrderRecord, PendingClarification, SpeechAct, Utterance } from "./types";

export const VERSION = "0.1.0";

export function newGame(seed: string, mode: Mode = "commander", scenario = "vesper"): GameState {
  const start: GameEvent = { kind: "start", seed, scenario, mode, version: VERSION };
  return {
    version: VERSION,
    seed,
    scenario,
    mode,
    day: 1,
    today: [],
    todayUtterances: [],
    ledger: [],
    standing: [],
    pending: [],
    precedent: emptyPrecedent(),
    trust: initialTrust(),
    world: initialWorld(),
    reports: [],
    ending: null,
    events: [start],
  };
}

export function ordersLeft(state: GameState): number {
  return Math.max(0, ORDERS_PER_DAY - state.today.length);
}

export function canOrder(state: GameState): boolean {
  return state.ending === null && ordersLeft(state) > 0;
}

/** The stance an officer takes toward an order, from the provisional decision and the measurements. */
function stance(state: GameState, d: Department, m: Measurements, decision: Decision): { act: SpeechAct; notes: string[] } {
  const doc = OFFICERS[d].doctrine;
  const notes: string[] = [];
  if (decision.basis === "clarification" && decision.clarify) {
    return { act: "clarify", notes: [`= reason: ${decision.clarify.reason.replace(/_/g, " ")}`] };
  }
  const conflicts = standingConflicts(state.standing, m).filter((c) => c.so.scope.includes(d));
  if (conflicts.length && doc.precedentWeight >= 0.6) {
    notes.push(`= conflicts with ${conflicts.map((c) => `${c.so.id} (${c.conflict.toFixed(2)})`).join(", ")} · precedent weight ${doc.precedentWeight.toFixed(2)}`);
    return { act: "challenge_precedent", notes };
  }
  const chosen = ACTION_BY_ID.get(decision.action);
  const absolute = m.nouls.absolute_language >= THRESHOLDS.absolute;
  const reckless = m.scores.risk_tolerance.score >= 2.3;
  if ((absolute || reckless) && (chosen?.risk ?? 0) >= 0.4) {
    notes.push(`= ${absolute ? `absolute language ${m.nouls.absolute_language.toFixed(2)}` : `risk tolerance ${m.scores.risk_tolerance.score.toFixed(1)}/3`} · the selected action has risk ${(chosen?.risk ?? 0).toFixed(2)}`);
    return { act: "warn", notes };
  }
  const spends = (chosen?.constraints?.preserve_reserve ?? 0) < 0 || (chosen?.constraints?.permission_to_use_reserve ?? 0) > 0 || (chosen?.priorities?.priority_fuel ?? 0) < 0 || (chosen?.priorities?.priority_medicine ?? 0) < 0 || (chosen?.priorities?.priority_infrastructure ?? 0) < 0;
  if (doc.riskAversion >= 0.6 && spends && (m.nouls.permission_to_use_reserve >= THRESHOLDS.constraint || m.nouls.permission_to_sacrifice_equipment >= THRESHOLDS.constraint || m.scores.resource_flexibility.score >= 2.4)) {
    notes.push(`= ${chosen?.label.toLowerCase()} spends a reserve · resource flexibility ${m.scores.resource_flexibility.score.toFixed(1)}/3`);
    return { act: "warn", notes };
  }
  const violated = chosen?.constraints ? Object.entries(chosen.constraints).filter(([c, w]) => (w ?? 0) < 0 && m.nouls[c as keyof typeof m.nouls] >= THRESHOLDS.constraint) : [];
  if (violated.length) {
    notes.push(`= complies · the action works against ${violated.map(([c]) => c.replace(/_/g, " ")).join(", ")}`);
    return { act: "object", notes };
  }
  if (conflicts.length) {
    notes.push(`= sets aside ${conflicts.map((c) => c.so.id).join(", ")} · precedent weight ${doc.precedentWeight.toFixed(2)}`);
    return { act: "object", notes };
  }
  if (m.nouls.gives_clear_priority >= THRESHOLDS.constraint) {
    notes.push(`= clear priority ${m.nouls.gives_clear_priority.toFixed(2)}`);
    return { act: "confirm_priority", notes };
  }
  return { act: "acknowledge", notes };
}

/** Applies a measured order: ledger, standing orders, precedent, clarification answers, provisional stances. */
export function applyOrder(state: GameState, text: string, measurements: Measurements): GameState {
  if (!canOrder(state)) return state;
  const next: GameState = structuredClone(state);
  const id = `O-${next.day}-${next.today.length + 1}`;
  const scope = scopeOf(measurements);
  const record: OrderRecord = { id, day: next.day, text, measurements, scope, standingOrderId: null, answered: [] };
  next.events.push({ kind: "order", day: next.day, text, measurements });

  const utterances: Utterance[] = [];
  const meta = addressesSystem(measurements) || isQuestion(measurements);
  if (meta) {
    // Not an order to the colony. It costs the slot and nobody moves.
    next.today.push(record);
    for (const d of scope.length ? scope : (["security", "logistics", "medical", "engineering"] as Department[]).slice(0, 1)) {
      const line = pickLine(next.seed, id, d, "routine");
      utterances.push({ department: d, day: next.day, act: "routine", lineId: line.id, text: line.text, notes: [isQuestion(measurements) ? "= That was a question, not an order. The status board holds the answer." : "= That was not addressed to the colony."], orderId: id });
    }
    next.todayUtterances.push(...utterances);
    return next;
  }

  // Answers to pending clarifications, measured per pending item in the order they were sent.
  const open = next.pending.filter((p) => !p.answeredBy);
  measurements.answers.forEach((p, j) => {
    const pending = open[j];
    if (pending && p >= THRESHOLDS.answers) {
      pending.answeredBy = id;
      record.answered.push(pending.id);
      next.trust[pending.department] = clampTrust(next.trust[pending.department] + TRUST_DELTA.answered);
    }
  });

  // Standing orders: overrides first, then whether this order is itself one.
  const superseded = applyOverrides(next.standing, measurements, id, next.day);
  if (isStandingOrder(measurements)) {
    const so = makeStandingOrder(record, next.standing.length + 1);
    next.standing.push(so);
    record.standingOrderId = so.id;
  }
  next.today.push(record);
  learnPrecedent(next.precedent, measurements, scope);

  // Trust reacts to the wording.
  for (const d of scope) {
    let t = next.trust[d];
    if (measurements.nouls.contradictory >= THRESHOLDS.contradictory) t += TRUST_DELTA.contradictory;
    if (measurements.nouls.conflicts_with_recent_order >= THRESHOLDS.conflictsWithRecent) t += TRUST_DELTA.reversal;
    if (measurements.scores.clarity.score >= 2.2) t += TRUST_DELTA.clear;
    next.trust[d] = clampTrust(t);
  }

  // Provisional decisions, for the acknowledgements and for clarifications the player can answer today.
  const decided = decideAll(next, next.world);
  for (const d of scope) {
    const decision = decided.find((x) => x.decision.department === d)!.decision;
    const { act, notes } = stance(next, d, measurements, decision);
    if (act === "clarify" && decision.clarify) {
      const pending: PendingClarification = { id: decision.clarify.pendingId, department: d, day: next.day, reason: decision.clarify.reason, orderId: id, answeredBy: null };
      if (!next.pending.some((p) => p.id === pending.id)) next.pending.push(pending);
      const question = CLARIFY_QUESTION[d][decision.clarify.reason];
      utterances.push({ department: d, day: next.day, act, lineId: `${d}.clarify.${decision.clarify.reason}`, text: question, notes, orderId: id });
      continue;
    }
    const line = pickLine(next.seed, id, d, act, lastLine(next, d), ACTION_BY_ID.get(decision.action)?.tags);
    if (record.standingOrderId) notes.push(`= recorded as standing order ${record.standingOrderId}`);
    if (superseded.length) notes.push(`= supersedes ${superseded.join(", ")}`);
    utterances.push({ department: d, day: next.day, act, lineId: line.id, text: line.text, notes, orderId: id });
  }
  next.todayUtterances.push(...utterances);
  return next;
}

function lastLine(state: GameState, d: Department): string | undefined {
  const all = [...state.reports.flatMap((r) => r.utterances), ...state.todayUtterances].filter((u) => u.department === d);
  return all[all.length - 1]?.lineId;
}

/** Report lines after execution, one per officer. */
function reportUtterances(state: GameState, decisions: Decision[], crewCasualties: Record<Department, number>): Utterance[] {
  const out: Utterance[] = [];
  for (const dec of decisions) {
    const d = dec.department;
    const def = ACTION_BY_ID.get(dec.action);
    const label = dec.basis === "clarification" ? "REQUEST CLARIFICATION" : def?.label ?? dec.action;
    const notes: string[] = [`= ${label.toLowerCase()}`];
    let act: SpeechAct;
    const fraction = dec.allocation?.fraction ?? 1;
    const unexpected = dec.effects.some((e) => e.path === "security.contact" || e.path === "security.reliefLost" || e.path.endsWith(".dead") || e.path === "vehicles.operational");
    if (dec.basis === "clarification") {
      act = "report_partial";
      notes.push(state.pending.some((p) => p.department === d && p.day === dec.day && p.answeredBy) ? "= The question was answered. The officer acted on the answer." : "= No answer came. The officer held to routine.");
    } else if (dec.basis === "routine") {
      act = "routine";
    } else if (crewCasualties[d] > 0 || unexpected) {
      act = "report_unexpected";
    } else if (fraction >= 0.8) act = "report_success";
    else if (fraction >= 0.3) act = "report_partial";
    else act = "report_failure";
    if (dec.allocation && fraction < 0.999) {
      const short = dec.allocation.requests.filter((r) => (dec.allocation!.granted[r.key] ?? 1) < 0.999).map((r) => `${r.key} ${Math.round((dec.allocation!.granted[r.key] ?? 0) * 100)}%`);
      if (short.length) notes.push(`= granted ${short.join(", ")}`);
    }
    for (const e of dec.effects.slice(0, 6)) notes.push(`= ${e.note}`);
    if (dec.basis === "initiative") notes.push("= No order. The officer acted on initiative.");
    const line = pickLine(state.seed, `report-${dec.day}`, d, act, lastLine(state, d), def?.tags);
    out.push({ department: d, day: dec.day, act, lineId: line.id, text: line.text, notes, orderId: dec.orders[dec.orders.length - 1] ?? null });
  }
  return out;
}

/** Executes the day: decisions, allocation, actions, night, crises, trust, ending. */
export function endDay(state: GameState): GameState {
  if (state.ending) return state;
  const next: GameState = structuredClone(state);
  next.events.push({ kind: "end_day", day: next.day });
  const outcome = executeDay(next);

  // Trust: casualties, starved orders, ignored questions, deaths.
  for (const dec of outcome.decisions) {
    const d = dec.department;
    let t = next.trust[d];
    if (dec.basis === "order") {
      t += TRUST_DELTA.crewCasualty * outcome.crewCasualties[d];
      const f = dec.allocation?.fraction ?? 1;
      if (f >= 0.8) t += TRUST_DELTA.success;
      else if (f < 0.4) t += TRUST_DELTA.starved;
    }
    t += TRUST_DELTA.deathsPerHead * outcome.deathsOvernight;
    next.trust[d] = clampTrust(t);
  }
  for (const p of next.pending) {
    if (!p.answeredBy && p.day === next.day) next.trust[p.department] = clampTrust(next.trust[p.department] + TRUST_DELTA.ignored);
  }

  const utterances = reportUtterances(next, outcome.decisions, outcome.crewCasualties);
  const report: DayReport = {
    day: next.day,
    decisions: outcome.decisions,
    allocations: outcome.allocations,
    night: outcome.night,
    newCrises: outcome.newCrises,
    resolved: outcome.resolved,
    utterances: [...next.todayUtterances, ...utterances],
    world: outcome.world,
    trust: { ...next.trust },
  };
  next.reports.push(report);
  next.ledger.push(...next.today);
  next.today = [];
  next.todayUtterances = [];
  // Questions expire with the day they were asked, answered or not.
  next.pending = [];
  decayPrecedent(next.precedent);
  next.world = outcome.world;
  next.day = outcome.world.day;
  next.ending = evaluateEnding(next);
  return next;
}

/** Rebuilds a state from its event stream. The replay format. */
export function replay(events: readonly GameEvent[]): GameState {
  const start = events[0];
  if (!start || start.kind !== "start") throw new Error("event stream must begin with start");
  let state = newGame(start.seed, start.mode, start.scenario);
  for (const e of events.slice(1)) {
    if (e.kind === "order") state = applyOrder(state, e.text, e.measurements);
    else if (e.kind === "end_day") state = endDay(state);
  }
  return state;
}

/** The state as it was at the start of a given day, for the replay scrubber. */
export function stateAtDay(events: readonly GameEvent[], day: number): GameState {
  const upto: GameEvent[] = [];
  for (const e of events) {
    if (e.kind === "end_day" && e.day >= day) break;
    if (e.kind === "order" && e.day >= day) continue;
    upto.push(e);
  }
  return replay(upto);
}

export { activeStanding };
