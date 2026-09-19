// The engine's vocabulary. Everything here is plain data: the measurements Jev
// returns for one order, the world, the officers, the actions they can take,
// and the event stream that reproduces a run. Nothing in the engine reaches
// outside src/engine and src/content.

// ---------------------------------------------------------------------------
// Departments, officers, sectors

export type Department = "security" | "logistics" | "medical" | "engineering";
export const DEPARTMENTS: readonly Department[] = ["security", "logistics", "medical", "engineering"];

export type SectorId = "core" | "habitat" | "works" | "infirmary" | "perimeter";
export const SECTORS: readonly SectorId[] = ["core", "habitat", "works", "infirmary", "perimeter"];

/** Numeric personality. Officers differ only by these numbers. */
export interface Doctrine {
  /** How much the words outrank the evident intent. */
  literalness: number;
  /** Willingness to act on implied intent and to act unordered on a crisis. */
  initiative: number;
  /** Weight of risk to crew and people against the objective. */
  riskAversion: number;
  /** Weight of the current order against everything else. */
  obedience: number;
  /** Weight of standing orders and precedent against the current order. */
  precedentWeight: number;
  /** Security: multiplier on urgency. */
  urgencyResponse: number;
  /** Logistics: multiplier on reserve protection and on penalties for unclear resource precedence. */
  resourceCaution: number;
  /** Medical: multiplier on priorities that save lives. */
  lifePriority: number;
  /** Engineering: multiplier on infrastructure priorities. */
  infrastructureWeight: number;
}

export interface OfficerSpec {
  id: Department;
  /** How the officer is addressed in the UI and by the others: "Captain Ilya". */
  name: string;
  /** Bare name for line keys and file names. */
  short: string;
  /** Visible traits, three words. The numbers stay hidden. */
  traits: string;
  doctrine: Doctrine;
  /** Gemini TTS voice name for the pre-rendered lines. */
  voice: string;
}

// ---------------------------------------------------------------------------
// Measurements: what Jev says one order means

export const OBJECTIVES = [
  "evacuate",
  "rescue",
  "repair",
  "restore_power",
  "contain",
  "conserve",
  "treat",
  "defend",
  "investigate",
  "fortify",
  "withdraw",
  "transport",
  "negotiate",
  "abandon",
  "other",
] as const;
export type Objective = (typeof OBJECTIVES)[number];

export const TIMEFRAMES = ["immediate", "today", "coming_days", "unstated"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const SCOPE_NOULS = ["concerns_security", "concerns_logistics", "concerns_medical", "concerns_engineering"] as const;

export const PRIORITY_NOULS = [
  "priority_people",
  "priority_wounded",
  "priority_infrastructure",
  "priority_power",
  "priority_water",
  "priority_food",
  "priority_medicine",
  "priority_fuel",
  "priority_speed",
  "priority_crew_safety",
  "priority_security",
] as const;
export type PriorityNoul = (typeof PRIORITY_NOULS)[number];

export const CONSTRAINT_NOULS = [
  "deadline_present",
  "resource_cap_present",
  "fallback_present",
  "preserve_reserve",
  "avoid_casualties",
  "avoid_combat",
  "permission_to_use_force",
  "permission_to_use_reserve",
  "permission_to_sacrifice_equipment",
  "do_not_abandon_equipment",
  "requires_confirmation",
  "maintain_position",
] as const;
export type ConstraintNoul = (typeof CONSTRAINT_NOULS)[number];

export const COMMUNICATION_NOULS = [
  "contradictory",
  "underspecified",
  "conflicts_with_recent_order",
  "assigns_clear_owner",
  "gives_clear_priority",
  "contains_conditional",
  "contains_exception",
  "allows_discretion",
  "absolute_language",
  "is_standing_order",
  "revokes_standing_orders",
  "is_question",
  "addresses_system",
] as const;
export type CommunicationNoul = (typeof COMMUNICATION_NOULS)[number];

export const NOUL_IDS = [...SCOPE_NOULS, ...PRIORITY_NOULS, ...CONSTRAINT_NOULS, ...COMMUNICATION_NOULS] as const;
export type NoulId = (typeof NOUL_IDS)[number];

export const SCORE_IDS = ["urgency", "risk_tolerance", "resource_flexibility", "specificity", "clarity", "delegated_discretion"] as const;
export type ScoreId = (typeof SCORE_IDS)[number];
/** Every Score runs 0..3. */
export const SCORE_MAX = 3;

export interface ChoiceMeasure<T extends string = string> {
  choice: T;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface ScoreMeasure {
  /** Expected level, 0..SCORE_MAX. */
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
}

/** Per active standing order, in the order they were sent. */
export interface StandingOrderMeasure {
  conflict: number;
  override: number;
}

export interface Measurements {
  objective: ChoiceMeasure<Objective>;
  sector: ChoiceMeasure<SectorId | "none">;
  timeframe: ChoiceMeasure<Timeframe>;
  nouls: Record<NoulId, number>;
  scores: Record<ScoreId, ScoreMeasure>;
  standing: StandingOrderMeasure[];
  /** Per pending clarification, in the order they were sent: does this order answer it. */
  answers: number[];
}

// ---------------------------------------------------------------------------
// World

export type WeatherKind = "clear" | "cold" | "storm";

export interface Weather {
  kind: WeatherKind;
  tempC: number;
}

export interface SectorState {
  /** 0 none .. 1 fully ablaze. */
  fire: number;
  /** 0 intact .. 1 destroyed. */
  damage: number;
  heated: boolean;
  /** Colonists physically in the sector. */
  people: number;
}

export interface Crew {
  size: number;
  /** 0 fresh .. 1 spent. Spent crews work at half effect and get hurt. */
  fatigue: number;
  injured: number;
  dead: number;
}

export interface People {
  /** Living colonists inside the colony, including patients and the trapped. */
  total: number;
  /** Colonists who need a bed and medicine: injured plus critical. */
  injured: number;
  critical: number;
  /** Colonists under rubble or behind a sealed door in `habitat`. */
  trapped: number;
  evacuated: number;
  dead: number;
}

export interface World {
  day: number;
  weather: Weather;
  power: {
    /** Generator output as a fraction of the colony's nominal demand. */
    output: number;
    /** Emergency battery reserve 0..1; a night of full colony load costs about 0.5. */
    reserve: number;
    generatorHealth: number;
    /** Non-essential load shed: fewer lit corridors, workshop down, morale cost, less demand. */
    shedding: boolean;
    /** Whether the battery may cover a night's deficit. Engineering sets it; Orlov defaults to hold. */
    reservePolicy: "hold" | "bridge";
    /** A sector that is never cut when power runs short. */
    priority: SectorId | null;
    /** Days the generator stays isolated after a fire: output capped while it lasts. */
    isolated: number;
  };
  water: {
    /** Days of stored water at current draw. */
    days: number;
    pumpHealth: number;
    /** Pumps run on grid power when there is enough, else on fuel if fuelled, else not at all. */
    pumpsFuelled: boolean;
    pipesFrozen: boolean;
    contaminated: boolean;
  };
  food: {
    days: number;
    ration: "full" | "reduced" | "minimal";
  };
  medicine: {
    /** Stock 0..1 of the infirmary's full shelves. */
    stock: number;
    /** Treat everyone or only the critical. */
    policy: "full" | "critical_only";
    /** Moved out of the infirmary's reach of fire. */
    safe: boolean;
    /** Where the patients are: the infirmary, or the core after being moved. */
    ward: "infirmary" | "core";
  };
  fuel: {
    units: number;
    /** Moved out of the depot's reach of fire. */
    safe: boolean;
    /** Ten units held back for the pumps tonight. */
    reservedForPumps: boolean;
    /** Who drinks first when the night's fuel runs short. */
    priority: "generator" | "pumps";
  };
  vehicles: {
    operational: number;
    total: number;
    /** Trucks kept in the bay on Chen's word. */
    held: boolean;
  };
  shelter: {
    /** Habitat structural integrity 0..1. */
    integrity: number;
  };
  security: {
    /** Gate and fence 0..1. */
    perimeter: number;
    /** Pressure from outside 0..1. */
    threat: number;
    /** What the movement outside is, once someone has looked. */
    contact: "unknown" | "none" | "refugees" | "raiders" | "relief";
    /** Refugees admitted so far. */
    admitted: number;
    /** Security stood a guard at the gate today. */
    guarded: boolean;
    /** The day the relief column reaches the pass, once contacted. */
    reliefDay: number | null;
    /** Security fired on the relief scouts; no column will come. */
    reliefLost: boolean;
  };
  morale: number;
  people: People;
  sectors: Record<SectorId, SectorState>;
  crews: Record<Department, Crew>;
  crises: ActiveCrisis[];
  /** The relief column reached the pass, or the road out is open: the evacuation ending is available. */
  roadOpen: boolean;
  /** Consecutive days morale has sat below the mutiny line. */
  lowMoraleDays: number;
  /** What today's actions did that the night must know about. Reset every morning. */
  tonight: Tonight;
}

/** Effects of the day's actions that the night tick reads. */
export interface Tonight {
  /** Security escorted the movement of people. */
  escort: boolean;
  /** Fire fought in a sector this day, fraction 0..1. */
  fireFought: Partial<Record<SectorId, number>>;
  /** Extra treatment effort: 0 none, 1 full triage. */
  treatment: number;
  /** Medics prepared the cold response. */
  coldResponse: boolean;
  /** Medics attended the rescue site. */
  fieldTeam: boolean;
  /** Habitat shored by engineering, fraction. */
  shored: number;
  /** Quarantine in force. */
  quarantine: boolean;
  /** Generator run above rating for heat. */
  overrun: boolean;
  /** Crews that worked hard today. */
  worked: Partial<Record<Department, number>>;
  /** Crew hours already committed to actions today, per department. */
  crewHoursUsed: Partial<Record<Department, number>>;
}

export interface ActiveCrisis {
  id: string;
  template: string;
  sector: SectorId;
  /** 0..1, grows if unattended. */
  severity: number;
  dayStarted: number;
  /** Days it has been left alone. */
  neglect: number;
}

// ---------------------------------------------------------------------------
// Actions

export type ResourceKey = "fuel" | "vehicles" | "crewHours" | "power" | "medicine" | "water";

export interface ResourceRequest {
  key: ResourceKey;
  amount: number;
  /** Which department's crew hours, when key is crewHours. */
  department?: Department;
}

export interface ActionSpec {
  id: string;
  department: Department;
  /** Uppercase label as the officer strip shows it: "ESCORT EVACUATION". */
  label: string;
  /** Which objectives this action serves, 0..1 each. */
  objectives: Partial<Record<Objective, number>>;
  /** Which priorities it serves, -1..1 each (negative: it works against that priority). */
  priorities: Partial<Record<PriorityNoul, number>>;
  /** Which constraints it honours (+) or violates (-), -1..1. */
  constraints?: Partial<Record<ConstraintNoul, number>>;
  /** Sectors where it makes sense; empty means anywhere. */
  sectors?: SectorId[];
  /** 0 safe .. 1 someone will probably get hurt. */
  risk: number;
  /** How fast it pays off; higher is better under urgency. */
  speed: number;
  /** Base plausibility as an unordered response to a crisis in the department's domain, 0..1. */
  initiativeBase: number;
  /** True for the routine and for request_clarification: never chosen by initiative alone. */
  passive?: boolean;
}

/** What an action asks for from the shared pool this day. */
export interface Allocation {
  requests: ResourceRequest[];
  /** Fraction of each request granted, keyed by resource. */
  granted: Partial<Record<ResourceKey, number>>;
  /** Overall fraction of the action carried out, min over granted. */
  fraction: number;
}

// ---------------------------------------------------------------------------
// Orders, memory, trust

export interface StandingOrder {
  id: string;
  issuedDay: number;
  text: string;
  measurements: Measurements;
  scope: Department[];
  authority: number;
  supersededBy: string | null;
  supersededDay: number | null;
}

export interface OrderRecord {
  id: string;
  day: number;
  text: string;
  measurements: Measurements;
  scope: Department[];
  standingOrderId: string | null;
  /** Ids of pending clarifications this order answered. */
  answered: string[];
}

export interface PendingClarification {
  id: string;
  department: Department;
  day: number;
  /** Which authored question was asked. */
  reason: ClarifyReason;
  /** The order it was asked about. */
  orderId: string;
  answeredBy: string | null;
}

export type ClarifyReason = "resource_precedence" | "target" | "scope" | "standing_order" | "precedent" | "contradiction";

/** Decayed average of priority measurements per department: what the organisation has learned the commander wants. */
export type PrecedentMemory = Record<Department, Record<PriorityNoul, number>>;

// ---------------------------------------------------------------------------
// Resolution trace

export interface UtilityTerm {
  name: string;
  value: number;
  /** Short mechanics, e.g. "priority_wounded .91 × life 1.60 × serves .80". */
  note: string;
}

export interface Candidate {
  action: string;
  utility: number;
  terms: UtilityTerm[];
  feasible: boolean;
  infeasibleReason?: string;
}

export interface Decision {
  department: Department;
  day: number;
  /** Orders this officer considered addressed to them this day. */
  orders: string[];
  action: string;
  /** Why the officer acted at all: an order, initiative on a crisis, or routine. */
  basis: "order" | "initiative" | "routine" | "clarification";
  candidates: Candidate[];
  clarify?: { reason: ClarifyReason; pendingId: string };
  /** Speech act and line selected for the acknowledgement or report. */
  allocation?: Allocation;
  effects: Effect[];
}

export interface Effect {
  /** Dotted path into the world, e.g. "people.evacuated". */
  path: string;
  from: number | string | boolean;
  to: number | string | boolean;
  /** Who or what caused it: an action id, a crisis id, "night", "weather". */
  cause: string;
  /** One sentence in the game's own words. */
  note: string;
}

export interface Allocations {
  /** Requests per action per resource with the granted fraction. */
  rows: { department: Department; action: string; key: ResourceKey; requested: number; granted: number; available: number }[];
  /** Which orders' priorities decided precedence, or "initiative". */
  ruledBy: string;
}

// ---------------------------------------------------------------------------
// Speech

export type SpeechAct =
  | "acknowledge"
  | "clarify"
  | "object"
  | "warn"
  | "confirm_priority"
  | "report_success"
  | "report_partial"
  | "report_failure"
  | "report_unexpected"
  | "challenge_precedent"
  | "request_exception"
  | "routine";

export interface Utterance {
  department: Department;
  day: number;
  act: SpeechAct;
  /** Authored line id, for voice and tests. */
  lineId: string;
  text: string;
  /** Specifics rendered by code under the line. */
  notes: string[];
  /** The order it responds to, if any. */
  orderId: string | null;
}

// ---------------------------------------------------------------------------
// Events and game state

export type Mode = "analyst" | "commander" | "iron";

export type GameEvent =
  | { kind: "start"; seed: string; scenario: string; mode: Mode; version: string }
  | { kind: "order"; day: number; text: string; measurements: Measurements }
  | { kind: "end_day"; day: number };

export interface DayReport {
  day: number;
  decisions: Decision[];
  allocations: Allocations;
  /** World effects from the night tick, after actions. */
  night: Effect[];
  /** Crises that appeared this night. */
  newCrises: ActiveCrisis[];
  /** Crises resolved this day. */
  resolved: string[];
  utterances: Utterance[];
  /** The world after the day. */
  world: World;
  /** Trust after the day. */
  trust: Record<Department, number>;
}

export type EndingId =
  | "colony_survives"
  | "pyrrhic_survival"
  | "evacuation"
  | "infrastructure_collapse"
  | "mutiny"
  | "abandonment"
  | "total_loss";

export interface Ending {
  id: EndingId;
  title: string;
  /** The sentence under the title, chosen from state. */
  summary: string;
  /** The numbers the ending was chosen from. */
  scores: { population: number; infrastructure: number; resources: number; morale: number; confidence: number };
}

export interface GameState {
  version: string;
  seed: string;
  scenario: string;
  mode: Mode;
  day: number;
  /** Orders issued today, not yet executed. */
  today: OrderRecord[];
  /** Acknowledgements for today's orders. */
  todayUtterances: Utterance[];
  ledger: OrderRecord[];
  standing: StandingOrder[];
  pending: PendingClarification[];
  precedent: PrecedentMemory;
  trust: Record<Department, number>;
  world: World;
  reports: DayReport[];
  ending: Ending | null;
  /** Every event, in order: the save and replay format. */
  events: GameEvent[];
}
