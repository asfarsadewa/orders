/**
 * Follow-up regressions for ORDERS at:
 * e23cda11191da78f55dc9386a4845b722ff40ece
 *
 * Place this file in test/followup-regressions.test.ts and run:
 *   npx vitest run test/followup-regressions.test.ts
 *
 * These proposed tests have NOT been executed against the complete repository
 * in this review environment. The allocator's reservation loop and execution
 * predicate were exercised separately in an isolated source-equivalent probe.
 * The replay test specifies the recommended non-destructive migration policy.
 */
import { describe, expect, it } from "vitest";
import { ACTION_BY_ID, type ActionDef } from "../src/content/actions";
import { FUEL } from "../src/content/scenario";
import { applyOrder, newGame, replay } from "../src/engine/game";
import { allocate, type Decided } from "../src/engine/resolve";
import type { Measurements } from "../src/engine/types";
import { fuelForTrucks } from "../src/engine/world";
import { ILYA_LOOK } from "./fixtures";

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

describe("follow-up: allocation and replay contracts", () => {
  it("does not reserve resources for a mission below its minimum executable effort", () => {
    const state = newGame("review-minimum-effort", "analyst");
    const world = state.world;
    world.vehicles.operational = 1;
    world.vehicles.held = false;
    world.fuel.reservedForPumps = false;
    world.fuel.units = FUEL.generatorNight * Math.min(1, world.power.generatorHealth) + 6.1;
    // Exactly eight security crew-hours. Investigation requests forty.
    world.crews.security.size = 1;
    world.crews.security.dead = 0;
    world.crews.security.injured = 0;
    world.crews.security.fatigue = 0;
    world.crews.logistics.fatigue = 0;
    expect(fuelForTrucks(world)).toBe(6);

    const scout = action("sec_investigate");
    const haul = action("log_haul_water");
    expect(scout.minEffort).toBe(0.5);

    // With no orders, security's initiative ranks it before logistics.
    // The scout can support only 20% effort, below its 50% minimum.
    // Its rejected mission must leave the truck and fuel available to Chen.
    const result = allocate(state, world, [planned(scout), planned(haul)]);
    const scoutReservations = result.allocations.rows.filter((r) => r.department === "security");
    expect(scoutReservations.length).toBeGreaterThan(0);
    expect(scoutReservations.every((r) => r.used === 0)).toBe(true);
    expect(result.perDepartment.logistics.fraction).toBe(1);
  });

  it("migrates an older recording without a target instead of throwing during replay", () => {
    const current = applyOrder(
      newGame("review-legacy-target", "analyst"),
      "Ilya, identify the contact. Do not engage.",
      structuredClone(ILYA_LOOK),
    );
    const legacyEvents = structuredClone(current.events);
    // Before D35, saved measurements had no target property.
    for (const event of legacyEvents) {
      if (event.kind === "order") delete (event.measurements as Partial<Measurements>).target;
    }

    expect(() => replay(legacyEvents)).not.toThrow();
    const restored = replay(legacyEvents);
    expect(restored.today).toHaveLength(1);
    // An absent historical target is unknown; do not invent a fresh model result.
    expect(restored.today[0].measurements.target).toMatchObject({
      choice: "none",
      confidence: 0,
    });
    // Preserve the source recording so a failed migration can be recovered.
    const sourceOrder = legacyEvents.find((event) => event.kind === "order");
    expect(sourceOrder?.kind === "order" && "target" in sourceOrder.measurements).toBe(false);
  });
});
