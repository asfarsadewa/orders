// Measurements arrive from the judge or from a recording. A recording made
// before a question was added lacks that measure; this reads the gap as the
// neutral answer instead of failing the replay (D37). Nothing here invents a
// model result: a missing Choice is "none" at confidence 0, a missing Noul is
// 0, a missing Score is 0.

import { NOUL_IDS, SCORE_IDS, type ChoiceMeasure, type Measurements, type NoulId, type ScoreId, type ScoreMeasure } from "./types";

function neutralChoice<T extends string>(fallback: T): ChoiceMeasure<T> {
  return { choice: fallback, confidence: 0, probabilities: { [fallback]: 1 } };
}

const neutralScore = (): ScoreMeasure => ({ score: 0, confidence: 0, probabilities: { "0": 1 } });

/** A complete measurement with every missing part filled by its neutral value. The input is not changed. */
export function normalizeMeasurements(m: Partial<Measurements>): Measurements {
  const nouls = {} as Record<NoulId, number>;
  for (const id of NOUL_IDS) nouls[id] = typeof m.nouls?.[id] === "number" ? m.nouls[id] : 0;
  const scores = {} as Record<ScoreId, ScoreMeasure>;
  for (const id of SCORE_IDS) scores[id] = m.scores?.[id] ?? neutralScore();
  return {
    objective: m.objective ?? neutralChoice("other"),
    sector: m.sector ?? neutralChoice("none"),
    timeframe: m.timeframe ?? neutralChoice("unstated"),
    target: m.target ?? neutralChoice("none"),
    owner: m.owner ?? neutralChoice("none"),
    nouls,
    scores,
    standing: Array.isArray(m.standing) ? m.standing : [],
    answers: Array.isArray(m.answers) ? m.answers : [],
  };
}
