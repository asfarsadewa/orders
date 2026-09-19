// Pre-renders every authored line as speech with Gemini TTS and writes small
// MP3 clips plus a manifest into public/voice. Nothing is synthesised at
// runtime: the game only ever plays what this script produced.
//
//   npm run voice                 render every missing clip
//   npm run voice -- --only chen  render only one officer
//   npm run voice -- --force      re-render even when the file exists
//   npm run voice -- --dry-run    list the work without calling anything
//
// Clips are keyed by line id, so the client plays `/voice/${lineId}.mp3`.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { ALL_LINES, type Line } from "../src/content/lines";
import { OFFICERS } from "../src/content/officers";
import type { Department, SpeechAct } from "../src/engine/types";

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "voice");
const tmpDir = path.join(os.tmpdir(), "orders-voice");

const MODEL = "gemini-3.1-flash-tts-preview";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const SAMPLE_RATE = 24000;

const args = process.argv.slice(2);
const flag = (name: string): boolean => args.includes(`--${name}`);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const LIMIT = Number(opt("limit") ?? Infinity);
const ONLY = opt("only");
const FORCE = flag("force");
const DRY = flag("dry-run");
const CONCURRENCY = Number(opt("concurrency") ?? 6);

/** How each officer sounds: the character part of every prompt. */
const CHARACTER: Record<Department, string> = {
  security: "a security captain in his forties, low voice, clipped military delivery, confident and fast, faintly impatient, never theatrical",
  logistics: "a logistics chief in her thirties, precise even diction, dry and unhurried, every word placed like a ledger entry, polite but immovable",
  medical: "a colony doctor in her fifties, warm steady voice, direct, tired but kind, a thread of urgency underneath",
  engineering: "a chief engineer in his sixties, deep slow voice, dry humour, thinks in systems, never hurried and never raises his voice",
};

/** How each speech act is delivered. */
const DELIVERY: Record<SpeechAct, string> = {
  acknowledge: "crisply, as a brief confirmation over a radio",
  clarify: "as a genuine question, plainly, expecting an answer",
  object: "reluctantly but formally, complying under protest",
  warn: "seriously, voice lowered, as a warning that matters",
  confirm_priority: "with a small note of relief, as if a weight has come off",
  report_success: "with quiet satisfaction, matter of fact",
  report_partial: "tired, honest, without excuses",
  report_failure: "flat and heavy, owning it",
  report_unexpected: "with urgency, as news that must be heard now",
  challenge_precedent: "firmly, standing on principle",
  request_exception: "carefully, asking for something",
  routine: "offhand, an end-of-day remark",
};

function prompt(line: Line, alt = false): string {
  const who = CHARACTER[line.who];
  const how = DELIVERY[line.act];
  // The safety filter occasionally blocks the usual phrasing; the plainer form passes for the same voice.
  if (alt) return `Say ${how}: ${line.text}`;
  return `You are ${who}. Say only the following line, ${how}, with no preamble and nothing added: ${line.text}`;
}

async function synthesize(line: Line, apiKey: string): Promise<Buffer> {
  let lastError = "";
  let alt = false;
  const voice = OFFICERS[line.who].voice;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const body = {
      model: MODEL,
      input: prompt(line, alt),
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice }] },
    };
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    if (r.ok) {
      const json = (await r.json()) as { steps?: { content?: { type: string; data?: string; mime_type?: string; sample_rate?: number }[] }[] };
      const part = json.steps?.[0]?.content?.find((p) => p.type === "audio");
      if (!part?.data) throw new Error(`no audio in response for ${line.id}`);
      if (part.sample_rate && part.sample_rate !== SAMPLE_RATE) throw new Error(`unexpected sample rate ${part.sample_rate}`);
      return Buffer.from(part.data, "base64");
    }
    const text = await r.text().catch(() => "");
    lastError = `${r.status} ${text}`.slice(0, 300);
    const transient = r.status === 429 || r.status >= 500 || (r.status === 400 && /could not be completed/i.test(text));
    if (r.status === 400 && /blocked/i.test(text) && !alt) {
      alt = true;
      continue;
    }
    if (transient) {
      await new Promise((res) => setTimeout(res, 1500 * attempt * attempt));
      continue;
    }
    break;
  }
  throw new Error(`tts failed for ${line.id}: ${lastError}`);
}

/** Trims silence, normalises loudness and encodes a small mono MP3. */
async function encode(pcm: Buffer, out: string, key: string): Promise<void> {
  await mkdir(tmpDir, { recursive: true });
  const raw = path.join(tmpDir, `${key}.pcm`);
  await writeFile(raw, pcm);
  const filters = [
    "silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.08",
    "areverse",
    "silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.12",
    "areverse",
    "loudnorm=I=-18:TP=-1.5:LRA=9",
    "apad=pad_dur=0.06",
  ].join(",");
  await exec("ffmpeg", ["-loglevel", "error", "-y", "-f", "s16le", "-ar", String(SAMPLE_RATE), "-ac", "1", "-i", raw, "-af", filters, "-ar", "24000", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "32k", out]);
  await rm(raw, { force: true });
}

async function duration(file: string): Promise<number> {
  const { stdout } = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Math.round(Number(stdout.trim()) * 100) / 100;
}

interface ManifestEntry {
  seconds: number;
  bytes: number;
  hash?: string;
  suspect?: true;
}

interface Manifest {
  model: string;
  version: number;
  clips: Record<string, ManifestEntry>;
}

async function loadManifest(): Promise<Manifest> {
  const file = path.join(outDir, "manifest.json");
  if (!existsSync(file)) return { model: MODEL, version: 1, clips: {} };
  return JSON.parse(await readFile(file, "utf8")) as Manifest;
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && !DRY) throw new Error("GEMINI_API_KEY is not set");
  await mkdir(outDir, { recursive: true });
  const manifest = await loadManifest();
  const hashOf = (l: Line) => createHash("sha1").update(prompt(l)).digest("hex").slice(0, 12);
  const stale = (l: Line) => {
    const file = path.join(outDir, `${l.id}.mp3`);
    if (!existsSync(file)) return true;
    const entry = manifest.clips[l.id];
    return entry?.hash !== undefined && entry.hash !== hashOf(l);
  };
  const wanted = ALL_LINES.filter((l) => (!ONLY || l.who === ONLY || l.id.startsWith(ONLY)) && (FORCE || stale(l))).slice(0, LIMIT);
  console.log(`${ALL_LINES.length} lines in the library; ${wanted.length} to render`);
  if (DRY) {
    for (const l of wanted.slice(0, 20)) console.log(`  ${l.id}  [${OFFICERS[l.who].voice}, ${l.act}]  ${l.text}`);
    return;
  }
  let done = 0;
  let failed = 0;
  const started = Date.now();
  const queue = [...wanted];
  const worker = async (): Promise<void> => {
    for (;;) {
      const l = queue.shift();
      if (!l) return;
      const out = path.join(outDir, `${l.id}.mp3`);
      try {
        const pcm = await synthesize(l, apiKey!);
        await encode(pcm, out, l.id);
        const seconds = await duration(out);
        const bytes = (await stat(out)).size;
        const entry: ManifestEntry = { seconds, bytes, hash: hashOf(l) };
        const expected = Math.max(0.6, l.text.length / 13);
        if (seconds > expected * 2.2 + 0.8) entry.suspect = true;
        manifest.clips[l.id] = entry;
        done++;
        if (done % 20 === 0 || done === wanted.length) {
          const elapsed = (Date.now() - started) / 1000;
          console.log(`${done}/${wanted.length} rendered, ${failed} failed, ${Math.round(elapsed)}s`);
          await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 1));
        }
      } catch (e) {
        failed++;
        console.error(`FAILED ${l.id}: ${e instanceof Error ? e.message : String(e)}`);
        await rm(out, { force: true });
      }
    }
  };
  await Promise.all(new Array(Math.min(CONCURRENCY, queue.length)).fill(0).map(worker));
  for (const key of Object.keys(manifest.clips)) if (!existsSync(path.join(outDir, `${key}.mp3`))) delete manifest.clips[key];
  manifest.model = MODEL;
  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 1));
  const entries = Object.values(manifest.clips);
  const total = entries.reduce((s, e) => s + e.bytes, 0);
  const suspects = Object.entries(manifest.clips).filter(([, e]) => e.suspect).map(([k]) => k);
  console.log(`manifest: ${entries.length} clips, ${(total / 1e6).toFixed(1)} MB`);
  if (suspects.length) console.log(`suspect clips (too long for their text): ${suspects.join(", ")}`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
