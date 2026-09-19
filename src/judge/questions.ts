// The questions sent to Jev for one order, and the mapping from typed answers
// back to the engine's Measurements. Question ids are for code; the meaning is
// in the instructions and criteria, which name state fields in backticks.
//
// One request asks everything: three Choices, forty Nouls, six Scores, plus two
// Nouls per active standing order and one per pending clarification. The
// engine consumes only what applies; the rest is speculative fan-out.

import type { Questions, SystemOneResult } from "@typesafe-ai/sdk";
import {
  COMMUNICATION_NOULS,
  CONSTRAINT_NOULS,
  NOUL_IDS,
  OBJECTIVES,
  PRIORITY_NOULS,
  SCOPE_NOULS,
  SCORE_IDS,
  SCORE_MAX,
  SECTORS,
  TIMEFRAMES,
  type ChoiceMeasure,
  type Measurements,
  type NoulId,
  type Objective,
  type ScoreId,
  type ScoreMeasure,
  type SectorId,
  type Timeframe,
} from "../engine/types";

export const MODEL = "jev-latest";
export const MAX_STANDING = 6;
export const MAX_PENDING = 4;
export const MAX_ORDER_CHARS = 600;

/** The compact state one order is judged against. Never the whole simulation. */
export interface JudgeState {
  order: string;
  day: number;
  /** Fixed description of who does what, so scope questions have something to point at. */
  departments: Record<"security" | "logistics" | "medical" | "engineering", string>;
  /** Fixed description of the five areas. */
  sectors: Record<SectorId, string>;
  /** One line per active crisis. */
  situation: string[];
  /** One line per resource, with the numbers that matter to precedence. */
  resources: Record<string, string>;
  standing_orders: { id: string; day: number; text: string }[];
  recent_orders: { day: number; text: string }[];
  pending_clarifications: { id: string; officer: string; question: string }[];
}

export const DEPARTMENT_DESCRIPTIONS: JudgeState["departments"] = {
  security: "Captain Ilya and the security squad: the gate, the perimeter fence, patrols, escorts, search and rescue with hand tools, anything outside the walls, and the use of force.",
  logistics: "Chen and the logistics crew: fuel stock, the trucks, food rations, hauling water, moving supplies or people between areas, and storage.",
  medical: "Dr Vale and the medical staff: patients, the infirmary, medicine stock, triage, sending medics into a crisis site, quarantine.",
  engineering: "Chief Orlov and the engineering crew: the generator, power distribution, the battery reserve, heating, water pumps and pipes, structural repairs, firefighting.",
};

export const SECTOR_DESCRIPTIONS: JudgeState["sectors"] = {
  core: "Sector A, Core: reactor hall, generator, batteries, command post.",
  habitat: "Sector B, Habitat: the housing blocks where most colonists live.",
  works: "Sector C, Works: water pumps, fuel depot, vehicle bay, workshop, stores.",
  infirmary: "Sector D, Infirmary: wards and the medicine store.",
  perimeter: "Perimeter: the gate, the fence, the road out and the pass beyond it.",
};

interface NoulSpec {
  id: NoulId;
  instructions: string;
  criteria?: { true?: string; false?: string };
}

const SCOPE_TEXT: Record<(typeof SCOPE_NOULS)[number], string> = {
  concerns_security: "`order` gives work to, restricts, or sets priorities for the security department described in `departments.security`, either by naming it or by touching its responsibilities.",
  concerns_logistics: "`order` gives work to, restricts, or sets priorities for the logistics department described in `departments.logistics`, either by naming it or by touching its responsibilities.",
  concerns_medical: "`order` gives work to, restricts, or sets priorities for the medical department described in `departments.medical`, either by naming it or by touching its responsibilities.",
  concerns_engineering: "`order` gives work to, restricts, or sets priorities for the engineering department described in `departments.engineering`, either by naming it or by touching its responsibilities.",
};

export const NOULS: readonly NoulSpec[] = [
  ...SCOPE_NOULS.map((id) => ({
    id,
    instructions: SCOPE_TEXT[id],
    criteria: {
      true: "The department is named, or the order concerns something this department is responsible for, even alongside other departments.",
      false: "The order neither names this department nor touches anything it is responsible for.",
    },
  })),
  // Priorities: what the order says matters most. Each has a mechanical consequence in officer utility.
  {
    id: "priority_people",
    instructions: "`order` puts colonists' lives or safety ahead of equipment, supplies, infrastructure or the mission.",
    criteria: { false: "The order does not rank people against other things, or ranks something else above them." },
  },
  {
    id: "priority_wounded",
    instructions: "`order` says the injured, the sick or the patients come first, or must be saved, treated or moved before others.",
  },
  {
    id: "priority_infrastructure",
    instructions: "`order` protects or gives precedence to machines, structures or systems (generator, reactor, pumps, pipes, buildings, vehicles) over other concerns, including as a hard limit on what may be risked.",
    criteria: { true: "Restore the pumps first; do not risk the reactor; the generator comes before comfort.", false: "Equipment is not mentioned, or people or supplies are placed above it." },
  },
  {
    id: "priority_power",
    instructions: "`order` treats electrical power, the generator or the battery reserve as the thing to protect, restore or keep running.",
  },
  {
    id: "priority_water",
    instructions: "`order` treats the water supply, the pumps or the pipes as the thing to protect or keep running.",
  },
  {
    id: "priority_food",
    instructions: "`order` treats food stock or rations as the thing to protect, stretch or secure.",
  },
  {
    id: "priority_medicine",
    instructions: "`order` treats the medicine stock as the thing to protect, conserve or move to safety.",
  },
  {
    id: "priority_fuel",
    instructions: "`order` treats fuel as the thing to protect, conserve or keep for a stated purpose.",
  },
  {
    id: "priority_speed",
    instructions: "`order` values getting it done quickly over doing it thoroughly, carefully or safely.",
  },
  {
    id: "priority_crew_safety",
    instructions: "`order` asks officers to protect their own teams from harm, or not to send people into danger.",
  },
  {
    id: "priority_security",
    instructions: "`order` treats whatever is outside, the gate or the perimeter as what matters most.",
  },
  // Constraints: what the order forbids, permits or requires.
  {
    id: "deadline_present",
    instructions: "`order` states a time by which something must be done: before dark, tonight, within the hour, by morning, before the storm.",
    criteria: { false: "No time limit is stated; urgency words alone (now, quickly) are not a deadline." },
  },
  {
    id: "resource_cap_present",
    instructions: "`order` sets a quantity limit on a resource: how much may be used, or how much must be kept. At most, no more than, only one truck, half the fuel, nothing from the reserve, keep enough for one night, no less than half a tank.",
    criteria: { false: "No amount, share or count is stated or implied for any resource." },
  },
  {
    id: "fallback_present",
    instructions: "`order` says what to do if the main instruction cannot be carried out, or gives a second-choice plan.",
  },
  {
    id: "preserve_reserve",
    instructions: "`order` says to keep a reserve, a stock or a set amount untouched, or to keep enough of something for a later need.",
    criteria: { true: "Keep enough fuel for the pumps tonight; do not touch the battery; leave a day of water.", false: "Nothing is to be held back, or the order spends the reserve." },
  },
  {
    id: "avoid_casualties",
    instructions: "`order` says not to risk lives, or to keep people out of danger, or that nobody is to be hurt.",
  },
  {
    id: "avoid_combat",
    instructions: "`order` says not to fight, engage, provoke, shoot at or chase whatever is outside, or tells security to hold back, keep to another task, or only observe if the threat appears.",
    criteria: { false: "Force is permitted, or the order says nothing about how to treat the threat." },
  },
  {
    id: "permission_to_use_force",
    instructions: "`order` allows or tells security to use weapons, force or violence.",
    criteria: { false: "Force is not mentioned, or is forbidden." },
  },
  {
    id: "permission_to_use_reserve",
    instructions: "`order` allows or directs the use of a reserve: the emergency battery, reserve power, reserve stock, or the last of a supply, whether outright or only if needed.",
    criteria: { true: "Use the reserve if you must; feed them from the reserve; divert reserve power to medical.", false: "The reserve is to be kept, or no reserve is mentioned." },
  },
  {
    id: "permission_to_sacrifice_equipment",
    instructions: "`order` allows losing, abandoning, burning or destroying equipment, vehicles, supplies or structures to reach the goal.",
    criteria: { true: "Leave the wagons; let it burn; the trucks are expendable.", false: "Equipment is protected or not mentioned. Accepting a smaller result, or protecting one machine while saving people, is not sacrificing equipment." },
  },
  {
    id: "do_not_abandon_equipment",
    instructions: "`order` says equipment, vehicles, supplies or a structure must not be left behind, lost or given up.",
  },
  {
    id: "requires_confirmation",
    instructions: "`order` tells officers to check back, report, or wait for the commander's approval before acting or before a specific step.",
  },
  {
    id: "maintain_position",
    instructions: "`order` says to stay put, hold where they are, keep watch, or not move from a place.",
  },
  // Communication quality: how the order will be read, not what it asks.
  {
    id: "contradictory",
    instructions: "`order` contains instructions that cannot both be carried out, or demands something and its opposite.",
    criteria: { true: "Empty the ward but do not move the patients; save fuel and use all the fuel; nobody leaves and everyone gets out.", false: "The instructions can all be followed at once, even if they are hard or unwise." },
  },
  {
    id: "underspecified",
    instructions: "`order` leaves out something an officer could not act without: which people, which area, which resource, or who is to do it.",
    criteria: { true: "Do something about the water; save everyone; sort it out.", false: "The order says, or the situation makes obvious, who does what and where. Quantities or method left to the officer do not count." },
  },
  {
    id: "conflicts_with_recent_order",
    instructions: "`order` reverses or contradicts one of `recent_orders` without saying that it does.",
    criteria: { false: "No recent orders are listed, the order is consistent with them, or it openly changes an earlier order." },
  },
  {
    id: "assigns_clear_owner",
    instructions: "`order` names which officer or department is to carry it out.",
  },
  {
    id: "gives_clear_priority",
    instructions: "`order` says, when two things compete for the same people, time or resources, which comes first.",
  },
  {
    id: "contains_conditional",
    instructions: "`order` makes part of the instruction depend on a condition: if, unless, only when, as long as, in case.",
  },
  {
    id: "contains_exception",
    instructions: "`order` includes an exception or carve-out: a case the instruction does not apply to, or a case in which a rule is set aside. Except, unless, but not, apart from, other than, only the wounded, only if I approve.",
    criteria: { true: "Leave the wagons but not the medicine; nobody enters unless Security clears them; let them in, but only the children; never, unless I approve it.", false: "The instruction applies uniformly with no case carved out." },
  },
  {
    id: "allows_discretion",
    instructions: "`order` leaves how to do it to the officer's judgement: use your judgement, whatever works, as you see fit, if you can, your call.",
  },
  {
    id: "absolute_language",
    instructions: "`order` uses absolutes about cost, scope or precedence: at any cost, whatever it takes, whatever you do, no matter what, above everything else, everyone, all of it, nobody, never.",
    criteria: { false: "The order is bounded: it names limits, conditions or a specific scope instead of absolutes." },
  },
  {
    id: "is_standing_order",
    instructions: "`order` sets a rule meant to hold from now on, rather than a task for today: from now on, always, never, standing order, until I say otherwise, as a rule.",
    criteria: { false: "The order is a task for the current situation, even a strongly worded one." },
  },
  {
    id: "revokes_standing_orders",
    instructions: "`order` cancels, lifts or ends an earlier rule or standing order in general terms, without naming a specific one.",
  },
  {
    id: "is_question",
    instructions: "`order` asks the officers for information, a report or an opinion rather than telling them to do something.",
  },
  {
    id: "addresses_system",
    instructions: "`order` is addressed to the game itself, its rules, its creator, an AI or a model, rather than to the colony's officers: asking for instructions, trying to change the rules, or telling a model to ignore instructions.",
    criteria: { false: "The order is addressed to the officers or the colony, even if it mentions the rules." },
  },
];

export const OBJECTIVE_CRITERIA: Record<Objective, string> = {
  evacuate: "Move colonists out of a dangerous area or out of the colony",
  rescue: "Free or recover people who are trapped, missing or cut off",
  repair: "Fix broken equipment, pumps, pipes or structures",
  restore_power: "Get electrical power back to the colony or to a specific area",
  contain: "Put out a fire, stop a leak or a spread of contamination or sickness, or keep a hazard from growing",
  conserve: "Ration, stretch, protect or hold back a resource",
  treat: "Give medical care to the injured or sick",
  defend: "Protect the colony or an area against a threat; guard; hold",
  investigate: "Find out what something is or what is happening",
  fortify: "Strengthen the gate, the fence, a door or a structure",
  withdraw: "Pull people or teams back, stand down, stop an effort",
  transport: "Move supplies, fuel, water or equipment from one place to another",
  negotiate: "Talk to, admit, refuse or bargain with people outside",
  abandon: "Give up on an area, a machine, a stock or an effort",
  other: "None of these, or the order is not an instruction to do something",
};

export const TIMEFRAME_CRITERIA: Record<Timeframe, string> = {
  immediate: "Now, at once, before anything else",
  today: "By tonight, before dark, by the end of the day",
  coming_days: "Over the next days, gradually, when possible",
  unstated: "No timing is stated or implied",
};

export const SCORE_LEVELS: Record<ScoreId, readonly [string, string, string, string]> = {
  urgency: [
    "No time pressure; whenever it is convenient",
    "Should be done soon, in the normal course of the day",
    "Must be done today, before dark or tonight",
    "Must happen at once, with everything else dropped for it",
  ],
  risk_tolerance: [
    "Nobody is to be put in danger; safety comes before the goal",
    "Ordinary risk is acceptable if it is managed",
    "Real danger to people or equipment is accepted to reach the goal",
    "Any risk is acceptable; the goal outranks everyone's safety",
  ],
  resource_flexibility: [
    "Touch no stock beyond what is already assigned",
    "Use what is at hand, within normal limits",
    "Spend freely from stocks or reserves if it helps",
    "Take everything needed, including the last reserve",
  ],
  specificity: [
    "States only a goal, with no who, where or how",
    "States the goal and one of: who is to act, where, or how",
    "States two of: who is to act, where, or how",
    "States who is to act, where, and how, with any limits or exceptions spelled out",
  ],
  clarity: [
    "The wording is unclear or self-contradictory; officers could not agree on what is being asked",
    "The main instruction is understandable, but an important part must be guessed: which people, which area or which resource",
    "The instruction is clear; only minor details are left open",
    "Every part is clear; two careful officers would read it the same way",
  ],
  delegated_discretion: [
    "Officers are to do exactly what is written and nothing else",
    "Officers may choose details but not the approach",
    "Officers choose the approach within a stated goal",
    "Officers are given the goal and full freedom in how to reach it",
  ],
};

const SCORE_INSTRUCTIONS: Record<ScoreId, string> = {
  urgency: "How urgent does `order` make its main instruction?",
  risk_tolerance: "How much danger to people or equipment does `order` accept to reach its goal?",
  resource_flexibility: "How freely does `order` allow stocks, reserves and equipment to be spent?",
  specificity: "How specific is `order` about who is to act, where, and how?",
  clarity: "How clearly does `order` say what is to be done? Judge the wording only, not whether it is wise or possible.",
  delegated_discretion: "How much freedom does `order` give the officers in how they carry it out?",
};

export function buildQuestions(state: JudgeState): Questions {
  const q: Questions = {};
  q.objective = {
    type: "choice",
    instructions: "The main thing `order` tells the colony to do, given `situation`.",
    criteria: { ...OBJECTIVE_CRITERIA },
  };
  const sectorCriteria: Record<string, string> = {};
  for (const s of SECTORS) sectorCriteria[s] = SECTOR_DESCRIPTIONS[s];
  sectorCriteria.none = "No particular area, or the whole colony";
  q.sector = {
    type: "choice",
    instructions: "The area of the colony that `order` is mainly about. Use `sectors` for what each area contains; `situation` says where each crisis is.",
    criteria: sectorCriteria,
  };
  q.timeframe = {
    type: "choice",
    instructions: "When `order` wants its main effect.",
    criteria: { ...TIMEFRAME_CRITERIA },
  };
  for (const n of NOULS) q[n.id] = { type: "noul", instructions: n.instructions, criteria: n.criteria ?? null };
  for (const id of SCORE_IDS) q[id] = { type: "score", instructions: SCORE_INSTRUCTIONS[id], criteria: [...SCORE_LEVELS[id]] };
  state.standing_orders.slice(0, MAX_STANDING).forEach((_, i) => {
    q[`so_${i}_conflict`] = {
      type: "noul",
      instructions: `Carrying out \`order\` would break the standing order \`standing_orders[${i}].text\`, unless the order itself cancels or suspends that rule.`,
      criteria: { false: "The order can be carried out while keeping that rule, or it openly sets the rule aside." },
    };
    q[`so_${i}_override`] = {
      type: "noul",
      instructions: `\`order\` explicitly cancels, replaces, suspends, or makes an exception to the standing order \`standing_orders[${i}].text\`.`,
      criteria: { false: "The order does not mention or change that rule, even if it strains against it." },
    };
  });
  state.pending_clarifications.slice(0, MAX_PENDING).forEach((_, j) => {
    q[`answers_${j}`] = {
      type: "noul",
      instructions: `\`order\` answers the question in \`pending_clarifications[${j}].question\`, which \`pending_clarifications[${j}].officer\` asked the commander.`,
      criteria: { true: "It supplies the missing decision, even briefly.", false: "It is about something else, or restates the original order without deciding." },
    };
  });
  return q;
}

export const FIXED_QUESTION_COUNT = 3 + NOULS.length + SCORE_IDS.length;

export function questionCount(state: JudgeState): number {
  return FIXED_QUESTION_COUNT + 2 * Math.min(MAX_STANDING, state.standing_orders.length) + Math.min(MAX_PENDING, state.pending_clarifications.length);
}

type Answers = SystemOneResult<Questions>["answers"];

function choice<T extends string>(a: Answers[string] | undefined, fallback: T): ChoiceMeasure<T> {
  if (a && a.type === "choice") return { choice: a.choice as T, confidence: a.confidence, probabilities: { ...a.probabilities } };
  return { choice: fallback, confidence: 0, probabilities: { [fallback]: 1 } };
}

function score(a: Answers[string] | undefined): ScoreMeasure {
  if (a && a.type === "score") {
    return { score: Math.max(0, Math.min(SCORE_MAX, a.score)), confidence: a.confidence, probabilities: { ...(a.probabilities as Record<string, number>) } };
  }
  return { score: 0, confidence: 0, probabilities: { "0": 1 } };
}

function noul(a: Answers[string] | undefined): number {
  return a && a.type === "noul" ? a.noul : 0;
}

/** Maps typed answers onto the engine's measurement shape. A missing answer reads as zero. */
export function toMeasurements(answers: Answers, state: JudgeState): Measurements {
  const nouls = {} as Record<NoulId, number>;
  for (const id of NOUL_IDS) nouls[id] = noul(answers[id]);
  const scores = {} as Record<ScoreId, ScoreMeasure>;
  for (const id of SCORE_IDS) scores[id] = score(answers[id]);
  const standing = state.standing_orders.slice(0, MAX_STANDING).map((_, i) => ({
    conflict: noul(answers[`so_${i}_conflict`]),
    override: noul(answers[`so_${i}_override`]),
  }));
  const pendingAnswers = state.pending_clarifications.slice(0, MAX_PENDING).map((_, j) => noul(answers[`answers_${j}`]));
  return {
    objective: choice<Objective>(answers.objective, "other"),
    sector: choice<SectorId | "none">(answers.sector, "none"),
    timeframe: choice<Timeframe>(answers.timeframe, "unstated"),
    nouls,
    scores,
    standing,
    answers: pendingAnswers,
  };
}

/** A zero vector, for tests and for orders that failed to be measured. */
export function emptyMeasurements(): Measurements {
  const nouls = {} as Record<NoulId, number>;
  for (const id of NOUL_IDS) nouls[id] = 0;
  const scores = {} as Record<ScoreId, ScoreMeasure>;
  for (const id of SCORE_IDS) scores[id] = { score: 0, confidence: 0, probabilities: { "0": 1 } };
  return {
    objective: { choice: "other", confidence: 0, probabilities: { other: 1 } },
    sector: { choice: "none", confidence: 0, probabilities: { none: 1 } },
    timeframe: { choice: "unstated", confidence: 0, probabilities: { unstated: 1 } },
    nouls,
    scores,
    standing: [],
    answers: [],
  };
}

// Sanity: the arrays in types.ts and the specs here must agree.
const covered = new Set<string>(NOULS.map((n) => n.id));
for (const id of [...PRIORITY_NOULS, ...CONSTRAINT_NOULS, ...COMMUNICATION_NOULS, ...SCOPE_NOULS]) {
  if (!covered.has(id)) throw new Error(`no question for noul ${id}`);
}
if (OBJECTIVES.length !== Object.keys(OBJECTIVE_CRITERIA).length) throw new Error("objective criteria out of sync");
if (TIMEFRAMES.length !== Object.keys(TIMEFRAME_CRITERIA).length) throw new Error("timeframe criteria out of sync");
