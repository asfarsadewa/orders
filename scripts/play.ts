// A scripted playthrough with the real judge: authored natural-language orders
// go through Jev exactly as the browser sends them, and the engine runs the
// days. Prints a transcript. Costs a few cents. Needs TYPESAFE_API_KEY.
//
//   npx tsx scripts/play.ts                        a full run on seed "play-1"
//   npx tsx scripts/play.ts --seed x               another seed
//   npx tsx scripts/play.ts --explain 4 security   replay the saved stream, no model, print one trace
//
// The event stream is saved to node_modules/.cache/play-<seed>.json.

import { TypeSafeClient } from "@typesafe-ai/sdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ACTION_BY_ID } from "../src/content/actions";
import { OFFICERS } from "../src/content/officers";
import { RUN_DAYS } from "../src/content/scenario";
import { crossed, explainDecision } from "../src/engine/explain";
import { applyOrder, endDay, newGame, stateAtDay } from "../src/engine/game";
import { runReport } from "../src/engine/report";
import type { Department, GameEvent, GameState } from "../src/engine/types";
import { MODEL, buildQuestions, toMeasurements } from "../src/judge/questions";
import { buildJudgeState } from "../src/judge/state";

const args = process.argv.slice(2);
const seed = args.includes("--seed") ? args[args.indexOf("--seed") + 1] : "play-1";
const saveFile = `node_modules/.cache/play-${seed}.json`;

function explain(): void {
  const i = args.indexOf("--explain");
  const day = Number(args[i + 1]);
  const dept = args[i + 2] as Department;
  if (!existsSync(saveFile)) throw new Error(`no saved run at ${saveFile}`);
  const events = JSON.parse(readFileSync(saveFile, "utf8")) as GameEvent[];
  const s = endDay(stateAtDay(events.filter((e) => e.kind !== "end_day" || e.day <= day), day));
  const d = s.reports[s.reports.length - 1]?.decisions.find((x) => x.department === dept);
  if (!d) throw new Error(`no decision for ${dept} on day ${day}`);
  console.log(explainDecision(s, d).join("\n"));
}

if (args.includes("--explain")) {
  explain();
  process.exit(0);
}

const client = new TypeSafeClient({ timeout: 30_000, retry: { maxRetries: 2 }, logLevel: "warn" });

/** What a thoughtful commander might write, given what the day shows. */
function commander(s: GameState): string[] {
  const w = s.world;
  const out: string[] = [];
  if (s.day === 1) {
    out.push("From now on, civilian life comes before equipment. Nobody risks the reactor, but people come first.");
    out.push("Ilya, find out what is moving outside the fence. Do not engage, do not go past the road, and be back before dark.");
  }
  if (w.people.trapped > 0) out.push("Get the trapped people out of Habitat. Orlov shores up the roof, Ilya's squad digs, Vale has medics standing by at the entrance.");
  if (w.sectors.core.fire > 0) out.push("Fight the fire in the core. If you can't hold it, isolate the generator and let the batteries carry us.");
  if (w.water.pipesFrozen) out.push("Orlov, thaw the pipes today. Use fuel for the heaters if you must.");
  else if (w.water.pumpHealth < 0.6 && w.sectors.works.fire === 0) out.push("Do something about the water.");
  if (s.pending.some((p) => p.department === "logistics" && !p.answeredBy)) out.push("Chen, the pumps come first. Fuel them, then the trucks with what is left.");
  if (s.pending.some((p) => p.department === "engineering" && !p.answeredBy)) out.push("Orlov: the pumps. Repair the pumps, nothing else, and keep the works heated tonight.");
  if (w.security.contact === "refugees" && w.security.admitted === 0) out.push("Let the refugees in, but only the children and the wounded. Feed them from the reserve.");
  if (w.security.contact === "raiders" && w.security.threat > 0.45) out.push("Ilya, hold the gate. Nobody in, nobody out. If they try to force it, you are cleared to fire.");
  if (w.security.contact === "relief" && w.security.reliefDay === null) out.push("Ilya, talk to the scouts at the pass. Tell them we have wounded and can move by truck.");
  if (w.power.output < 0.5 && w.power.reserve > 0.4) out.push("Restore power to medical immediately. Use the emergency reserve if necessary.");
  if (w.food.days < 5 && w.food.ration === "full") out.push("Chen, cut rations to two thirds until the road opens.");
  if (w.medicine.stock < 0.2 && w.medicine.policy === "full") out.push("Vale, treat only the critical. We need the medicine to last.");
  if (w.roadOpen) out.push("Chen, start moving people out to the pass, the wounded first. Ilya escorts every convoy.");
  return out.slice(0, 3);
}

async function measure(s: GameState, text: string) {
  const state = buildJudgeState(s, text);
  const t0 = performance.now();
  const r = await client.systemOne({ state: state as unknown as Record<string, never>, questions: buildQuestions(state), model: MODEL });
  return { m: toMeasurements(r.answers, state), ms: Math.round(performance.now() - t0), tokens: r.usage.input_tokens + r.usage.output_tokens };
}

async function main(): Promise<void> {
  let s = newGame(seed, "analyst");
  let totalTokens = 0;
  while (!s.ending && s.day <= RUN_DAYS) {
    const w = s.world;
    console.log(`\n=== DAY ${s.day} · ${w.weather.kind} ${w.weather.tempC} C · power ${Math.round(w.power.output * 100)}% · water ${w.water.days.toFixed(1)}d · food ${w.food.days.toFixed(1)}d · fuel ${Math.round(w.fuel.units)} · med ${Math.round(w.medicine.stock * 100)}% · morale ${Math.round(w.morale * 100)}% · people ${w.people.total} (trapped ${w.people.trapped}, dead ${w.people.dead}) · trust ${Object.values(s.trust).map((t) => t.toFixed(2)).join("/")}`);
    for (const c of w.crises) console.log(`  ! ${c.template}`);
    for (const text of commander(s)) {
      const { m, ms, tokens } = await measure(s, text);
      totalTokens += tokens;
      s = applyOrder(s, text, m);
      const o = s.today[s.today.length - 1];
      console.log(`  > ${text}`);
      console.log(`    [${ms} ms] ${m.objective.choice} ${m.objective.probabilities[m.objective.choice]?.toFixed(2)} · ${m.sector.choice} · scope ${o.scope.join(",")} · clarity ${m.scores.clarity.score.toFixed(1)} · ${crossed(m).slice(0, 7).map((c) => `${c.id} ${c.p.toFixed(2)}`).join(", ")}${m.standing.length ? ` · so ${m.standing.map((x) => `${x.conflict.toFixed(2)}/${x.override.toFixed(2)}`).join(" ")}` : ""}${m.answers.length ? ` · answers ${m.answers.map((a) => a.toFixed(2)).join(" ")}` : ""}${o.standingOrderId ? ` · ${o.standingOrderId}` : ""}`);
      for (const u of s.todayUtterances.filter((u) => u.orderId === o.id)) console.log(`    ${OFFICERS[u.department].name}: ${u.act} "${u.text}" ${u.notes.join(" ")}`);
    }
    s = endDay(s);
    const r = s.reports[s.reports.length - 1];
    for (const d of r.decisions) console.log(`  ${OFFICERS[d.department].name}: ${ACTION_BY_ID.get(d.action)?.label} (${d.basis}${d.allocation && d.allocation.fraction < 0.999 ? `, ${Math.round(d.allocation.fraction * 100)}%` : ""})`);
    for (const e of r.night.filter((e) => /died|injur|froze|Raid|fire|trapped|refugee|relief|road/i.test(e.note)).slice(0, 8)) console.log(`    · ${e.note}`);
    if (r.newCrises.length) console.log(`  new: ${r.newCrises.map((c) => c.template).join(", ")}`);
  }
  writeFileSync(saveFile, JSON.stringify(s.events));
  console.log(`\nENDING: ${s.ending?.title} — ${s.ending?.summary}`);
  const rep = runReport(s);
  console.log(`orders ${rep.orders} · clarifications ${rep.clarifications} (${rep.answered} answered) · standing ${rep.standingOrders} · deaths ${rep.deaths} · tokens ${totalTokens} (about $${((totalTokens * 42) / 1e9).toFixed(3)})`);
  if (rep.largestDivergence) console.log(`largest divergence day ${rep.largestDivergence.day}: ${Object.entries(rep.largestDivergence.actions).map(([d, a]) => `${d} ${a}`).join(" · ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
