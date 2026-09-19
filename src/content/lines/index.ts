// The line library and the deterministic pick. Every speech act every officer
// can perform has at least one authored line; a lint in the tests checks it.

import { scoped } from "../../engine/rng";
import type { Department, SpeechAct } from "../../engine/types";
import { CLARIFY_QUESTION } from "./clarify";
import { ENGINEERING_LINES } from "./engineering";
import { LOGISTICS_LINES } from "./logistics";
import { MEDICAL_LINES } from "./medical";
import { SECURITY_LINES } from "./security";
import type { Line } from "./types";

export { CLARIFY_QUESTION } from "./clarify";
export type { Line } from "./types";

export const SPEECH_ACTS: readonly SpeechAct[] = [
  "acknowledge",
  "clarify",
  "object",
  "warn",
  "confirm_priority",
  "report_success",
  "report_partial",
  "report_failure",
  "report_unexpected",
  "challenge_precedent",
  "request_exception",
  "routine",
];

const CLARIFY_LINES: Line[] = (["security", "logistics", "medical", "engineering"] as Department[]).flatMap((who) =>
  (Object.keys(CLARIFY_QUESTION[who]) as (keyof typeof CLARIFY_QUESTION.security)[]).map((reason) => ({
    id: `${who}.clarify.${reason}`,
    who,
    act: "clarify" as const,
    text: CLARIFY_QUESTION[who][reason],
  })),
);

export const ALL_LINES: readonly Line[] = [...SECURITY_LINES, ...LOGISTICS_LINES, ...MEDICAL_LINES, ...ENGINEERING_LINES, ...CLARIFY_LINES];

export const LINE_BY_ID: ReadonlyMap<string, Line> = new Map(ALL_LINES.map((l) => [l.id, l]));

export function linesFor(who: Department, act: SpeechAct): Line[] {
  return ALL_LINES.filter((l) => l.who === who && l.act === act);
}

/**
 * Picks a line deterministically from the seed and a label, avoiding the last
 * one used where possible. With `tags`, lines about the same thing are
 * preferred, and lines about something else are left out; untagged lines fit
 * anything.
 */
export function pickLine(seed: string, label: string, who: Department, act: SpeechAct, avoid?: string, tags?: readonly string[]): Line {
  const pool = linesFor(who, act);
  if (!pool.length) throw new Error(`no lines for ${who}/${act}`);
  const rng = scoped(seed, "line", label, who, act);
  let options = pool;
  if (tags && tags.length) {
    const matching = pool.filter((l) => l.tags?.some((t) => tags.includes(t)));
    const neutral = pool.filter((l) => !l.tags);
    options = matching.length ? matching : neutral.length ? neutral : pool;
  } else {
    const neutral = pool.filter((l) => !l.tags);
    options = neutral.length ? neutral : pool;
  }
  if (options.length > 1 && avoid) options = options.filter((l) => l.id !== avoid);
  return options[rng.int(options.length)];
}

if (new Set(ALL_LINES.map((l) => l.id)).size !== ALL_LINES.length) throw new Error("duplicate line id");
