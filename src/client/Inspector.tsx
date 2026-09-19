// The trace. Every number that made a decision, in the words of the engine.

import { ACTION_BY_ID } from "../content/actions";
import { OFFICERS } from "../content/officers";
import { crossed } from "../engine/explain";
import { activeStanding, strongestPrecedent } from "../engine/orders";
import type { Decision, Department, GameState } from "../engine/types";
import { SCORE_IDS } from "../engine/types";
import { f1, f2, human, pct } from "./format";

export interface InspectorTarget {
  day: number;
  department: Department;
}

function Doctrine({ d, state }: { d: Department; state: GameState }) {
  const doc = OFFICERS[d].doctrine;
  const rows: [string, number][] = [
    ["literalness", doc.literalness],
    ["initiative", doc.initiative],
    ["risk aversion", doc.riskAversion],
    ["obedience", doc.obedience],
    ["precedent", doc.precedentWeight],
    ["trust", state.trust[d]],
  ];
  if (doc.urgencyResponse !== 1) rows.push(["urgency response", doc.urgencyResponse]);
  if (doc.resourceCaution !== 1) rows.push(["resource caution", doc.resourceCaution]);
  if (doc.lifePriority !== 1) rows.push(["life priority", doc.lifePriority]);
  if (doc.infrastructureWeight !== 1) rows.push(["infrastructure", doc.infrastructureWeight]);
  return (
    <div className="doctrine">
      {rows.map(([k, v]) => (
        <div key={k}>
          <span>{k} </span>
          <b>{f2(v)}</b>
        </div>
      ))}
    </div>
  );
}

function DecisionTrace({ d }: { d: Decision }) {
  const chosen = ACTION_BY_ID.get(d.action);
  const feasible = d.candidates.filter((c) => c.feasible).slice(0, 6);
  const infeasible = d.candidates.filter((c) => !c.feasible);
  return (
    <div className="trace">
      <div>
        <b>{chosen?.label ?? d.action}</b> <span className="dim">· {d.basis}</span>
      </div>
      {feasible.map((c) => (
        <div key={c.action}>
          <div className={`cand ${c.action === d.action ? "chosen" : ""}`}>
            <span>{ACTION_BY_ID.get(c.action)?.label ?? c.action}</span>
            <span className="u">{f2(c.utility)}</span>
          </div>
          {c.terms.map((t, i) => (
            <div className="term" key={i}>
              <span className={`v ${t.value < 0 ? "neg" : t.value > 0 ? "pos" : ""}`}>{t.value >= 0 ? "+" : "−"}{f2(Math.abs(t.value))}</span>
              <span>
                <span className="amber">{t.name}</span> {t.note}
              </span>
            </div>
          ))}
        </div>
      ))}
      {infeasible.length > 0 && <div className="dim">Not possible today: {infeasible.map((c) => `${ACTION_BY_ID.get(c.action)?.label ?? c.action} (${c.infeasibleReason})`).join(" · ")}</div>}
      {d.allocation && (
        <div style={{ marginTop: 8 }}>
          <span className="dim">allocation </span>
          {d.allocation.requests.length === 0 && <span className="dim">no request</span>}
          {d.allocation.requests.map((r) => (
            <span key={r.key} style={{ marginRight: 12 }}>
              {r.key} {r.key === "crewHours" ? `${r.amount}h` : r.amount % 1 ? f2(r.amount) : r.amount} → {pct(d.allocation!.granted[r.key] ?? 1)}
            </span>
          ))}
          <span className="dim">· fraction {f2(d.allocation.fraction)}</span>
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        {d.effects.length === 0 && <span className="dim">No effect on the world today.</span>}
        {d.effects.map((e, i) => (
          <div className="fx" key={i}>
            {e.path} {String(e.from)} → {String(e.to)} · {e.note}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Inspector({ state, target, onClose }: { state: GameState; target: InspectorTarget; onClose(): void }) {
  const { day, department } = target;
  const officer = OFFICERS[department];
  const report = state.reports.find((r) => r.day === day);
  const decision = report?.decisions.find((d) => d.department === department);
  const orders = (day === state.day ? state.today : state.ledger.filter((o) => o.day === day)).filter((o) => o.scope.includes(department));
  const locked = state.mode === "iron" && !state.ending;
  const vectorLocked = state.mode === "commander" && day === state.day && !state.ending;
  const standing = activeStanding(state.standing).filter((s) => s.scope.includes(department));
  const learned = strongestPrecedent(state.precedent, department);
  return (
    <aside className="drawer" role="dialog" aria-label={`${officer.name} trace`}>
      <header>
        <h3>
          {officer.name} · {department} · day {day}
        </h3>
        <button className="ctl" onClick={onClose}>
          close
        </button>
      </header>
      {locked && <div className="locked">Iron Command: the trace opens when the run ends.</div>}
      {!locked && (
        <>
          <section>
            <h4>doctrine</h4>
            <Doctrine d={department} state={state} />
          </section>
          <section>
            <h4>orders this day for {department}</h4>
            {orders.length === 0 && <div className="dim">None. The officer acted on initiative or routine.</div>}
            {orders.map((o) => (
              <div key={o.id} style={{ marginBottom: 10 }}>
                <div>
                  <span className="dim">{o.id} </span>
                  {o.text}
                </div>
                {vectorLocked ? (
                  <div className="dim">The measurement opens after you end the day.</div>
                ) : (
                  <div className="vector">
                    <span className="sc">
                      objective {o.measurements.objective.choice} {f2(o.measurements.objective.probabilities[o.measurements.objective.choice] ?? 0)}
                    </span>
                    <span className="sc">sector {o.measurements.sector.choice}</span>
                    {SCORE_IDS.map((id) => (
                      <span className="sc" key={id}>
                        {human(id)} {f1(o.measurements.scores[id].score)}
                      </span>
                    ))}
                    {crossed(o.measurements).map((c) => (
                      <span key={c.id}>
                        {human(c.id)} {f2(c.p)} ≥ {f2(c.gate)}
                      </span>
                    ))}
                    {o.measurements.standing.map((s, i) => (
                      <span key={`so${i}`} className="sc">
                        standing {i + 1} conflict {f2(s.conflict)} override {f2(s.override)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
          <section>
            <h4>memory</h4>
            {standing.length === 0 && !learned && <div className="dim">No standing orders in scope. No record yet.</div>}
            {standing.map((s) => (
              <div key={s.id}>
                <span className="amber">{s.id}</span> <span className="dim">day {s.issuedDay}</span> {s.text}
              </div>
            ))}
            {learned && (
              <div>
                <span className="dim">record: </span>
                {human(learned.priority)} {f2(learned.weight)}
              </div>
            )}
          </section>
          <section>
            <h4>decision</h4>
            {decision ? <DecisionTrace d={decision} /> : <div className="dim">{day === state.day ? "Not executed yet. End the day to see the action." : "No record."}</div>}
          </section>
        </>
      )}
    </aside>
  );
}
