// The colony status board: the numbers the spec puts beside the map.

import { CRISIS_BY_ID } from "../content/crises";
import type { World } from "../engine/types";
import { days, pct } from "./format";

function Stat({ k, v, s, level, fill, cls }: { k: string; v: string; s?: string; level?: number; fill?: number; cls?: string }) {
  const tone = cls ?? (level === undefined ? "" : level < 0.25 ? "crit" : level < 0.5 ? "warn" : "");
  return (
    <div className={`stat ${tone}`}>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
      {s && <span className="s">{s}</span>}
      {fill !== undefined && (
        <span className="bar" aria-hidden="true">
          <i style={{ width: `${Math.round(Math.max(0, Math.min(1, fill)) * 100)}%` }} />
        </span>
      )}
    </div>
  );
}

export function StatusBoard({ world }: { world: World }) {
  const w = world;
  const patients = w.people.injured + w.people.critical;
  return (
    <>
      <div className="status">
        <Stat k="power" v={pct(w.power.output)} s={`battery ${pct(w.power.reserve)} · ${w.power.reservePolicy}${w.power.shedding ? " · shed" : ""}`} level={w.power.output} fill={w.power.output} />
        <Stat k="water" v={days(w.water.days)} s={`pumps ${pct(w.water.pumpHealth)}${w.water.pipesFrozen ? " · frozen" : ""}${w.water.contaminated ? " · fouled" : ""}`} level={w.water.days / 4} fill={w.water.days / 6} />
        <Stat k="food" v={days(w.food.days)} s={`${w.food.ration} rations`} level={w.food.days / 8} fill={w.food.days / 12} />
        <Stat k="medicine" v={pct(w.medicine.stock)} s={`${patients} patients · ${w.people.critical} critical`} level={w.medicine.stock} fill={w.medicine.stock} />
        <Stat k="fuel" v={String(Math.round(w.fuel.units))} s={`${w.vehicles.operational}/${w.vehicles.total} trucks${w.vehicles.held ? " held" : ""}${w.fuel.reservedForPumps ? " · 10 for pumps" : ""}`} level={w.fuel.units / 80} fill={w.fuel.units / 120} />
        <Stat k="morale" v={pct(w.morale)} s={w.lowMoraleDays ? `${w.lowMoraleDays} days below the line` : "above the line"} level={w.morale} fill={w.morale} />
        <Stat k="people" v={String(w.people.total)} s={`${w.people.trapped ? `${w.people.trapped} trapped · ` : ""}${w.people.dead} dead${w.people.evacuated ? ` · ${w.people.evacuated} out` : ""}`} cls={w.people.dead > 20 ? "crit" : w.people.dead > 5 ? "warn" : ""} />
        <Stat k="shelter" v={pct(w.shelter.integrity)} s={`generator ${pct(w.power.generatorHealth)}`} level={w.shelter.integrity} fill={w.shelter.integrity} />
      </div>
      <div className="crises">
        {w.crises.length === 0 && <span className="none">No active crisis.</span>}
        {w.crises.map((c) => {
          const t = CRISIS_BY_ID.get(c.template);
          return (
            <div className="crisis" key={c.id}>
              <span className={`tag ${c.severity < 0.5 ? "low" : ""}`}>{c.neglect >= 2 ? "!!" : "!"}</span>
              <span>{t?.describe(w, c) ?? c.template}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
