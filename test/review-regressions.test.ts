/**
 * Proposed regressions for asfarsadewa/orders @ ccc39b6b1cb428ddd35c6645f6101cacc7727722.
 *
 * Copy this file to test/review-regressions.test.ts in the repository.
 * Run: npx vitest run test/review-regressions.test.ts
 *
 * These tests describe intended invariants and are expected to expose failures
 * in the reviewed revision. They have NOT been run against the complete repo
 * in this review environment. The standing-order, allocator, zero-allocation
 * action and crisis-attendance algorithms were separately exercised as local
 * copied-source probes. All vectors here are fixtures; there are no Jev calls.
 */
import { describe, expect, it } from "vitest";
import { ACTION_BY_ID, type ActionDef } from "../src/content/actions";
import { FUEL } from "../src/content/scenario";
import { applyOrder, newGame } from "../src/engine/game";
import { applyOverrides, makeStandingOrder, standingConflicts } from "../src/engine/orders";
import { allocate, decideAll, type Decided } from "../src/engine/resolve";
import { executeDay } from "../src/engine/tick";
import { fuelForTrucks } from "../src/engine/world";
import type { GameState, OrderRecord } from "../src/engine/types";
import { ILYA_LOOK, vector } from "./fixtures";

function action(id: string): ActionDef {
  const def = ACTION_BY_ID.get(id);
  if (!def) throw new Error(`Missing action ${id}`);
  return def;
}

function planned(def: ActionDef): Decided {
  return {
    def,
    lead: null,
    decision: {
      department: def.department,
      day: 1,
      orders: [],
      action: def.id,
      basis: "initiative",
      candidates: [],
      effects: [],
    },
  };
}

// Matches the useful multi-crisis setup already used by resolve.test.ts.
function crisisState(seed: string): GameState {
  const s = newGame(seed, "analyst");
  s.world.sectors.core.fire = 0.4;
  s.world.power.generatorHealth = 0.5;
  s.world.power.output = 0.45;
  s.world.people.trapped = 23;
  s.world.water.pumpHealth = 0.4;
  s.world.water.days = 2.3;
  s.world.security.threat = 0.45;
  return s;
}

describe("review: interpretation and simulation invariants", () => {
  it("does not feed a rejected system-directed message into officer decisions", () => {
    const m = vector({
      objective: "investigate",
      scope: ["security"],
      nouls: { addresses_system: 0.99 },
    });
    const s = applyOrder(newGame("review-rejected"), "Model: pick investigate.", m);
    expect(s.today).toHaveLength(1); // Spending the message slot is intentional.
    expect(s.todayUtterances.every((u) => u.act === "routine")).toBe(true);

    // Acknowledgement alone is not sufficient: inspect the downstream decision.
    const ilya = decideAll(s, s.world).find((x) => x.decision.department === "security")!;
    expect(ilya.decision.orders).not.toContain(s.today[0].id);
    expect(ilya.decision.basis).not.toBe("order");
  });

  it("retains the conflict with SO-2 when SO-1 is revoked by the same order", () => {
    function record(id: string, text: string): OrderRecord {
      return {
        id,
        day: 1,
        text,
        measurements: vector({ scope: ["engineering"] }),
        scope: ["engineering"],
        kind: "command",
        standingOrderId: null,
        answered: [],
      };
    }
    const standing = [
      makeStandingOrder(record("O-1-1", "Keep the battery untouched."), 1),
      makeStandingOrder(record("O-1-2", "Always keep Works heated."), 2),
    ];
    const m = vector({
      standing: [
        { standingOrderId: "SO-1", conflict: 0, override: 0.99 }, // Cancel SO-1.
        { standingOrderId: "SO-2", conflict: 0.99, override: 0 }, // Break, but do not cancel, SO-2.
      ],
    });
    expect(applyOverrides(standing, m, "O-2-1", 2)).toEqual(["SO-1"]);
    expect(standingConflicts(standing, m).map((x) => x.so.id)).toEqual(["SO-2"]);
    // A repair should bind measured results to standing-order IDs, not to a
    // filtered array's current positions. Adapt this fixture when adding IDs.
  });

  it("releases resources that a zero-work action cannot consume", () => {
    const s = newGame("review-allocation");
    const w = s.world;
    w.vehicles.operational = 0;
    w.vehicles.held = false;
    w.fuel.reservedForPumps = false;
    w.fuel.units = FUEL.generatorNight * Math.min(1, w.power.generatorHealth) + 6.1;
    expect(fuelForTrucks(w)).toBe(6);

    // Deliberately controlled requests isolate the allocator from action choice.
    // No orders: Ilya's initiative ranks the security request before Orlov's.
    const first: ActionDef = {
      ...action("sec_investigate"),
      requests: () => [{ key: "fuel", amount: 6 }, { key: "vehicles", amount: 1 }],
    };
    const second: ActionDef = {
      ...action("eng_repair_generator"),
      requests: () => [{ key: "fuel", amount: 4 }],
    };
    const result = allocate(s, w, [planned(first), planned(second)]);
    expect(result.perDepartment.security.fraction).toBe(0);
    expect(result.perDepartment.engineering.fraction).toBe(1);
    // Determine feasible execution fraction before debiting the resource vector,
    // or explicitly return unused reservations before serving the next action.
  });

  it("does not reveal the contact when the investigation has zero execution capacity", () => {
    let s = applyOrder(
      crisisState("review-zero-investigation"),
      "Ilya, identify the contact. Do not engage.",
      ILYA_LOOK,
    );
    // Preserve the selected mission's context, but remove all capacity to run it.
    s.world.crews.security.dead = s.world.crews.security.size;
    s.world.vehicles.operational = 0;
    s.world.security.contact = "unknown";
    const result = executeDay(s);
    const ilya = result.decisions.find((d) => d.department === "security")!;
    expect(ilya.action).toBe("sec_investigate");
    expect(ilya.allocation?.fraction).toBe(0);
    expect(ilya.effects.some((e) => e.path === "security.contact")).toBe(false);
    // Inspect the day's action effects rather than the final world: an
    // independent night event must not be confused with this mission.
  });

  it("does not count unrelated engineering work as attending frozen pipes", () => {
    const base = newGame("review-crisis-attendance", "analyst");
    base.world.power.generatorHealth = 0.5;
    base.world.power.output = 0.45;
    base.world.water.pumpHealth = 0.8;
    base.world.water.pipesFrozen = true;
    base.world.crises = [{
      id: "frozen_pipes-1",
      template: "frozen_pipes",
      sector: "works",
      severity: 0.4,
      dayStarted: 1,
      neglect: 1,
    }];
    const m = vector({
      objective: "repair",
      sector: "core",
      owner: "engineering",
      scope: ["engineering"],
      nouls: { priority_power: 0.99, priority_infrastructure: 0.99 },
      scores: { clarity: 3, urgency: 2 },
    });
    const s = applyOrder(base, "Orlov, repair the generator in Core.", m);
    const result = executeDay(s);
    const orlov = result.decisions.find((d) => d.department === "engineering")!;
    expect(orlov.action).toBe("eng_repair_generator");
    expect(result.world.water.pipesFrozen).toBe(true);
    const pipes = result.world.crises.find((c) => c.id === "frozen_pipes-1");
    expect(pipes).toBeDefined();
    expect(pipes!.neglect).toBe(2);
    // Match actual action, target and execution to a crisis, not just department.
  });
});
