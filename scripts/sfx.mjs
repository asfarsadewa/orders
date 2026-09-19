// Sound effects from ElevenLabs text-to-sound-effects, post-processed with
// ffmpeg and written to public/audio/sfx with a manifest. Run: npm run sfx
// (needs ELEVENLABS_API_KEY). Existing files are kept unless --force; --only <name>.

import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { duration, ffmpeg, normalize } from "./audio-util.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "audio", "sfx");
const rawDir = path.join(root, "scripts", "raw", "sfx");
const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

/** name, prompt, requested seconds, cap seconds after trim, prompt influence, target LUFS, playback gainDb */
const CUES = [
  ["send", "A single crisp mechanical teletype key strike followed by a short paper advance click. Close, dry, no music.", 1.0, 0.5, 0.7, -20, 0],
  ["ack", "A short two-tone radio acknowledgement beep, clean and quiet, like a handheld transceiver confirming receipt. No music, no voice.", 1.0, 0.6, 0.7, -22, 0],
  ["clarify", "A brief burst of soft radio static that resolves into one gentle rising query tone. Quiet, close, no music, no voice.", 1.5, 1.0, 0.7, -22, 0],
  ["warn", "A single low muted alert tone, one pulse, like a console warning in a dark control room. No music, no reverb, no voice.", 1.2, 0.8, 0.7, -21, 0],
  ["execute", "A heavy metal switch thrown with a solid mechanical clunk, then a low electrical hum settling for one second. Industrial, close, no music.", 2.0, 1.6, 0.6, -19, 0],
  ["alarm", "A colony alarm klaxon, two short low honks heard through concrete walls, muffled and distant. No music, no voice.", 2.0, 1.6, 0.6, -20, 0],
  ["loss", "A single low sustained electronic tone like a heart monitor going flat, fading away over two seconds. Sombre, no music.", 2.5, 2.2, 0.6, -20, 0],
  ["relief", "A soft warm chord on a small analogue synthesizer, held briefly and released. Quiet hope, no melody, no percussion.", 2.0, 1.8, 0.6, -21, 0],
  ["dawn", "Cold wind dying down at dawn on an open snowy plateau, one distant metallic creak, then near silence. Outdoor ambience, no music, no voice.", 3.5, 3.0, 0.6, -21, 0],
  ["click", "One very short soft click of a fingertip on a plastic console key. Tiny, dry, no music.", 0.5, 0.15, 0.8, -26, -4],
  ["ending-good", "A slow warm swell of a low synthesizer pad with a faint high shimmer, rising and settling over three seconds. Hopeful, no melody, no percussion, no voice.", 4.0, 3.5, 0.6, -19, 0],
  ["ending-bad", "A deep dark drone with cold wind, descending slowly and dying away over three seconds. Bleak, no melody, no percussion, no voice.", 4.0, 3.5, 0.6, -19, 0],
];

async function generate(text, seconds, influence, out) {
  const r = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, duration_seconds: seconds, prompt_influence: influence, loop: false }),
  });
  if (!r.ok) throw new Error(`elevenlabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
  await writeFile(out, Buffer.from(await r.arrayBuffer()));
}

async function main() {
  if (!process.env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not set");
  await mkdir(outDir, { recursive: true });
  await mkdir(rawDir, { recursive: true });
  const manifestPath = path.join(root, "public", "audio", "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, "utf8")) : { sfx: {}, music: {} };
  manifest.sfx ??= {};
  for (const [name, prompt, seconds, cap, influence, target, gainDb] of CUES) {
    if (ONLY && name !== ONLY) continue;
    const out = path.join(outDir, `${name}.mp3`);
    if (existsSync(out) && !FORCE) {
      // Kept, but re-registered: the manifest is shared with the music script.
      if (!manifest.sfx[name]) manifest.sfx[name] = { file: `/audio/sfx/${name}.mp3`, seconds: await duration(out), loop: false, gainDb, prompt };
      console.log(`keep ${name}`);
      continue;
    }
    const raw = path.join(rawDir, `${name}.raw.mp3`);
    if (!existsSync(raw) || FORCE) {
      console.log(`generate ${name}`);
      await generate(prompt, seconds, influence, raw);
    }
    // Trim silence at head and tail (relative to a pre-gain toward the target), cap, then normalise.
    const trimmed = path.join(rawDir, `${name}.trim.wav`);
    await ffmpeg(["-i", raw, "-af", `volume=6dB,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.01,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,volume=-6dB`, "-ac", "1", "-ar", "44100", trimmed]);
    let len = await duration(trimmed);
    const capped = path.join(rawDir, `${name}.cap.wav`);
    if (len > cap + 0.05) {
      const fade = Math.min(0.6, Math.max(0.03, cap * 0.2));
      await ffmpeg(["-i", trimmed, "-af", `atrim=0:${cap},afade=t=out:st=${(cap - fade).toFixed(3)}:d=${fade}`, capped]);
    } else await ffmpeg(["-i", trimmed, capped]);
    const { filters } = await normalize(capped, out, { I: target, TP: -1.5, LRA: 7 });
    await ffmpeg(["-i", capped, "-af", filters, "-c:a", "libmp3lame", "-b:a", "64k", "-ac", "1", "-ar", "44100", out]);
    len = await duration(out);
    manifest.sfx[name] = { file: `/audio/sfx/${name}.mp3`, seconds: len, loop: false, gainDb, prompt };
    await rm(trimmed, { force: true });
    await rm(capped, { force: true });
    console.log(`  ${name}: ${len}s`);
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 1));
  console.log("wrote manifest");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
