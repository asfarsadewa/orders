// Measures the calibration corpus with the same question set the game uses and
// grades the answers against the engine's thresholds.
//
//   npm run calibrate                     the whole corpus
//   npm run calibrate -- --only river     one entry (prefix match on id)
//   npm run calibrate -- --repeat 3       every entry three times, for stability
//   npm run calibrate -- --limit 10
//
// Writes docs/CALIBRATION.md (the report) and node_modules/.cache/calibration.json
// (the raw answers). Fix the questions or the labels, not the thresholds, unless
// the report shows a threshold is what is wrong.

import { TypeSafeClient } from "@typesafe-ai/sdk";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NOUL_IDS, SCORE_IDS, type Measurements } from "../src/engine/types";
import { THRESHOLDS, noulThreshold } from "../src/engine/thresholds";
import { MODEL, buildQuestions, questionCount, toMeasurements, type JudgeState } from "../src/judge/questions";
import { CORPUS, SITUATION, type CorpusEntry } from "./corpus";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const ONLY = opt("only");
const LIMIT = Number(opt("limit") ?? Infinity);
const REPEAT = Number(opt("repeat") ?? 1);
const CONCURRENCY = Number(opt("concurrency") ?? 6);

interface Check {
  question: string;
  want: string;
  got: string;
  pass: boolean;
}

interface Row {
  entry: CorpusEntry;
  run: number;
  ms: number;
  tokens: number;
  m: Measurements;
  checks: Check[];
}

const f2 = (x: number) => x.toFixed(2);

function grade(entry: CorpusEntry, m: Measurements): Check[] {
  const out: Check[] = [];
  const e = entry.expect;
  const oneOf = <T extends string>(want: T | T[] | undefined, got: T, p: Record<string, number>, q: string) => {
    if (want === undefined) return;
    const list = Array.isArray(want) ? want : [want];
    const pWant = Math.max(...list.map((w) => p[w] ?? 0));
    out.push({ question: q, want: list.join("|"), got: `${got} (p ${f2(pWant)} for wanted)`, pass: list.includes(got) });
  };
  oneOf(e.objective, m.objective.choice, m.objective.probabilities, "objective");
  oneOf(e.owner, m.owner.choice, m.owner.probabilities, "owner");
  oneOf(e.sector, m.sector.choice, m.sector.probabilities, "sector");
  oneOf(e.timeframe, m.timeframe.choice, m.timeframe.probabilities, "timeframe");
  for (const id of e.high ?? []) {
    const t = noulThreshold(id);
    out.push({ question: id, want: `≥ ${f2(t)}`, got: f2(m.nouls[id]), pass: m.nouls[id] >= t });
  }
  for (const id of e.low ?? []) {
    const t = noulThreshold(id);
    out.push({ question: id, want: `< ${f2(t)}`, got: f2(m.nouls[id]), pass: m.nouls[id] < t });
  }
  for (const [id, range] of Object.entries(e.scores ?? {})) {
    const [lo, hi] = range as [number, number];
    const s = m.scores[id as (typeof SCORE_IDS)[number]].score;
    out.push({ question: id, want: `${lo}..${hi}`, got: f2(s), pass: s >= lo && s <= hi });
  }
  for (const [idx, flags] of Object.entries(e.so ?? {})) {
    const i = Number(idx);
    const so = m.standing[i];
    if (!so) {
      out.push({ question: `so_${i}`, want: "measured", got: "missing", pass: false });
      continue;
    }
    if (flags.conflict) {
      const t = THRESHOLDS.standingConflict;
      const pass = flags.conflict === "high" ? so.conflict >= t : so.conflict < t;
      out.push({ question: `so_${i}_conflict`, want: `${flags.conflict === "high" ? "≥" : "<"} ${f2(t)}`, got: f2(so.conflict), pass });
    }
    if (flags.override) {
      const t = THRESHOLDS.standingOverride;
      const pass = flags.override === "high" ? so.override >= t : so.override < t;
      out.push({ question: `so_${i}_override`, want: `${flags.override === "high" ? "≥" : "<"} ${f2(t)}`, got: f2(so.override), pass });
    }
  }
  for (const [idx, want] of Object.entries(e.answers ?? {})) {
    const j = Number(idx);
    const p = m.answers[j] ?? 0;
    const t = THRESHOLDS.answers;
    out.push({ question: `answers_${j}`, want: `${want === "high" ? "≥" : "<"} ${f2(t)}`, got: f2(p), pass: want === "high" ? p >= t : p < t });
  }
  return out;
}

async function main(): Promise<void> {
  if (!process.env.TYPESAFE_API_KEY) throw new Error("TYPESAFE_API_KEY is not set");
  const client = new TypeSafeClient({ timeout: 30_000, retry: { maxRetries: 2 }, logLevel: "warn" });
  const entries = CORPUS.filter((e) => !ONLY || e.id.startsWith(ONLY)).slice(0, LIMIT);
  const jobs: { entry: CorpusEntry; run: number }[] = [];
  for (let r = 0; r < REPEAT; r++) for (const entry of entries) jobs.push({ entry, run: r });
  const sample: JudgeState = { ...SITUATION, order: "x" };
  console.log(`measuring ${entries.length} orders × ${REPEAT} with ${MODEL}; ${questionCount(sample)} questions each`);

  const rows: Row[] = [];
  let done = 0;
  const queue = [...jobs];
  const worker = async () => {
    for (;;) {
      const job = queue.shift();
      if (!job) return;
      const state: JudgeState = { ...SITUATION, order: job.entry.text };
      const t0 = performance.now();
      const result = await client.systemOne({ state: state as unknown as Record<string, never>, questions: buildQuestions(state), model: MODEL });
      const ms = performance.now() - t0;
      const m = toMeasurements(result.answers, state);
      rows.push({ entry: job.entry, run: job.run, ms, tokens: result.usage.input_tokens + result.usage.output_tokens, m, checks: grade(job.entry, m) });
      done++;
      if (done % 10 === 0 || done === jobs.length) console.log(`${done}/${jobs.length}`);
    }
  };
  await Promise.all(new Array(Math.min(CONCURRENCY, queue.length)).fill(0).map(worker));
  rows.sort((a, b) => a.run - b.run || CORPUS.indexOf(a.entry) - CORPUS.indexOf(b.entry));

  // Aggregates.
  const first = rows.filter((r) => r.run === 0);
  const allChecks = first.flatMap((r) => r.checks);
  const passed = allChecks.filter((c) => c.pass).length;
  const byQuestion = new Map<string, { n: number; fail: number }>();
  for (const c of allChecks) {
    const q = byQuestion.get(c.question) ?? { n: 0, fail: 0 };
    q.n++;
    if (!c.pass) q.fail++;
    byQuestion.set(c.question, q);
  }
  const lat = rows.map((r) => r.ms).sort((a, b) => a - b);
  const p = (q: number) => lat[Math.min(lat.length - 1, Math.floor(q * lat.length))];
  const tokens = rows.reduce((s, r) => s + r.tokens, 0) / rows.length;

  // Separation: mean probability among entries labelled high vs low, per Noul.
  const sep: { id: string; hi: number[]; lo: number[] }[] = [];
  for (const id of NOUL_IDS) {
    const hi = first.filter((r) => r.entry.expect.high?.includes(id)).map((r) => r.m.nouls[id]);
    const lo = first.filter((r) => r.entry.expect.low?.includes(id)).map((r) => r.m.nouls[id]);
    if (hi.length && lo.length) sep.push({ id, hi, lo });
  }
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

  // Stability across repeats: largest change of any Noul or Score per entry.
  let stability = "";
  if (REPEAT > 1) {
    const drift: { id: string; maxNoul: number; maxScore: number; flips: number }[] = [];
    for (const entry of entries) {
      const runs = rows.filter((r) => r.entry === entry);
      let maxNoul = 0;
      let maxScore = 0;
      let flips = 0;
      for (const id of NOUL_IDS) {
        const vals = runs.map((r) => r.m.nouls[id]);
        maxNoul = Math.max(maxNoul, Math.max(...vals) - Math.min(...vals));
        const t = noulThreshold(id);
        if (vals.some((v) => v >= t) && vals.some((v) => v < t)) flips++;
      }
      for (const id of SCORE_IDS) {
        const vals = runs.map((r) => r.m.scores[id].score);
        maxScore = Math.max(maxScore, Math.max(...vals) - Math.min(...vals));
      }
      drift.push({ id: entry.id, maxNoul, maxScore, flips });
    }
    stability = `\n## Repeat stability (${REPEAT} runs)\n\n| order | max Noul drift | max Score drift | threshold flips |\n|---|---|---|---|\n${drift
      .map((d) => `| ${d.id} | ${f2(d.maxNoul)} | ${f2(d.maxScore)} | ${d.flips} |`)
      .join("\n")}\n`;
  }

  const lines: string[] = [];
  lines.push(`# Calibration`);
  lines.push("");
  lines.push(`Generated ${new Date().toISOString().slice(0, 10)} by \`npm run calibrate\` with ${MODEL}. ${entries.length} authored orders at the day-six situation in \`scripts/corpus.ts\`, ${questionCount(sample)} questions each, graded against the thresholds in \`src/engine/thresholds.ts\`.`);
  lines.push("");
  lines.push(`- Checks passed: **${passed} / ${allChecks.length}** (${((100 * passed) / allChecks.length).toFixed(1)}%)`);
  lines.push(`- Latency: median ${Math.round(p(0.5))} ms, p90 ${Math.round(p(0.9))} ms, max ${Math.round(lat[lat.length - 1])} ms`);
  lines.push(`- Tokens per request: ${Math.round(tokens)} (about $${((tokens * 42) / 1e9).toFixed(5)} each)`);
  lines.push("");
  lines.push(`## Failures`);
  lines.push("");
  const failing = first.filter((r) => r.checks.some((c) => !c.pass));
  if (!failing.length) lines.push("None.");
  for (const r of failing) {
    lines.push(`### ${r.entry.id} (${r.entry.kind})`);
    lines.push("");
    lines.push(`> ${r.entry.text}`);
    lines.push("");
    lines.push(`| question | want | got |\n|---|---|---|`);
    for (const c of r.checks.filter((c) => !c.pass)) lines.push(`| ${c.question} | ${c.want} | ${c.got} |`);
    lines.push("");
  }
  lines.push(`## Checks by question`);
  lines.push("");
  lines.push(`| question | checks | failed |\n|---|---|---|`);
  for (const [q, v] of [...byQuestion.entries()].sort((a, b) => b[1].fail - a[1].fail || a[0].localeCompare(b[0]))) lines.push(`| ${q} | ${v.n} | ${v.fail} |`);
  lines.push("");
  lines.push(`## Separation`);
  lines.push("");
  lines.push(`Mean probability among orders labelled high against orders labelled low, and the gate between them.`);
  lines.push("");
  lines.push(`| noul | labelled high (n) | labelled low (n) | gate | min high | max low |\n|---|---|---|---|---|---|`);
  for (const s of sep) {
    lines.push(`| ${s.id} | ${f2(mean(s.hi))} (${s.hi.length}) | ${f2(mean(s.lo))} (${s.lo.length}) | ${f2(noulThreshold(s.id))} | ${f2(Math.min(...s.hi))} | ${f2(Math.max(...s.lo))} |`);
  }
  lines.push("");
  lines.push(`## Every order`);
  lines.push("");
  for (const r of first) {
    const m = r.m;
    const hot = NOUL_IDS.filter((id) => m.nouls[id] >= noulThreshold(id)).map((id) => `${id} ${f2(m.nouls[id])}`);
    lines.push(`### ${r.entry.id}`);
    lines.push("");
    lines.push(`> ${r.entry.text}`);
    lines.push("");
    lines.push(`objective ${m.objective.choice} ${f2(m.objective.probabilities[m.objective.choice] ?? 0)} · owner ${m.owner.choice} ${f2(m.owner.probabilities[m.owner.choice] ?? 0)} · sector ${m.sector.choice} ${f2(m.sector.probabilities[m.sector.choice] ?? 0)} · timeframe ${m.timeframe.choice} ${f2(m.timeframe.probabilities[m.timeframe.choice] ?? 0)}`);
    lines.push("");
    lines.push(SCORE_IDS.map((id) => `${id} ${f2(m.scores[id].score)}`).join(" · "));
    lines.push("");
    lines.push(`crossed: ${hot.join(", ") || "nothing"}`);
    if (m.standing.length) lines.push(`\nstanding: ${m.standing.map((s, i) => `SO-${i + 1} conflict ${f2(s.conflict)} override ${f2(s.override)}`).join(" · ")}`);
    if (m.answers.length) lines.push(`\nanswers: ${m.answers.map((a, j) => `Q-${j + 1} ${f2(a)}`).join(" · ")}`);
    lines.push(`\n${Math.round(r.ms)} ms, ${r.tokens} tokens`);
    lines.push("");
  }
  lines.push(stability);

  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, "docs", "CALIBRATION.md"), lines.join("\n"));
  const cache = path.join(root, "node_modules", ".cache");
  await mkdir(cache, { recursive: true });
  await writeFile(path.join(cache, "calibration.json"), JSON.stringify(rows.map((r) => ({ id: r.entry.id, run: r.run, ms: r.ms, tokens: r.tokens, m: r.m })), null, 1));
  console.log(`\n${passed}/${allChecks.length} checks passed; median ${Math.round(p(0.5))} ms; ${Math.round(tokens)} tokens per request`);
  for (const r of failing) {
    console.log(`  ${r.entry.id}: ${r.checks.filter((c) => !c.pass).map((c) => `${c.question} ${c.got} (want ${c.want})`).join("; ")}`);
  }
  console.log(`wrote docs/CALIBRATION.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
