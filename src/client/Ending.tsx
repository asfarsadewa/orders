// The end of the run and what it says about how you commanded.

import { OFFICERS } from "../content/officers";
import { runReport } from "../engine/report";
import type { GameState } from "../engine/types";
import { f2, pct } from "./format";

export function EndingScreen({ state, onReplay, onNew }: { state: GameState; onReplay(): void; onNew(): void }) {
  const e = state.ending!;
  const r = runReport(state);
  const rows: [string, React.ReactNode][] = [];
  if (r.mostAmbiguous) rows.push(["most ambiguous order", <><q>{r.mostAmbiguous.text}</q> · clarity {f2(r.mostAmbiguous.measurements.scores.clarity.score)}/3</>]);
  if (r.clearest && r.clearest !== r.mostAmbiguous) rows.push(["clearest order", <><q>{r.clearest.text}</q> · clarity {f2(r.clearest.measurements.scores.clarity.score)}/3</>]);
  if (r.mostExpensive) rows.push(["most expensive order", <><q>{r.mostExpensive.order.text}</q> · {r.mostExpensive.fuel} fuel</>]);
  if (r.largestDivergence) rows.push(["largest divergence", <>day {r.largestDivergence.day}: {Object.entries(r.largestDivergence.actions).map(([d, a]) => `${OFFICERS[d as keyof typeof OFFICERS].name} ${a.toLowerCase()}`).join(" · ")}</>]);
  if (r.challengedMost) rows.push(["challenged you most", <>{OFFICERS[r.challengedMost.department].name}, {r.challengedMost.count} times</>]);
  rows.push(["clarifications", <>{r.clarifications} asked · {r.answered} answered</>]);
  rows.push(["standing orders", <>{r.standingOrders}</>]);
  if (r.precedentConflicts) rows.push(["precedent conflicts", <>{r.precedentConflicts}</>]);
  if (r.clearButCostly.length) rows.push(["understood perfectly, strategically costly", <>{r.clearButCostly.slice(0, 2).map((o) => <q key={o.id}>{o.text}</q>)}</>]);
  if (r.sacrificed) rows.push(["resource you sacrificed most", <>{r.sacrificed.name}, down {pct(r.sacrificed.fraction)}</>]);
  rows.push(["crew casualties", <>{Object.entries(r.crewCasualties).map(([d, n]) => `${OFFICERS[d as keyof typeof OFFICERS].name} ${n}`).join(" · ")}</>]);
  rows.push(["trust at the end", <>{Object.entries(r.trust).map(([d, t]) => `${OFFICERS[d as keyof typeof OFFICERS].name} ${f2(t)}`).join(" · ")}</>]);
  const good = e.id === "colony_survives" || e.id === "evacuation";
  return (
    <div className="ending">
      <div>
        <div className="caps dim">day {Math.min(state.day, 14)} · {state.seed}</div>
        <h2 className={good ? "green" : e.id === "pyrrhic_survival" ? "amber" : "red"}>{e.title}</h2>
      </div>
      <p className="summary">{e.summary}</p>
      <div className="scores">
        <div className="stat">
          <span className="k">population</span>
          <span className="v">{pct(e.scores.population)}</span>
          <span className="s">
            {state.world.people.total} inside · {state.world.people.evacuated} out · {state.world.people.dead} dead
          </span>
        </div>
        <div className="stat">
          <span className="k">infrastructure</span>
          <span className="v">{pct(e.scores.infrastructure)}</span>
        </div>
        <div className="stat">
          <span className="k">resources</span>
          <span className="v">{pct(e.scores.resources)}</span>
        </div>
        <div className="stat">
          <span className="k">morale</span>
          <span className="v">{pct(e.scores.morale)}</span>
        </div>
        <div className="stat">
          <span className="k">officer confidence</span>
          <span className="v">{pct(e.scores.confidence)}</span>
        </div>
      </div>
      <div className="findings">
        {rows.map(([k, v]) => (
          <div className="finding" key={k}>
            <span className="k">{k}</span>
            <span className="v">{v}</span>
          </div>
        ))}
      </div>
      <div className="row">
        <button className="primary" onClick={onNew}>
          New run
        </button>
        <button className="ctl" onClick={onReplay}>
          Replay this run
        </button>
      </div>
    </div>
  );
}
