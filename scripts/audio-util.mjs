// Shared ffmpeg helpers for the asset scripts: two-pass loudness
// normalisation, trimming, measurement.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function ffmpeg(args) {
  await exec("ffmpeg", ["-loglevel", "error", "-y", ...args]);
}

export async function duration(file) {
  const { stdout } = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Math.round(Number(stdout.trim()) * 100) / 100;
}

/** Measures integrated loudness, true peak and LRA with the ebur128 loudnorm pass. */
export async function measure(file, pad = 0) {
  const filter = `${pad > 0 ? `apad=whole_dur=${pad},` : ""}loudnorm=I=-18:TP=-1.5:LRA=7:print_format=json`;
  const { stderr } = await exec("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", filter, "-f", "null", "-"]).catch((e) => e);
  const m = /\{[\s\S]*\}/.exec(stderr ?? "");
  if (!m) throw new Error(`loudnorm measurement failed for ${file}`);
  const j = JSON.parse(m[0]);
  return { I: Number(j.input_i), TP: Number(j.input_tp), LRA: Number(j.input_lra), thresh: Number(j.input_thresh), offset: Number(j.target_offset) };
}

/**
 * Two-pass loudnorm to a target. For short transients where linear gain would
 * push the true peak over the ceiling, falls back to a plain gain that lands the
 * peak on the ceiling, which is the loudest the file can honestly be.
 */
export async function normalize(input, output, { I = -18, TP = -1.5, LRA = 7, pad = 3.5, extra = [] } = {}) {
  const m = await measure(input, pad);
  const gainNeeded = I - m.I;
  const peakAfter = m.TP + gainNeeded;
  const filters = [...extra];
  if (peakAfter > TP) {
    filters.push(`volume=${(TP - m.TP).toFixed(2)}dB`);
  } else {
    filters.push(`loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:measured_I=${m.I}:measured_TP=${m.TP}:measured_LRA=${m.LRA}:measured_thresh=${m.thresh}:offset=${m.offset}:linear=true`);
  }
  return { filters: filters.join(","), measured: m };
}
