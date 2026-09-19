// Authored dialogue. A line is a fixed sentence in one officer's voice, keyed
// by speech act. Specifics (numbers, sectors, resources) are never in the
// line; the engine renders them as notes under it. That is what lets every
// line be voice-acted once.

import type { ClarifyReason, Department, SpeechAct } from "../../engine/types";

export interface Line {
  id: string;
  who: Department;
  act: SpeechAct;
  text: string;
  /** What the line is about; a line with tags is preferred when the action shares one, and avoided when it shares none. */
  tags?: string[];
}

export function lines(who: Department, act: SpeechAct, texts: readonly (string | [string, string[]])[]): Line[] {
  return texts.map((t, i) => {
    const [text, tags] = typeof t === "string" ? [t, undefined] : t;
    return { id: `${who}.${act}.${i + 1}`, who, act, text, ...(tags ? { tags } : {}) };
  });
}

export type ClarifyQuestions = Record<ClarifyReason, string>;
