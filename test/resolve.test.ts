import { describe, expect, it } from "vitest";
import { ACTION_BY_ID } from "../src/content/actions";
import { applyOrder, endDay, newGame } from "../src/engine/game";
import { decideAll } from "../src/engine/resolve";
import type { Department, GameState } from "../src/engine/types";
import { CHEN_PUMPS_FIRST, CIVILIANS_FIRST, CONTRADICTION, DIG_OUT, EVACUATE_B, FIRE_FALLBACK, ILYA_LOOK, ILYA_WHATEVER, POWER_MEDICAL, SAVE_EVERYONE, SEAL_B, VAGUE_WATER, VALE_CRITICAL, vector } from "./fixtures";

/** A day-six-like colony: fire in the core, people trapped, pumps failing, movement outside. */
function crisisState(seed = "test"): GameState {
  const s = newGame(seed, "analyst");
  s.world.sectors.core.fire = 0.4;
  s.world.power.generatorHealth = 0.5;
  s.world.power.output = 0.45;
  s.world.people.trapped = 23;
  s.world.water.pumpHealth = 0.4;
  s.world.water.days = 2.3;
  s.world.security.threat = 0.45;
  s.world.crises = [
    { id: "generator_fire-1", template: "generator_fire", sector: "core", severity: 0.4, dayStarted: 1, neglect: 0 },
    { id: "roof_collapse-1", template: "roof_collapse", sector: "habitat", severity: 0.4, dayStarted: 1, neglect: 0 },
    { id: "pump_failure-1", template: "pump_failure", sector: "works", severity: 0.4, dayStarted: 1, neglect: 0 },
    { id: "unknown_contact-1", template: "unknown_contact", sector: "perimeter", severity: 0.4, dayStarted: 1, neglect: 0 },
  ];
  return s;
}

function chosen(state: GameState): Record<Department, { action: string; basis: string }> {
  const out = {} as Record<Department, { action: string; basis: string }>;
  for (const x of decideAll(state, state.world)) out[x.decision.department] = { action: x.decision.action, basis: x.decision.basis };
  return out;
}

describe("officer divergence", () => {
  it("one evacuation order, different actions per department, none for medical", () => {
    const s = applyOrder(crisisState(), "Get Sector B evacuated before dark.", EVACUATE_B);
    const c = chosen(s);
    expect(c.security.basis).toBe("order");
    expect(["sec_escort", "sec_rescue", "sec_split"]).toContain(c.security.action);
    expect(c.logistics.basis).toBe("order");
    expect(["log_trucks", "log_reserve_pumps", "log_shelter"]).toContain(c.logistics.action);
    // Medical was not addressed; Vale acts on her own initiative about the trapped, not on the order.
    expect(c.medical.basis).not.toBe("order");
  });

  it("the same order with a fuel-versus-trucks tension makes Chen cautious and Ilya fast", () => {
    const s = applyOrder(crisisState(), "Get Sector B evacuated before dark.", EVACUATE_B);
    const decided = decideAll(s, s.world);
    const chen = decided.find((x) => x.decision.department === "logistics")!.decision;
    const reserve = chen.candidates.find((c) => c.action === "log_reserve_pumps")!;
    const trucks = chen.candidates.find((c) => c.action === "log_trucks")!;
    // Both are live options for Chen; the preserve_reserve constraint is what lifts the reservation.
    expect(reserve.terms.some((t) => t.note.includes("preserve_reserve"))).toBe(true);
    expect(Math.abs(reserve.utility - trucks.utility)).toBeLessThan(3);
    const ilya = decided.find((x) => x.decision.department === "security")!.decision;
    const escort = ilya.candidates.find((c) => c.action === "sec_escort")!;
    expect(escort.terms.some((t) => t.name.startsWith("urgency"))).toBe(true);
  });

  it("Orlov reads permission to use the reserve through infrastructure caution but obeys an immediate order", () => {
    const s = applyOrder(crisisState(), "Restore power to medical immediately. Use emergency reserve if necessary.", POWER_MEDICAL);
    const c = chosen(s);
    expect(c.engineering.basis).toBe("order");
    expect(["eng_power_infirmary", "eng_bridge_reserve", "eng_repair_generator"]).toContain(c.engineering.action);
    // Security is not concerned and does its own thing.
    expect(c.security.basis).not.toBe("order");
  });

  it("'whatever it takes' with permission to use force sends Ilya out to engage", () => {
    const s = crisisState();
    s.world.security.contact = "raiders";
    s.world.security.threat = 0.6;
    const s2 = applyOrder(s, "Ilya, deal with whatever is out there. Whatever it takes.", ILYA_WHATEVER);
    const c = chosen(s2);
    expect(c.security.action).toBe("sec_engage");
    const ack = s2.todayUtterances.find((u) => u.department === "security")!;
    expect(ack.act).toBe("warn");
  });

  it("a bounded investigation order keeps Ilya to looking, not fighting", () => {
    const s = applyOrder(crisisState(), "Ilya, find out what is out there. Do not engage.", ILYA_LOOK);
    const c = chosen(s);
    expect(c.security.action).toBe("sec_investigate");
    const ilya = decideAll(s, s.world).find((x) => x.decision.department === "security")!.decision;
    const engage = ilya.candidates.find((c) => c.action === "sec_engage")!;
    expect(engage.terms.some((t) => t.note.includes("avoid_combat") && t.note.includes("violates"))).toBe(true);
  });

  it("a multi-department rescue order moves three officers on the same sentence", () => {
    const s = applyOrder(crisisState(), "Get the trapped people out of Habitat.", DIG_OUT);
    const c = chosen(s);
    expect(c.security.action).toBe("sec_rescue");
    expect(c.engineering.action).toBe("eng_shore_habitat");
    expect(["med_field_team", "med_treat_all"]).toContain(c.medical.action);
    expect(c.logistics.basis).not.toBe("order");
  });

  it("Vale conserves when told to, against her doctrine", () => {
    const s = applyOrder(crisisState(), "Vale, treat only the critical.", VALE_CRITICAL);
    expect(chosen(s).medical.action).toBe("med_conserve");
  });

  it("a fallback order to fight the fire is followed by engineering", () => {
    const s = applyOrder(crisisState(), "Fight the fire in the core.", FIRE_FALLBACK);
    expect(chosen(s).engineering.action).toBe("eng_fight_fire");
  });
});

describe("clarification", () => {
  it("a contradictory order makes the literal officer ask", () => {
    const s = applyOrder(crisisState(), "Evacuate the infirmary but do not move the patients.", CONTRADICTION);
    const vale = s.todayUtterances.find((u) => u.department === "medical")!;
    expect(vale.act).toBe("clarify");
    expect(s.pending).toHaveLength(1);
    expect(s.pending[0].reason).toBe("contradiction");
  });

  it("a vague order: Chen asks, Orlov and Ilya act on discretion", () => {
    const s = applyOrder(crisisState(), "Do something about the water.", VAGUE_WATER);
    const c = chosen(s);
    expect(c.logistics.basis).toBe("clarification");
    expect(c.engineering.basis).toBe("order");
    expect(["eng_repair_pumps", "eng_power_works"]).toContain(c.engineering.action);
  });

  it("an unanswered question holds the officer to routine at execution and costs trust", () => {
    const s = applyOrder(crisisState(), "Do something about the water.", VAGUE_WATER);
    const trustBefore = s.trust.logistics;
    const s2 = endDay(s);
    const chen = s2.reports[0].decisions.find((d) => d.department === "logistics")!;
    expect(chen.basis).toBe("clarification");
    expect(s2.trust.logistics).toBeLessThan(trustBefore);
    expect(s2.pending).toHaveLength(0);
  });

  it("an answer measured against the question lets the officer act on the original order", () => {
    const s = applyOrder(crisisState(), "Do something about the water.", VAGUE_WATER);
    expect(s.pending[0].department).toBe("logistics");
    const s2 = applyOrder(s, "Chen, priority is the pumps. Fuel them first.", CHEN_PUMPS_FIRST);
    expect(s2.pending[0].answeredBy).toBe("O-1-2");
    expect(s2.trust.logistics).toBeGreaterThan(s.trust.logistics);
    const c = chosen(s2);
    expect(c.logistics.basis).toBe("order");
    expect(c.logistics.action).toBe("log_reserve_pumps");
  });

  it("'save everyone' is not a clarification for Ilya but is for Chen", () => {
    const s = applyOrder(crisisState(), "Save everyone.", SAVE_EVERYONE);
    const c = chosen(s);
    expect(c.security.basis).toBe("order");
    expect(c.logistics.basis).toBe("clarification");
  });
});

describe("standing orders and precedent", () => {
  it("a doctrine statement becomes a standing order and a later conflicting order divides the officers", () => {
    let s = applyOrder(crisisState(), "Protect civilians above everything else.", CIVILIANS_FIRST);
    expect(s.standing).toHaveLength(1);
    expect(s.standing[0].scope).toEqual(["security", "logistics", "medical", "engineering"]);
    s = endDay(s);
    s = applyOrder(s, "Seal Sector B immediately. Do not divert personnel.", SEAL_B);
    const acks = Object.fromEntries(s.todayUtterances.map((u) => [u.department, u.act]));
    // Orlov weighs precedent heavily and says so; Ilya does not.
    expect(acks.engineering).toBe("challenge_precedent");
    expect(["acknowledge", "confirm_priority", "object", "warn"]).toContain(acks.security);
  });

  it("an override supersedes the standing order it names", () => {
    let s = applyOrder(crisisState(), "Protect civilians above everything else.", CIVILIANS_FIRST);
    s = endDay(s);
    const cancel = vector({ objective: "other", scope: ["security"], nouls: { revokes_standing_orders: 0.3 }, standing: [{ conflict: 0.2, override: 0.9 }], scores: { clarity: 2.8 } });
    s = applyOrder(s, "Cancel the civilians-first rule.", cancel);
    expect(s.standing[0].supersededBy).toBe("O-2-1");
    const ack = s.todayUtterances.find((u) => u.department === "security")!;
    expect(ack.notes.some((n) => n.includes("supersedes SO-1"))).toBe(true);
  });

  it("precedent memory learns and fades", () => {
    let s = applyOrder(crisisState(), "Protect civilians above everything else.", CIVILIANS_FIRST);
    expect(s.precedent.medical.priority_people).toBeGreaterThan(0.2);
    const learned = s.precedent.medical.priority_people;
    s = endDay(s);
    expect(s.precedent.medical.priority_people).toBeLessThan(learned);
    expect(s.precedent.medical.priority_people).toBeGreaterThan(0);
  });
});

describe("the library", () => {
  it("every chosen action exists and every department has a routine and a clarification", () => {
    for (const d of ["security", "logistics", "medical", "engineering"]) {
      expect(ACTION_BY_ID.has(`${d}_clarify`)).toBe(true);
    }
    expect(ACTION_BY_ID.has("sec_routine")).toBe(true);
    expect(ACTION_BY_ID.has("eng_routine")).toBe(true);
  });
});
