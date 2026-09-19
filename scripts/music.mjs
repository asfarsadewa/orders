// Music from Lyria 3.5 via the Gemini interactions API, two candidates per
// track, the better one normalised and written to public/audio/music. Run:
// npm run music (needs GEMINI_API_KEY). --only <track>, --force.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { duration, ffmpeg, normalize } from "./audio-util.mjs";

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "audio", "music");
const rawDir = path.join(root, "scripts", "raw", "music");
const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const CANDIDATES = 2;
const MODEL = "lyria-3.5";
const TAIL = "Instrumental only, no vocals, no lyrics, no spoken words.";

const TRACKS = {
  title: `Main theme for a cold, serious command game about a failing frontier colony in the snow: slow and spacious, a low analogue synth drone, sparse piano notes in a minor key, a faint distant metallic pulse like a generator, restrained, one memorable slow melody stated twice, modest dynamics, ends quietly. ${TAIL}`,
  day: `Tense, quiet underscore for a command post during a long day: soft analogue synth pads, a slow steady ticking pulse, sparse low piano, cold and patient, sits under reading and typing without demanding attention, no big build, no drum fills, gentle enough to loop. ${TAIL}`,
  night: `Dark ambient nocturne for a colony at night on a snowy plateau: wind textures, a very low bowed drone, distant creaking metal, an occasional lonely held note on a cello or a synth, slow and cold, very sparse, no percussion, seamless mood. ${TAIL}`,
};

function findAudio(obj, found = []) {
  if (!obj || typeof obj !== "object") return found;
  if (Array.isArray(obj)) {
    for (const x of obj) findAudio(x, found);
    return found;
  }
  if (typeof obj.data === "string" && obj.data.length > 1000 && /audio/i.test(String(obj.mime_type ?? obj.mimeType ?? obj.type ?? ""))) found.push(obj);
  for (const v of Object.values(obj)) findAudio(v, found);
  return found;
}

async function generate(prompt, out) {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: prompt }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!r.ok) throw new Error(`lyria ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const json = await r.json();
  const parts = findAudio(json);
  if (!parts.length) throw new Error(`no audio in response: ${JSON.stringify(json).slice(0, 400)}`);
  const part = parts[parts.length - 1];
  const mime = String(part.mime_type ?? part.mimeType ?? "audio/mpeg");
  const ext = /wav/i.test(mime) ? "wav" : /ogg|opus/i.test(mime) ? "ogg" : "mp3";
  const file = `${out}.${ext}`;
  await writeFile(file, Buffer.from(part.data, "base64"));
  return file;
}

async function silence(file) {
  const { stderr } = await exec("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "silencedetect=n=-35dB:d=0.5", "-f", "null", "-"]).catch((e) => e);
  const gaps = [...String(stderr).matchAll(/silence_duration: ([\d.]+)/g)].map((m) => Number(m[1]));
  return gaps;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  await mkdir(outDir, { recursive: true });
  await mkdir(rawDir, { recursive: true });
  const manifestPath = path.join(root, "public", "audio", "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, "utf8")) : { sfx: {}, music: {} };
  manifest.music ??= {};
  for (const [name, prompt] of Object.entries(TRACKS)) {
    if (ONLY && name !== ONLY) continue;
    const out = path.join(outDir, `${name}.mp3`);
    if (existsSync(out) && !FORCE) {
      console.log(`keep ${name}`);
      continue;
    }
    const candidates = [];
    for (let i = 1; i <= CANDIDATES; i++) {
      const base = path.join(rawDir, `${name}-${i}`);
      let file = ["mp3", "wav", "ogg"].map((e) => `${base}.${e}`).find((f) => existsSync(f));
      if (!file || FORCE) {
        console.log(`generate ${name} candidate ${i}`);
        file = await generate(prompt, base);
      }
      const len = await duration(file);
      const gaps = await silence(file);
      // Gaps inside the music (not the tail) disqualify.
      const internal = gaps.slice(0, -1).filter((g) => g > 1.5);
      candidates.push({ file, len, ok: len >= 60 && len <= 240 && internal.length === 0, internal });
      console.log(`  ${name}-${i}: ${len}s, internal gaps ${internal.length}`);
    }
    const pick = candidates.filter((c) => c.ok).sort((a, b) => b.len - a.len)[0] ?? candidates.sort((a, b) => b.len - a.len)[0];
    // Trim the trailing silence, fade in and out, normalise to -19 LUFS.
    const trimmed = path.join(rawDir, `${name}.trim.wav`);
    await ffmpeg(["-i", pick.file, "-af", "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.25,areverse", trimmed]);
    const len = await duration(trimmed);
    const { filters } = await normalize(trimmed, out, { I: -19, TP: -1.5, LRA: 9, pad: 0, extra: [`afade=t=in:d=1.5`, `afade=t=out:st=${(len - 3).toFixed(2)}:d=3`] });
    await ffmpeg(["-i", trimmed, "-af", filters, "-c:a", "libmp3lame", "-b:a", "96k", "-ar", "44100", out]);
    manifest.music[name] = { file: `/audio/music/${name}.mp3`, seconds: await duration(out), prompt, source: path.basename(pick.file) };
    console.log(`  ${name}: chose ${path.basename(pick.file)}, ${manifest.music[name].seconds}s`);
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 1));
  console.log("wrote manifest");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
