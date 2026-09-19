// The officer strip: four people, what each one made of today's orders.

import { ACTION_BY_ID } from "../content/actions";
import { DEPARTMENT_LABEL, OFFICER_LIST } from "../content/officers";
import { trustWord } from "../engine/trust";
import type { Department, GameState, Utterance } from "../engine/types";
import { ACT_LABEL } from "./format";

export function latestStance(state: GameState, d: Department): Utterance | null {
  const todays = state.todayUtterances.filter((u) => u.department === d);
  if (todays.length) return todays[todays.length - 1];
  return null;
}

export function OfficerStrip({ state, busy, selected, onSelect }: { state: GameState; busy: boolean; selected: Department | null; onSelect(d: Department): void }) {
  const last = state.reports[state.reports.length - 1];
  return (
    <div className="officers">
      {OFFICER_LIST.map((o) => {
        const stance = latestStance(state, o.id);
        const decision = last?.decisions.find((d) => d.department === o.id);
        const label = decision ? ACTION_BY_ID.get(decision.action)?.label : null;
        let body: React.ReactNode;
        let cls = "routine";
        if (busy && state.today.length >= 0) {
          body = (
            <span className="stance interpreting">
              <b>interpreting</b>
            </span>
          );
          cls = "interpreting";
        } else if (stance) {
          cls = stance.act;
          body = (
            <span className={`stance ${cls}`}>
              <b>{ACT_LABEL[stance.act]}</b> {stance.text}
            </span>
          );
        } else if (label && state.today.length === 0) {
          body = (
            <span className="stance routine">
              <b>last night</b> {label.toLowerCase()}
            </span>
          );
        } else {
          body = (
            <span className="stance routine">
              <b>—</b> <span className="dim">no orders for {DEPARTMENT_LABEL[o.id].toLowerCase()}</span>
            </span>
          );
        }
        return (
          <button key={o.id} className="officer" aria-pressed={selected === o.id} onClick={() => onSelect(o.id)} title={`Open ${o.name}'s trace`}>
            <img src={`/art/${o.short}-128.webp`} alt="" width={64} height={64} onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
            <span>
              <span className="who">
                <b>{o.name}</b>
                <span className="dept">{DEPARTMENT_LABEL[o.id]}</span>
              </span>
              <span className="traits">{o.traits}</span>
              {body}
            </span>
            <span className="trust" title="Trust in command">
              {trustWord(state.trust[o.id])}
            </span>
          </button>
        );
      })}
    </div>
  );
}
