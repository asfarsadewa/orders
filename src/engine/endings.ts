// Endings are computed from accumulated state, never from one choice.

import { INITIAL_POPULATION, RUN_DAYS } from "../content/scenario";
import { PHYS, infrastructureScore, resourceScore } from "./world";
import type { Ending, EndingId, GameState } from "./types";

export const ENDING_TITLE: Record<EndingId, string> = {
  colony_survives: "The colony survives",
  pyrrhic_survival: "Pyrrhic survival",
  evacuation: "Evacuation",
  infrastructure_collapse: "Infrastructure collapse",
  mutiny: "Mutiny",
  abandonment: "Abandonment",
  total_loss: "Total loss",
};

/** Whether the run is over, and how. Null while it continues. */
export function evaluateEnding(state: GameState): Ending | null {
  const w = state.world;
  const initial = INITIAL_POPULATION + w.security.admitted;
  const alive = w.people.total + w.people.evacuated;
  const population = Math.round((alive / initial) * 1000) / 1000;
  const evacuated = w.people.evacuated / initial;
  const dead = w.people.dead / initial;
  const infrastructure = infrastructureScore(w);
  const resources = resourceScore(w);
  const morale = w.morale;
  const confidence = Math.round(((state.trust.security + state.trust.logistics + state.trust.medical + state.trust.engineering) / 4) * 1000) / 1000;
  const scores = { population, infrastructure, resources, morale, confidence };
  const done = (id: EndingId, summary: string): Ending => ({ id, title: ENDING_TITLE[id], summary, scores });

  const meanTrust = confidence;
  const over = state.day > RUN_DAYS;
  if (w.people.total <= initial * 0.3 && evacuated < 0.5) return done("total_loss", `${w.people.dead} dead. Fewer than a third of the colony is left inside, and nobody got out.`);
  if (w.lowMoraleDays >= PHYS.mutinyDays || meanTrust < 0.2) return done("mutiny", w.lowMoraleDays >= PHYS.mutinyDays ? "Morale sat below the line for three days. The officers stopped waiting for orders." : "The officers no longer trust the chair. They run the colony without it.");
  if (evacuated >= 0.6) {
    if (dead >= 0.2) return done("abandonment", `${w.people.evacuated} people reached the pass. ${w.people.dead} did not, and the colony is empty.`);
    return done("evacuation", `${w.people.evacuated} people reached the pass. The colony is empty, and most of it is alive.`);
  }
  if (w.power.generatorHealth < 0.15 && w.water.days < 0.5 && (over || w.fuel.units < 5)) {
    return done("infrastructure_collapse", "The generator is dead and the tanks are dry. Whoever is still inside will not be by the end of the week.");
  }
  if (!over) return null;
  if (dead >= 0.15 || infrastructure < 0.35 || resources < 0.18) {
    return done("pyrrhic_survival", `${w.people.total} people saw day ${RUN_DAYS}. ${w.people.dead} did not, and the station is barely a station.`);
  }
  return done("colony_survives", `${w.people.total} people saw day ${RUN_DAYS} with the lights on and water in the tanks.`);
}
