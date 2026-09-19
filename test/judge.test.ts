import { describe, expect, it } from "vitest";
import { newGame, applyOrder, endDay } from "../src/engine/game";
import { NOUL_IDS, SCORE_IDS } from "../src/engine/types";
import { FIXED_QUESTION_COUNT, buildQuestions, emptyMeasurements, questionCount, toMeasurements } from "../src/judge/questions";
import { buildJudgeState } from "../src/judge/state";
import { CIVILIANS_FIRST, VAGUE_WATER } from "./fixtures";

describe("the question set", () => {
  it("asks every fixed question plus two per standing order and one per pending question", () => {
    let s = applyOrder(newGame("q"), "Protect civilians above everything else.", CIVILIANS_FIRST);
    s = endDay(s);
    s = applyOrder(s, "Do something about the water.", VAGUE_WATER);
    const state = buildJudgeState(s, "Chen, the pumps first.");
    expect(state.standing_orders).toHaveLength(1);
    expect(state.pending_clarifications).toHaveLength(1);
    const q = buildQuestions(state);
    expect(Object.keys(q)).toHaveLength(FIXED_QUESTION_COUNT + 2 + 1);
    expect(q.owner?.type).toBe("choice");
    expect(questionCount(state)).toBe(Object.keys(q).length);
    expect(q.so_0_conflict).toBeDefined();
    expect(q.answers_0).toBeDefined();
    for (const id of NOUL_IDS) expect(q[id]?.type).toBe("noul");
    for (const id of SCORE_IDS) expect(q[id]?.type).toBe("score");
  });

  it("keeps the state compact and names the situation", () => {
    const s = newGame("compact");
    const state = buildJudgeState(s, "Hold the gate.");
    expect(JSON.stringify(state).length).toBeLessThan(6000);
    expect(state.situation.some((l) => l.startsWith("Weather"))).toBe(true);
    expect(state.resources.fuel).toContain("units");
  });

  it("maps answers back and reads missing answers as zero", () => {
    const s = newGame("map");
    const state = buildJudgeState(s, "x");
    const m = toMeasurements(
      {
        objective: { type: "choice", choice: "evacuate", confidence: 0.9, probabilities: { evacuate: 0.9, other: 0.1 } },
        urgency: { type: "score", score: 2.5, confidence: 0.7, legend: { "0": "", "1": "", "2": "", "3": "" }, probabilities: { "2": 0.5, "3": 0.5 } },
        priority_people: { type: "noul", noul: 0.88 },
      },
      state,
    );
    expect(m.objective.choice).toBe("evacuate");
    expect(m.scores.urgency.score).toBe(2.5);
    expect(m.nouls.priority_people).toBe(0.88);
    expect(m.nouls.priority_fuel).toBe(0);
    expect(m.sector.choice).toBe("none");
    expect(m.standing).toEqual([]);
    const e = emptyMeasurements();
    expect(e.objective.choice).toBe("other");
  });
});
