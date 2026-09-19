// Command history and reports: orders, what each officer said, and each night.

import { useEffect, useRef } from "react";
import { OFFICERS } from "../content/officers";
import { crossed } from "../engine/explain";
import type { DayReport, Effect, GameState, Measurements, OrderRecord, Utterance } from "../engine/types";
import { SCORE_IDS } from "../engine/types";
import { ACT_LABEL, f1, f2, human } from "./format";

function Vector({ m }: { m: Measurements }) {
  const hot = crossed(m).slice(0, 10);
  return (
    <div className="vector" aria-label="Measurements">
      <span className="sc">
        {m.objective.choice} {f2(m.objective.probabilities[m.objective.choice] ?? 0)}
      </span>
      {m.sector.choice !== "none" && <span className="sc">{m.sector.choice}</span>}
      {SCORE_IDS.map((id) => (
        <span className="sc" key={id}>
          {human(id)} {f1(m.scores[id].score)}
        </span>
      ))}
      {hot.map((c) => (
        <span key={c.id}>
          {human(c.id)} {f2(c.p)}
        </span>
      ))}
    </div>
  );
}

function Say({ u, onWhy }: { u: Utterance; onWhy?: () => void }) {
  return (
    <div className="entry say">
      <div className="who">
        <b>{OFFICERS[u.department].name}</b>
        <span className={`act ${u.act}`}>{ACT_LABEL[u.act]}</span>
      </div>
      <div className="text">{u.text}</div>
      {u.notes.length > 0 && (
        <div className="notes">
          {u.notes.map((n, i) => (
            <span key={i}>{n.replace(/^= /, "")}</span>
          ))}
        </div>
      )}
      {onWhy && (
        <button className="why" onClick={onWhy}>
          why
        </button>
      )}
    </div>
  );
}

function Order({ o, showVector }: { o: OrderRecord; showVector: boolean }) {
  return (
    <div className="entry order">
      <div className="meta">
        <span>
          {o.id} · you
        </span>
        <span>{o.scope.map((d) => d.slice(0, 3)).join(" ")}</span>
      </div>
      <div className="text">{o.text}</div>
      {showVector && <Vector m={o.measurements} />}
    </div>
  );
}

function tone(e: Effect): string {
  if (e.path === "people.dead" || e.path.endsWith(".dead")) return "bad";
  if (e.path === "morale") return (e.to as number) < (e.from as number) ? "bad" : "good";
  if (e.path === "people.trapped" || e.path === "people.critical") return (e.to as number) < (e.from as number) ? "good" : "bad";
  if (e.path === "people.injured") return (e.to as number) > (e.from as number) ? "bad" : "good";
  if (e.path === "roadOpen" || e.path === "security.contact") return "good";
  return "";
}

/** Bookkeeping lines the night sheet and the log both leave out. */
export const HIDE_NIGHT = /settles toward|Night fuel:|reservation is spent|stands down at dawn|mutiny line\.$|Generator output for the night|One more night of isolation|^Night: /;

/** Deduplicates the night's notes: one line per sentence. */
export function nightLines(effects: Effect[]): { note: string; tone: string }[] {
  const index = new Map<string, number>();
  const out: { note: string; tone: string }[] = [];
  for (const e of effects) {
    if (!e.note) continue;
    const t = tone(e);
    const i = index.get(e.note);
    if (i === undefined) {
      index.set(e.note, out.length);
      out.push({ note: e.note, tone: t });
    } else if (t === "bad" || (t === "good" && out[i].tone === "")) out[i].tone = t;
  }
  return out;
}

function Night({ r }: { r: DayReport }) {
  const lines = nightLines(r.night).filter((l) => !HIDE_NIGHT.test(l.note));
  return (
    <div className="entry night">
      <div className="text">
        Night {r.day} · {r.world.weather.kind} {r.world.weather.tempC} C
      </div>
      <div className="fx">
        {lines.slice(0, 14).map((l, i) => (
          <span key={i} className={l.tone}>
            {l.note}
          </span>
        ))}
        {lines.length > 14 && <span className="dim">{lines.length - 14} more lines are in the inspector.</span>}
      </div>
    </div>
  );
}

export function Log({ state, onWhy }: { state: GameState; onWhy(day: number, department: Utterance["department"]): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const showVector = state.mode === "analyst";
  const items: React.ReactNode[] = [];
  const unlockTrace = (day: number) => state.mode !== "iron" && (state.mode === "analyst" || day < state.day || state.ending !== null);
  for (const r of state.reports) {
    items.push(
      <div className="entry morning" key={`m${r.day}`}>
        Day {r.day}
      </div>,
    );
    const orders = state.ledger.filter((o) => o.day === r.day);
    for (const o of orders) {
      items.push(<Order key={o.id} o={o} showVector={showVector} />);
      for (const u of r.utterances.filter((u) => u.orderId === o.id && !u.act.startsWith("report") && u.act !== "routine")) {
        items.push(<Say key={`${o.id}-${u.department}`} u={u} />);
      }
    }
    items.push(<Night key={`n${r.day}`} r={r} />);
    for (const u of r.utterances.filter((u) => u.act.startsWith("report") || (u.act === "routine" && !u.orderId))) {
      items.push(<Say key={`r${r.day}-${u.department}`} u={u} onWhy={unlockTrace(r.day) ? () => onWhy(r.day, u.department) : undefined} />);
    }
  }
  if (!state.ending) {
    items.push(
      <div className="entry morning" key={`m${state.day}`}>
        Day {state.day}
      </div>,
    );
    for (const o of state.today) {
      items.push(<Order key={o.id} o={o} showVector={showVector} />);
      for (const u of state.todayUtterances.filter((u) => u.orderId === o.id)) items.push(<Say key={`${o.id}-${u.department}`} u={u} />);
    }
    if (state.today.length === 0 && state.reports.length === 0) {
      items.push(
        <div className="entry" key="hello">
          <div className="text dim">Day 1. Write your first order in the text box. The map and the status board show the colony.</div>
        </div>,
      );
    }
  }
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.today.length, state.reports.length, state.todayUtterances.length]);
  return (
    <div className="log" ref={ref}>
      {items}
    </div>
  );
}
