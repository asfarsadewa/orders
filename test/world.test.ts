import { describe, expect, it } from "vitest";
import { initialWorld } from "../src/content/scenario";
import { rng } from "../src/engine/rng";
import { nightTick, recorder } from "../src/engine/world";
import type { World } from "../src/engine/types";

function night(w: World, tempC = -8, kind: World["weather"]["kind"] = "cold") {
  const rec = recorder("night");
  nightTick(w, rec, { weather: { kind, tempC }, contactTruth: "refugees", rng: rng("x") });
  return rec.effects;
}

describe("the night", () => {
  it("a healthy colony drinks and eats a day and pumps water back", () => {
    const w = initialWorld();
    const food = w.food.days;
    night(w);
    expect(w.food.days).toBeCloseTo(food - 1, 5);
    expect(w.water.days).toBeGreaterThan(3.5);
    expect(w.fuel.units).toBeLessThan(120);
    expect(w.people.dead).toBe(0);
  });

  it("no generator and a held battery leaves sectors unheated, and cold hurts people", () => {
    const w = initialWorld();
    w.power.generatorHealth = 0.1;
    w.power.reservePolicy = "hold";
    const effects = night(w, -15);
    expect(w.sectors.habitat.heated).toBe(false);
    expect(effects.some((e) => e.note.includes("Cold injuries in habitat"))).toBe(true);
    expect(w.people.injured).toBeGreaterThan(9);
    expect(w.power.reserve).toBeCloseTo(0.8, 5);
  });

  it("the battery bridges a deficit when engineering allows it", () => {
    const w = initialWorld();
    w.power.generatorHealth = 0.3;
    w.power.reservePolicy = "bridge";
    night(w, -15);
    expect(w.power.reserve).toBeLessThan(0.8);
    expect(w.sectors.infirmary.heated).toBe(true);
  });

  it("a priority sector is cut last", () => {
    const w = initialWorld();
    w.power.generatorHealth = 0.62;
    w.power.priority = "works";
    night(w, -15);
    expect(w.sectors.works.heated).toBe(true);
    expect(w.sectors.core.heated).toBe(false);
  });

  it("unheated works below the freeze line freezes the pipes, and frozen pipes halve the pumps", () => {
    const w = initialWorld();
    w.power.generatorHealth = 0.3;
    night(w, -14);
    expect(w.water.pipesFrozen).toBe(true);
    const w2 = initialWorld();
    w2.water.pipesFrozen = true;
    w2.water.days = 2;
    const w3 = initialWorld();
    w3.water.days = 2;
    night(w2);
    night(w3);
    expect(w2.water.days).toBeLessThan(w3.water.days);
  });

  it("fire eats the generator unless fought, and isolation protects it", () => {
    const a = initialWorld();
    a.sectors.core.fire = 0.5;
    night(a);
    expect(a.sectors.core.fire).toBeGreaterThan(0.5);
    expect(a.power.generatorHealth).toBeLessThan(0.78);
    const b = initialWorld();
    b.sectors.core.fire = 0.5;
    b.tonight.fireFought.core = 1;
    night(b);
    expect(b.sectors.core.fire).toBeLessThan(0.5);
    const c = initialWorld();
    c.sectors.core.fire = 0.5;
    c.power.isolated = 2;
    night(c);
    expect(c.power.generatorHealth).toBe(0.78);
  });

  it("fuel runs out: the generator starves and the pumps stop", () => {
    const w = initialWorld();
    w.fuel.units = 2;
    w.fuel.reservedForPumps = true;
    night(w);
    expect(w.fuel.units).toBe(0);
    // Two units is well under half a night for the generator at this load.
    expect(w.power.output).toBeLessThan(0.4);
    expect(w.water.pumpsFuelled).toBe(false);
  });

  it("patients die without medicine and mostly live with it", () => {
    const withMed = initialWorld();
    withMed.people.critical = 20;
    withMed.tonight.treatment = 1;
    const without = initialWorld();
    without.people.critical = 20;
    without.medicine.stock = 0;
    night(withMed);
    night(without);
    expect(without.people.dead).toBeGreaterThan(withMed.people.dead);
    expect(withMed.medicine.stock).toBeLessThan(0.55);
  });

  it("nothing appears from nowhere: people are conserved", () => {
    const w = initialWorld();
    w.people.critical = 10;
    w.people.trapped = 15;
    w.sectors.core.fire = 0.6;
    w.power.generatorHealth = 0.2;
    const before = w.people.total + w.people.dead + w.people.evacuated;
    night(w, -16);
    expect(w.people.total + w.people.dead + w.people.evacuated).toBe(before);
    expect(w.people.injured + w.people.critical + w.people.trapped).toBeLessThanOrEqual(w.people.total);
    const sectorSum = Object.values(w.sectors).reduce((s, x) => s + x.people, 0);
    expect(sectorSum).toBe(w.people.total);
  });

  it("an unguarded fence with raiders and high threat gets raided eventually", () => {
    let raided = false;
    for (let i = 0; i < 20 && !raided; i++) {
      const w = initialWorld();
      w.security.contact = "raiders";
      w.security.threat = 0.9;
      w.security.perimeter = 0.3;
      const rec = recorder("night");
      nightTick(w, rec, { weather: { kind: "cold", tempC: -8 }, contactTruth: "raiders", rng: rng(`raid-${i}`) });
      raided = rec.effects.some((e) => e.note.startsWith("Raid:"));
    }
    expect(raided).toBe(true);
  });
});
