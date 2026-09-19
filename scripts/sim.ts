// Seeded batch runs with scripted commanders, no model calls. Measures the
// deterministic game: survival distribution, endings, clarification rate,
// action diversity, bottlenecks. Tune the game here, not the model.
//
//   npm run sim                      200 seeds × every commander
//   npm run sim -- --seeds 50 --commander careful
//   npm run sim -- --trace seed-7    print one run's day-by-day trace

import { ACTION_BY_ID } from "../src/content/actions";
import { RUN_DAYS } from "../src/content/scenario";
import { explainDecision } from "../src/engine/explain";
import { applyOrder, endDay, newGame } from "../src/engine/game";
import type { GameState, Measurements } from "../src/engine/types";
import { CHEN_PUMPS_FIRST, CIVILIANS_FIRST, DIG_OUT, EVACUATE_B, FIRE_FALLBACK, ILYA_LOOK, POWER_MEDICAL, SAVE_EVERYONE, VAGUE_WATER, VALE_CRITICAL, vector } from "../test/fixtures";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const SEEDS = Number(opt("seeds") ?? 200);
const ONLY = opt("commander");
const TRACE = opt("trace");

type Commander = (s: GameState) => { text: string; m: Measurements }[];

const HOLD_GATE = vector({ objective: "defend", sector: "perimeter", scope: ["security"], nouls: { priority_security: 0.8, maintain_position: 0.8, avoid_combat: 0.6 }, scores: { urgency: 2, clarity: 2.7, specificity: 2.5 } });
const REPAIR_PUMPS = vector({ objective: "repair", sector: "works", scope: ["engineering"], nouls: { priority_water: 0.9, priority_infrastructure: 0.6 }, scores: { urgency: 2.2, clarity: 2.7, specificity: 2.5 } });
const RESERVE_PUMPS = vector({ objective: "conserve", sector: "works", scope: ["logistics"], nouls: { priority_water: 0.85, preserve_reserve: 0.9, priority_fuel: 0.7 }, scores: { urgency: 2, clarity: 2.8, specificity: 2.6 } });
const REDUCE_RATIONS = vector({ objective: "conserve", scope: ["logistics"], nouls: { priority_food: 0.9, resource_cap_present: 0.7 }, scores: { urgency: 1.5, clarity: 2.8, specificity: 2.2 } });
const TREAT_ALL = vector({ objective: "treat", sector: "infirmary", scope: ["medical"], nouls: { priority_wounded: 0.9, priority_people: 0.8, permission_to_use_reserve: 0.6 }, scores: { urgency: 2.4, clarity: 2.7, resource_flexibility: 2.4 } });
const BRIDGE = vector({ objective: "restore_power", scope: ["engineering"], nouls: { permission_to_use_reserve: 0.9, priority_people: 0.7 }, scores: { urgency: 2.5, clarity: 2.7, resource_flexibility: 2.5 } });
const THAW = vector({ objective: "repair", sector: "works", scope: ["engineering"], nouls: { priority_water: 0.9 }, scores: { urgency: 2.5, clarity: 2.8, specificity: 2.6 } });
const NEGOTIATE = vector({ objective: "negotiate", sector: "perimeter", scope: ["security"], nouls: { avoid_combat: 0.9, priority_people: 0.6 }, scores: { urgency: 2, clarity: 2.7, specificity: 2.4 } });
const SHELTER = vector({ objective: "evacuate", sector: "habitat", scope: ["logistics"], nouls: { priority_people: 0.9 }, scores: { urgency: 2.5, clarity: 2.7, specificity: 2.4 } });

export const COMMANDERS: Record<string, Commander> = {
  /** Never speaks. The officers run the colony on routine and initiative. */
  silent: () => [],
  /** Reacts to the biggest problem each day with a clear, well-owned order. */
  careful: (s) => {
    const w = s.world;
    const out: { text: string; m: Measurements }[] = [];
    if (w.people.trapped > 0) out.push({ text: "Get the trapped out of Habitat.", m: DIG_OUT });
    if (w.sectors.core.fire > 0) out.push({ text: "Fight the fire in the core.", m: FIRE_FALLBACK });
    if (w.water.pipesFrozen) out.push({ text: "Thaw the pipes.", m: THAW });
    else if (w.water.pumpHealth < 0.6) out.push({ text: "Repair the pumps.", m: REPAIR_PUMPS });
    if (w.security.contact === "unknown" && w.security.threat > 0.3) out.push({ text: "Ilya, look, do not engage.", m: ILYA_LOOK });
    else if (w.security.contact === "refugees" || w.security.contact === "relief") out.push({ text: "Talk to them at the gate.", m: NEGOTIATE });
    else if (w.security.contact === "raiders" && w.security.threat > 0.45) out.push({ text: "Hold the gate.", m: HOLD_GATE });
    if (w.power.output < 0.55 && w.water.days < 3) out.push({ text: "Reserve fuel for the pumps.", m: RESERVE_PUMPS });
    if (w.power.output < 0.5 && w.power.reserve > 0.4 && w.weather.tempC < -10) out.push({ text: "Bridge with the battery.", m: BRIDGE });
    if (!w.sectors.habitat.heated && w.weather.tempC < -10) out.push({ text: "Shelter people in the core.", m: SHELTER });
    if (w.food.days < 5 && w.food.ration === "full") out.push({ text: "Reduce rations.", m: REDUCE_RATIONS });
    if (w.people.critical > 6) out.push({ text: "Treat everyone.", m: TREAT_ALL });
    if (w.medicine.stock < 0.2) out.push({ text: "Vale, critical only.", m: VALE_CRITICAL });
    return out.slice(0, 3);
  },
  /** Speaks in absolutes and vagueness. */
  vague: (s) => {
    const w = s.world;
    const out: { text: string; m: Measurements }[] = [];
    out.push({ text: "Save everyone.", m: SAVE_EVERYONE });
    if (w.water.days < 3) out.push({ text: "Do something about the water.", m: VAGUE_WATER });
    if (w.power.output < 0.6) out.push({ text: "Restore power to medical immediately.", m: POWER_MEDICAL });
    return out.slice(0, 3);
  },
  /** The spec's example commander: evacuation, standing doctrine, answers Chen. */
  spec: (s) => {
    const out: { text: string; m: Measurements }[] = [];
    if (s.day === 1) out.push({ text: "Protect civilians above everything else.", m: CIVILIANS_FIRST });
    if (s.world.people.trapped > 0 || s.world.sectors.habitat.fire > 0) out.push({ text: "Get Sector B evacuated before dark.", m: EVACUATE_B });
    if (s.pending.some((p) => p.department === "logistics" && !p.answeredBy)) out.push({ text: "Chen, pumps first.", m: CHEN_PUMPS_FIRST });
    if (s.world.sectors.core.fire > 0) out.push({ text: "Fight the fire.", m: FIRE_FALLBACK });
    return out.slice(0, 3);
  },
};

function run(seed: string, commander: Commander): GameState {
  let s = newGame(seed, "analyst");
  while (!s.ending && s.day <= RUN_DAYS) {
    for (const o of commander(s)) s = applyOrder(s, o.text, o.m);
    s = endDay(s);
  }
  return s;
}

function trace(seed: string, commander: Commander): void {
  let s = newGame(seed, "analyst");
  while (!s.ending && s.day <= RUN_DAYS) {
    console.log(`\n=== DAY ${s.day} · ${s.world.weather.kind} ${s.world.weather.tempC} C · power ${Math.round(s.world.power.output * 100)}% · water ${s.world.water.days.toFixed(1)}d · food ${s.world.food.days.toFixed(1)}d · fuel ${Math.round(s.world.fuel.units)} · med ${Math.round(s.world.medicine.stock * 100)}% · morale ${Math.round(s.world.morale * 100)}% · trust ${Object.values(s.trust).map((t) => t.toFixed(2)).join('/')} · people ${s.world.people.total} (inj ${s.world.people.injured}, crit ${s.world.people.critical}, trapped ${s.world.people.trapped}, dead ${s.world.people.dead})`);
    for (const c of s.world.crises) console.log(`  ! ${c.template} (${c.sector}, neglect ${c.neglect})`);
    for (const o of commander(s)) {
      s = applyOrder(s, o.text, o.m);
      console.log(`  > ${o.text}`);
      for (const u of s.todayUtterances.filter((u) => u.orderId === s.today[s.today.length - 1].id)) console.log(`    ${u.department}: ${u.act} "${u.text}" ${u.notes.join(" ")}`);
    }
    s = endDay(s);
    const r = s.reports[s.reports.length - 1];
    for (const d of r.decisions) console.log(`  ${d.department}: ${ACTION_BY_ID.get(d.action)?.label} (${d.basis}, fraction ${d.allocation?.fraction ?? 1})`);
    for (const e of r.night.slice(0, 12)) console.log(`    · ${e.note}`);
    if (r.newCrises.length) console.log(`  new: ${r.newCrises.map((c) => c.template).join(", ")}`);
    if (args.includes("--explain")) for (const d of r.decisions) console.log(explainDecision(s, d).join("\n"));
  }
  console.log(`\nENDING: ${s.ending?.title} — ${s.ending?.summary}`);
  console.log(JSON.stringify(s.ending?.scores));
}

function main(): void {
  if (TRACE) {
    trace(TRACE, COMMANDERS[ONLY ?? "careful"]);
    return;
  }
  for (const [name, commander] of Object.entries(COMMANDERS)) {
    if (ONLY && name !== ONLY) continue;
    const endings = new Map<string, number>();
    const actions = new Map<string, number>();
    let alive = 0;
    let dead = 0;
    let evac = 0;
    let clar = 0;
    let orders = 0;
    let days = 0;
    let starved = 0;
    for (let i = 0; i < SEEDS; i++) {
      const s = run(`seed-${i}`, commander);
      endings.set(s.ending!.id, (endings.get(s.ending!.id) ?? 0) + 1);
      alive += s.world.people.total;
      dead += s.world.people.dead;
      evac += s.world.people.evacuated;
      days += s.reports.length;
      for (const r of s.reports) {
        for (const d of r.decisions) {
          actions.set(d.action, (actions.get(d.action) ?? 0) + 1);
          if (d.basis === "clarification") clar++;
          if (d.basis === "order" && (d.allocation?.fraction ?? 1) < 0.5) starved++;
        }
      }
      orders += s.ledger.length;
    }
    console.log(`\n## ${name} (${SEEDS} seeds)`);
    console.log(`endings: ${[...endings.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${((100 * v) / SEEDS).toFixed(0)}%`).join(" · ")}`);
    console.log(`mean alive ${(alive / SEEDS).toFixed(1)} · dead ${(dead / SEEDS).toFixed(1)} · evacuated ${(evac / SEEDS).toFixed(1)} · days ${(days / SEEDS).toFixed(1)} · orders ${(orders / SEEDS).toFixed(1)} · clarifications ${(clar / SEEDS).toFixed(2)} · starved actions ${(starved / SEEDS).toFixed(2)}`);
    const top = [...actions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
    console.log(`actions: ${top.map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  }
}

if (process.argv[1]?.endsWith("sim.ts")) main();
