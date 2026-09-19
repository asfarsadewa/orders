// One day at Vesper Station: officers decide, the pool is split, actions are
// applied, the night runs, crises move. Pure given the state and the seed.

import { CONTACT_TRUTH, dangerSector, routineFor, type ActionContext } from "../content/actions";
import { CRISES, CRISIS_BY_ID } from "../content/crises";
import { RUN_DAYS, forecast, freshTonight, hiddenContact } from "../content/scenario";
import { scoped } from "./rng";
import { allocate, decideAll, type Decided } from "./resolve";
import { nightTick, recorder } from "./world";
import type { ActiveCrisis, Allocations, Decision, Department, Effect, GameState, SectorId, World } from "./types";

export interface DayOutcome {
  world: World;
  decisions: Decision[];
  allocations: Allocations;
  night: Effect[];
  newCrises: ActiveCrisis[];
  resolved: string[];
  /** Crew casualties caused by ordered actions, per department. */
  crewCasualties: Record<Department, number>;
  deathsOvernight: number;
}

/** The hidden facts the seed decides once. */
export function seedFacts(seed: string): { weather: ReturnType<typeof forecast>; contact: ReturnType<typeof hiddenContact> } {
  return { weather: forecast(scoped(seed, "weather"), RUN_DAYS + 1), contact: hiddenContact(scoped(seed, "contact")) };
}

/** Which crises the chosen actions speak to, so neglect is counted honestly. */
function attended(world: World, decided: Decided[]): Set<string> {
  const out = new Set<string>();
  for (const c of world.crises) {
    const t = CRISIS_BY_ID.get(c.template);
    if (!t) continue;
    for (const x of decided) {
      if (x.decision.basis === "routine" || x.decision.basis === "clarification") continue;
      if (t.concerns.includes(x.decision.department)) out.add(c.id);
    }
  }
  return out;
}

export function executeDay(state: GameState): DayOutcome {
  const world = structuredClone(state.world);
  const facts = seedFacts(state.seed);
  CONTACT_TRUTH.value = facts.contact;
  const rng = scoped(state.seed, "day", state.day);

  // 1. Decide and allocate.
  const decided = decideAll(state, world);
  const { allocations, perDepartment } = allocate(state, world, decided);

  // 2. Apply, in allocation order (the same order the pool was split in).
  const crewCasualties: Record<Department, number> = { security: 0, logistics: 0, medical: 0, engineering: 0 };
  const deadBefore = world.people.dead;
  for (const x of decided) {
    const d = x.decision.department;
    const def = x.decision.basis === "clarification" ? routineFor(d) : x.def;
    const alloc = perDepartment[d];
    const rec = recorder(def.id);
    const hurtBefore = world.crews[d].injured + world.crews[d].dead;
    const sector = x.lead && x.lead.measurements.sector.choice !== "none" ? (x.lead.measurements.sector.choice as SectorId) : null;
    const ctx: ActionContext = {
      sector: sector ?? (def.sectors?.length === 1 ? def.sectors[0] : def.sectors ? null : dangerSector(world)),
      urgency: x.lead ? x.lead.measurements.scores.urgency.score : 0,
      rng: scoped(state.seed, "act", state.day, d),
      granted: alloc.granted,
    };
    def.apply(world, rec, alloc.fraction, ctx);
    x.decision.allocation = alloc;
    x.decision.effects = rec.effects;
    if (x.decision.basis === "order") crewCasualties[d] += world.crews[d].injured + world.crews[d].dead - hurtBefore;
  }

  // 3. Night.
  const night = recorder("night");
  const weather = facts.weather[state.day - 1] ?? facts.weather[facts.weather.length - 1];
  nightTick(world, night, { weather, contactTruth: facts.contact, rng });

  // 4. Crises: neglect, resolution, then new ones.
  const attendedIds = attended(world, decided);
  const resolved: string[] = [];
  const crisisRec = recorder("crisis");
  for (const c of world.crises) {
    const t = CRISIS_BY_ID.get(c.template);
    if (!t) continue;
    if (!attendedIds.has(c.id)) {
      c.neglect += 1;
      c.severity = Math.min(1, c.severity + 0.12);
      t.onNight?.(world, crisisRec, c, scoped(state.seed, "crisis", c.id, state.day));
    } else c.severity = Math.max(0, c.severity - 0.1);
  }
  world.crises = world.crises.filter((c) => {
    const t = CRISIS_BY_ID.get(c.template)!;
    const done = t.resolved(world, c);
    if (done) resolved.push(c.id);
    return !done;
  });
  const nextDay = state.day + 1;
  const seen = new Set(state.reports.flatMap((r) => r.newCrises.map((c) => c.template)).concat(world.crises.map((c) => c.template)));
  const active = new Set(world.crises.map((c) => c.template));
  const candidates = CRISES.filter((t) => !active.has(t.id) && (t.fromDay ?? 1) <= nextDay && !(t.once && seen.has(t.id)) && t.requires(world));
  const newCrises: ActiveCrisis[] = [];
  const spawnRng = scoped(state.seed, "spawn", state.day);
  const draws = [0.85, 0.4];
  for (const p of draws) {
    if (!candidates.length || spawnRng.next() > p) continue;
    const total = candidates.reduce((s, t) => s + t.weight, 0);
    let r = spawnRng.next() * total;
    let pick = candidates[0];
    for (const t of candidates) {
      r -= t.weight;
      if (r <= 0) {
        pick = t;
        break;
      }
    }
    candidates.splice(candidates.indexOf(pick), 1);
    const sector = typeof pick.sector === "function" ? pick.sector(world) : pick.sector;
    const crisis: ActiveCrisis = { id: `${pick.id}-${nextDay}`, template: pick.id, sector, severity: 0.3, dayStarted: nextDay, neglect: 0 };
    pick.onStart(world, crisisRec, scoped(state.seed, "crisis", crisis.id));
    if (!pick.resolved(world, crisis)) {
      world.crises.push(crisis);
    }
    newCrises.push(crisis);
  }

  // 5. Morning.
  world.day = nextDay;
  world.tonight = freshTonight();
  world.weather = facts.weather[nextDay - 1] ?? world.weather;

  return {
    world,
    decisions: decided.map((x) => x.decision),
    allocations,
    night: [...night.effects, ...crisisRec.effects],
    newCrises,
    resolved,
    crewCasualties,
    deathsOvernight: world.people.dead - deadBefore,
  };
}
