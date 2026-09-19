// The night, as a sheet: what the officers did, what the world did, what they
// say in the morning. Then the day begins.

import { useEffect, useState } from "react";
import { ACTION_BY_ID } from "../content/actions";
import { CRISIS_BY_ID } from "../content/crises";
import { OFFICERS } from "../content/officers";
import type { DayReport } from "../engine/types";
import { audio } from "./audio";
import { ACT_LABEL } from "./format";
import { HIDE_NIGHT as HIDE, nightLines } from "./Log";

export function NightSheet({ report, onDone }: { report: DayReport; onDone(): void }) {
  const lines = nightLines(report.night).filter((l) => !HIDE.test(l.note));
  const [shown, setShown] = useState(0);
  const reports = report.utterances.filter((u) => u.act.startsWith("report") || (u.act === "routine" && u.day === report.day && !u.orderId));
  const total = lines.length + reports.length;
  useEffect(() => {
    audio.music("night");
    setShown(0);
    const id = window.setInterval(() => setShown((n) => (n >= total ? n : n + 1)), 140);
    return () => window.clearInterval(id);
  }, [report.day, total]);
  useEffect(() => {
    const deaths = report.night.some((e) => e.path === "people.dead");
    if (shown === Math.min(total, lines.length) && lines.length) audio.sfx(deaths ? "loss" : "dawn");
  }, [shown, lines.length, total, report.night]);
  // Voice the reports as they appear.
  useEffect(() => {
    const idx = shown - lines.length - 1;
    if (idx >= 0 && idx < reports.length) void audio.speak(reports[idx].lineId);
  }, [shown, lines.length, reports]);
  const done = shown >= total;
  return (
    <div className="night-overlay" role="dialog" aria-label={`Night ${report.day}`}>
      <div className="sheet">
        <header>
          <b>Night {report.day}</b>
          <span className="dim">
            {report.world.weather.kind} · {report.world.weather.tempC} C
          </span>
        </header>
        <div className="list">
          {report.decisions.map((d) => (
            <span key={d.department} className="quiet">
              {OFFICERS[d.department].name}: {(ACTION_BY_ID.get(d.action)?.label ?? d.action).toLowerCase()}
              {d.basis === "initiative" ? " (unordered)" : d.basis === "clarification" ? " (waiting for an answer)" : ""}
              {d.allocation && d.allocation.fraction < 0.999 ? ` · ${Math.round(d.allocation.fraction * 100)}% of what it needed` : ""}
            </span>
          ))}
          {lines.slice(0, shown).map((l, i) => (
            <span key={i} className={l.tone}>
              {l.note}
            </span>
          ))}
          {report.newCrises.length > 0 && shown >= lines.length && (
            <span className="bad">New: {report.newCrises.map((c) => CRISIS_BY_ID.get(c.template)?.title ?? c.template).join(", ")}.</span>
          )}
          {report.resolved.length > 0 && shown >= lines.length && <span className="good">Resolved: {report.resolved.map((id) => id.replace(/-\d+$/, "").replace(/_/g, " ")).join(", ")}.</span>}
        </div>
        <div className="reports">
          {reports.slice(0, Math.max(0, shown - lines.length)).map((u) => (
            <div className="entry say" key={u.department}>
              <div className="who">
                <b>{OFFICERS[u.department].name}</b>
                <span className={`act ${u.act}`}>{ACT_LABEL[u.act]}</span>
              </div>
              <div className="text">{u.text}</div>
              {u.notes.length > 0 && (
                <div className="notes">
                  {u.notes.slice(0, 5).map((n, i) => (
                    <span key={i}>{n.replace(/^= /, "")}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="actions">
          <button className={done ? "primary" : "ctl"} onClick={done ? onDone : () => setShown(total)}>
            {done ? `Day ${report.day + 1}` : "skip"}
          </button>
        </div>
      </div>
    </div>
  );
}
