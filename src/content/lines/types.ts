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
}

export function lines(who: Department, act: SpeechAct, texts: readonly string[]): Line[] {
  return texts.map((text, i) => ({ id: `${who}.${act}.${i + 1}`, who, act, text }));
}

export type ClarifyQuestions = Record<ClarifyReason, string>;
