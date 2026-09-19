import type { DayReport } from "../engine/types";
import { HIDE_NIGHT as HIDE, nightLines } from "./Log";

export { f2, human, pct } from "./format";

export function nightLinesFor(r: DayReport): { note: string; tone: string }[] {
  return nightLines(r.night).filter((l) => !HIDE.test(l.note));
}
