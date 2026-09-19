// The trace, as text. The inspector and the sim script print these; the
// numbers are the same ones the resolver used.

import { ACTION_BY_ID } from "../content/actions";
import { OFFICERS } from "../content/officers";
import { NOUL_IDS, SCORE_IDS, type Decision, type GameState, type Measurements } from "./types";
import { noulThreshold } from "./thresholds";

const f2 = (x: number) => (Math.round(x * 100) / 100).toFixed(2);

/** The measurements that crossed their gates, most confident first. */
export function crossed(m: Measurements): { id: string; p: number; gate: number }[] {
  return NOUL_IDS.filter((id) => m.nouls[id] >= noulThreshold(id))
    .map((id) => ({ id, p: m.nouls[id], gate: noulThreshold(id) }))
    .sort((a, b) => b.p - a.p);
}

export function explainMeasurements(m: Measurements): string[] {
  const out: string[] = [];
  out.push(`objective ${m.objective.choice} ${f2(m.objective.probabilities[m.objective.choice] ?? 0)} · owner ${m.owner.choice} ${f2(m.owner.probabilities[m.owner.choice] ?? 0)} · sector ${m.sector.choice} ${f2(m.sector.probabilities[m.sector.choice] ?? 0)} · timeframe ${m.timeframe.choice}`);
  out.push(SCORE_IDS.map((id) => `${id.replace(/_/g, " ")} ${f2(m.scores[id].score)}`).join(" · "));
  for (const c of crossed(m)) out.push(`${c.id.replace(/_/g, " ")} ${f2(c.p)} ≥ ${f2(c.gate)}`);
  m.standing.forEach((s, i) => out.push(`standing ${i + 1}: conflict ${f2(s.conflict)} · override ${f2(s.override)}`));
  m.answers.forEach((a, j) => out.push(`answers question ${j + 1}: ${f2(a)}`));
  return out;
}

export function explainDecision(state: GameState, d: Decision): string[] {
  const out: string[] = [];
  const officer = OFFICERS[d.department];
  const doc = officer.doctrine;
  out.push(`${officer.name.toUpperCase()} / ${d.department.toUpperCase()} · day ${d.day}`);
  out.push(`doctrine: literalness ${f2(doc.literalness)} · initiative ${f2(doc.initiative)} · risk aversion ${f2(doc.riskAversion)} · obedience ${f2(doc.obedience)} · precedent ${f2(doc.precedentWeight)} · trust ${f2(state.reports.find((r) => r.day === d.day)?.trust[d.department] ?? state.trust[d.department])}`);
  const chosen = ACTION_BY_ID.get(d.action);
  out.push(`decision: ${chosen?.label ?? d.action} (${d.basis})`);
  const top = d.candidates.filter((c) => c.feasible).slice(0, 5);
  for (const c of top) {
    const def = ACTION_BY_ID.get(c.action);
    out.push(`  ${c.action === d.action ? "▸" : " "} ${def?.label ?? c.action} = ${f2(c.utility)}`);
    for (const t of c.terms) out.push(`      ${t.value >= 0 ? "+" : "−"}${f2(Math.abs(t.value))} ${t.name}: ${t.note}`);
  }
  const infeasible = d.candidates.filter((c) => !c.feasible);
  if (infeasible.length) out.push(`  infeasible: ${infeasible.map((c) => `${ACTION_BY_ID.get(c.action)?.label ?? c.action} (${c.infeasibleReason})`).join("; ")}`);
  if (d.allocation) {
    const rows = d.allocation.requests.map((r) => `${r.key} ${r.amount}${r.key === "crewHours" ? "h" : ""} → ${Math.round((d.allocation!.granted[r.key] ?? 1) * 100)}%`);
    out.push(`allocation: ${rows.join(" · ") || "nothing requested"} · fraction ${f2(d.allocation.fraction)}`);
  }
  for (const e of d.effects) out.push(`  = ${e.path}: ${String(e.from)} → ${String(e.to)} · ${e.note}`);
  return out;
}
