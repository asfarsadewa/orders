// The confidence gates. A measurement only counts once it crosses the
// threshold here; below it, the engine behaves as if the order said nothing on
// the matter. These are engine constants, not personality, and they are the
// numbers `npm run calibrate` tests the corpus against. Change them only when
// the calibration report says the question, not the wording, is at fault.

export const THRESHOLDS = {
  /** An officer hears an order when their department's scope Noul crosses this. */
  scope: 0.5,
  /** A priority or constraint Noul counts as stated. */
  priority: 0.55,
  constraint: 0.6,
  /** Communication flags. */
  contradictory: 0.55,
  underspecified: 0.6,
  conflictsWithRecent: 0.6,
  allowsDiscretion: 0.6,
  absolute: 0.6,
  isStandingOrder: 0.6,
  revokesStanding: 0.6,
  isQuestion: 0.6,
  addressesSystem: 0.65,
  /** Per standing order. */
  standingConflict: 0.55,
  standingOverride: 0.6,
  /** Per pending clarification. */
  answers: 0.6,
  /** Scores, 0..3. */
  urgentScore: 2.0,
  lowClarity: 1.5,
  highDiscretion: 2.0,
} as const;

export type ThresholdKey = keyof typeof THRESHOLDS;

/** The gate for a Noul id, by family. */
export function noulThreshold(id: string): number {
  if (id.startsWith("concerns_")) return THRESHOLDS.scope;
  if (id.startsWith("priority_")) return THRESHOLDS.priority;
  switch (id) {
    case "contradictory":
      return THRESHOLDS.contradictory;
    case "underspecified":
      return THRESHOLDS.underspecified;
    case "conflicts_with_recent_order":
      return THRESHOLDS.conflictsWithRecent;
    case "allows_discretion":
      return THRESHOLDS.allowsDiscretion;
    case "absolute_language":
      return THRESHOLDS.absolute;
    case "is_standing_order":
      return THRESHOLDS.isStandingOrder;
    case "revokes_standing_orders":
      return THRESHOLDS.revokesStanding;
    case "is_question":
      return THRESHOLDS.isQuestion;
    case "addresses_system":
      return THRESHOLDS.addressesSystem;
    default:
      return THRESHOLDS.constraint;
  }
}
