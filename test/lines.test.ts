import { describe, expect, it } from "vitest";
import { ALL_LINES, SPEECH_ACTS, linesFor, pickLine } from "../src/content/lines";
import { DEPARTMENTS } from "../src/engine/types";

describe("the line library", () => {
  it("covers every speech act for every officer", () => {
    for (const d of DEPARTMENTS) {
      for (const act of SPEECH_ACTS) {
        expect(linesFor(d, act).length, `${d}/${act}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps specifics out of the lines so they can be voiced once", () => {
    for (const l of ALL_LINES) {
      expect(l.text, l.id).not.toMatch(/\d/);
      expect(l.text, l.id).not.toMatch(/\{/);
      expect(l.text.length, l.id).toBeLessThan(140);
    }
  });

  it("picks deterministically and avoids the last line where it can", () => {
    const a = pickLine("seed", "O-1-1", "security", "acknowledge");
    const b = pickLine("seed", "O-1-1", "security", "acknowledge");
    expect(a.id).toBe(b.id);
    const c = pickLine("seed", "O-1-1", "security", "acknowledge", a.id);
    expect(c.id).not.toBe(a.id);
  });
});
