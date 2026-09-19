// Scrub through the run: order, interpretation, officer action, world delta.

import { useMemo, useState } from "react";
import { ACTION_BY_ID } from "../content/actions";
import { OFFICERS } from "../content/officers";
import { crossed } from "../engine/explain";
import type { GameState } from "../engine/types";
import { f2, human, nightLinesFor, pct } from "./replayFormat";
import { StatusBoard } from "./Status";
import { ColonyMap } from "./Map";

export function Replay({ state, onBack }: { state: GameState; onBack(): void }) {
  const [day, setDay] = useState(1);
  const report = state.reports.find((r) => r.day === day);
  const orders = state.ledger.filter((o) => o.day === day);
  const worldBefore = useMemo(() => (day === 1 ? null : state.reports.find((r) => r.day === day - 1)?.world ?? null), [state, day]);
  return (
    <div className="replay">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="scrub" role="tablist" aria-label="Day">
          {state.reports.map((r) => (
            <button key={r.day} className="tab" role="tab" aria-selected={r.day === day} onClick={() => setDay(r.day)}>
              {r.day}
            </button>
          ))}
        </div>
        <button className="ctl" onClick={onBack}>
          back to the report
        </button>
      </div>
      {report && (
        <div className="run" style={{ padding: 0 }}>
          <div className="panel map-panel">
            <header>
              <span>Vesper Station · morning of day {day + 1}</span>
              <span>{report.world.people.total} inside</span>
            </header>
            <ColonyMap world={report.world} selected={null} onSelect={() => undefined} />
          </div>
          <div className="panel log-panel" style={{ position: "static", maxHeight: "none" }}>
            <header>
              <span>Day {day}</span>
              <span>{orders.length} orders</span>
            </header>
            <div className="log">
              {orders.map((o) => (
                <div className="entry order" key={o.id}>
                  <div className="meta">
                    <span>{o.id}</span>
                    <span>{o.scope.join(" ")}</span>
                  </div>
                  <div className="text">{o.text}</div>
                  <div className="vector">
                    <span className="sc">
                      {o.measurements.objective.choice} {f2(o.measurements.objective.probabilities[o.measurements.objective.choice] ?? 0)}
                    </span>
                    {crossed(o.measurements)
                      .slice(0, 8)
                      .map((c) => (
                        <span key={c.id}>
                          {human(c.id)} {f2(c.p)}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
              {report.decisions.map((d) => (
                <div className="entry say" key={d.department}>
                  <div className="text" data-who={OFFICERS[d.department].name}>
                    {(ACTION_BY_ID.get(d.action)?.label ?? d.action).toLowerCase()} <span className="act">{d.basis}</span>
                  </div>
                  <div className="notes">
                    {d.effects.slice(0, 4).map((e, i) => (
                      <span key={i}>{e.note}</span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="entry night">
                <div className="text">Night {day}</div>
                <div className="fx">
                  {nightLinesFor(report).map((l, i) => (
                    <span key={i} className={l.tone}>
                      {l.note}
                    </span>
                  ))}
                </div>
              </div>
              {worldBefore && (
                <div className="entry">
                  <div className="notes">
                    <span>
                      morale {pct(worldBefore.morale)} → {pct(report.world.morale)} · dead {worldBefore.people.dead} → {report.world.people.dead} · fuel {Math.round(worldBefore.fuel.units)} → {Math.round(report.world.fuel.units)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="panel status-panel">
            <header>
              <span>Status after night {day}</span>
            </header>
            <StatusBoard world={report.world} />
          </div>
        </div>
      )}
    </div>
  );
}
