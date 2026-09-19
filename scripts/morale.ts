// Where does morale go? Sums every recorded morale effect by its note across
// seeded runs of one scripted commander. Run: npx tsx scripts/morale.ts careful 60
import { RUN_DAYS } from "../src/content/scenario";
import { applyOrder, endDay, newGame } from "../src/engine/game";
import { COMMANDERS } from "./sim";

const who = process.argv[2] ?? "careful";
const n = Number(process.argv[3] ?? 60);
const drains = new Map<string, { sum: number; count: number }>();
let runs = 0;
let mutinies = 0;
let deaths = 0;
const deathNotes = new Map<string, number>();
for (let i = 0; i < n; i++) {
  let s = newGame(`seed-${i}`, "analyst");
  while (!s.ending && s.day <= RUN_DAYS) {
    for (const o of COMMANDERS[who](s)) s = applyOrder(s, o.text, o.m);
    s = endDay(s);
  }
  runs++;
  if (s.ending?.id === "mutiny") mutinies++;
  deaths += s.world.people.dead;
  for (const r of s.reports) {
    const effects = [...r.night, ...r.decisions.flatMap((d) => d.effects)];
    for (const e of effects) {
      if (e.path === "morale") {
        const key = e.note.replace(/\d+/g, "#").slice(0, 70);
        const d = (e.to as number) - (e.from as number);
        const cur = drains.get(key) ?? { sum: 0, count: 0 };
        cur.sum += d;
        cur.count++;
        drains.set(key, cur);
      }
      if (e.path === "people.dead") {
        const key = e.note.replace(/\d+/g, "#").slice(0, 70);
        deathNotes.set(key, (deathNotes.get(key) ?? 0) + ((e.to as number) - (e.from as number)));
      }
    }
  }
}
console.log(`${who}: ${runs} runs, ${mutinies} mutinies, ${(deaths / runs).toFixed(1)} dead per run`);
console.log("\nmorale per run by cause:");
for (const [k, v] of [...drains.entries()].sort((a, b) => a[1].sum - b[1].sum)) console.log(`  ${(v.sum / runs).toFixed(3).padStart(7)}  ×${(v.count / runs).toFixed(1).padStart(5)}  ${k}`);
console.log("\ndeaths per run by cause:");
for (const [k, v] of [...deathNotes.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${(v / runs).toFixed(2).padStart(6)}  ${k}`);
