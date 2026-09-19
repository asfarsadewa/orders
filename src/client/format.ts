// Small formatting helpers shared by the panels.

import { SECTOR_LETTER, SECTOR_NAME } from "../content/scenario";
import type { Department, SectorId, SpeechAct } from "../engine/types";

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const days = (x: number) => `${x.toFixed(1)}d`;
export const f2 = (x: number) => (Math.round(x * 100) / 100).toFixed(2);
export const f1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);

export function sectorLabel(s: SectorId): string {
  return s === "perimeter" ? SECTOR_NAME[s] : `${SECTOR_LETTER[s]} ${SECTOR_NAME[s]}`;
}

export const ACT_LABEL: Record<SpeechAct, string> = {
  acknowledge: "acknowledged",
  clarify: "asks",
  object: "objects",
  warn: "warns",
  confirm_priority: "priority noted",
  report_success: "done",
  report_partial: "partly done",
  report_failure: "failed",
  report_unexpected: "unexpected",
  challenge_precedent: "challenges",
  request_exception: "asks leave",
  routine: "routine",
};

export const DEPT_SHORT: Record<Department, string> = {
  security: "SEC",
  logistics: "LOG",
  medical: "MED",
  engineering: "ENG",
};

/** Cleans a measurement id for display. */
export const human = (id: string) => id.replace(/^(priority|concerns|permission_to)_/, (m) => m.replace(/_$/, " ")).replace(/_/g, " ");
