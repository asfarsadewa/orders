// Command legitimacy. Trust is a number per officer that moves on what the
// commander does, by rules, and changes how willing an officer is to use
// discretion, to ask instead of act, and to lean on precedent. It never makes
// an officer disobey at random.

import type { Department } from "./types";

export const TRUST_START = 0.6;
export const TRUST_FLOOR = 0.05;

export const TRUST_DELTA = {
  /** An order addressed to the officer that contradicts itself. */
  contradictory: -0.05,
  /** An order that silently reverses a recent one. */
  reversal: -0.03,
  /** The commander answered the officer's question. */
  answered: 0.04,
  /** A day passed with the officer's question unanswered. */
  ignored: -0.05,
  /** One of the officer's crew was hurt or killed carrying out an order. */
  crewCasualty: -0.06,
  /** An ordered action was carried out in full. */
  success: 0.02,
  /** An ordered action was mostly denied resources. */
  starved: -0.02,
  /** Colonists died overnight, felt by everyone. */
  deathsPerHead: -0.006,
  /** A clear order (clarity at or above the gate). */
  clear: 0.01,
} as const;

export function clampTrust(t: number): number {
  return Math.round(Math.max(TRUST_FLOOR, Math.min(1, t)) * 1000) / 1000;
}

/** Effective doctrine terms given trust. */
export function trustFactors(trust: number): { initiative: number; obedience: number; clarify: number; precedent: number } {
  return {
    /** Low trust makes officers less willing to read intent; they do what is written. */
    initiative: 0.7 + 0.6 * trust,
    /** Low trust makes the current order weigh a little less. */
    obedience: 0.8 + 0.4 * trust,
    /** Low trust makes officers ask more. */
    clarify: 1.3 - 0.6 * trust,
    /** Low trust makes officers lean harder on what they were told before. */
    precedent: 1.2 - 0.4 * trust,
  };
}

export function initialTrust(): Record<Department, number> {
  return { security: TRUST_START, logistics: TRUST_START, medical: TRUST_START, engineering: TRUST_START };
}

/** A word for the officer card. */
export function trustWord(t: number): string {
  if (t >= 0.8) return "confident";
  if (t >= 0.6) return "steady";
  if (t >= 0.4) return "wary";
  if (t >= 0.25) return "strained";
  return "mutinous";
}
