// The four officers. Personality is these numbers and nothing else; the words
// under `traits` are what the player is shown, the numbers are what they learn.

import type { Department, Doctrine, OfficerSpec } from "../engine/types";

const base: Doctrine = {
  literalness: 0.6,
  initiative: 0.6,
  riskAversion: 0.5,
  obedience: 0.75,
  precedentWeight: 0.6,
  urgencyResponse: 1,
  resourceCaution: 1,
  lifePriority: 1,
  infrastructureWeight: 1,
};

export const OFFICERS: Record<Department, OfficerSpec> = {
  security: {
    id: "security",
    name: "Captain Ilya",
    short: "ilya",
    traits: "Fast. Aggressive. High initiative.",
    doctrine: { ...base, literalness: 0.45, initiative: 0.9, riskAversion: 0.25, obedience: 0.75, precedentWeight: 0.3, urgencyResponse: 1.4 },
    voice: "Fenrir",
  },
  logistics: {
    id: "logistics",
    name: "Chen",
    short: "chen",
    traits: "Cautious. Literal. Protective of reserves.",
    doctrine: { ...base, literalness: 0.92, initiative: 0.45, riskAversion: 0.85, obedience: 0.9, precedentWeight: 0.7, resourceCaution: 1.45 },
    voice: "Kore",
  },
  medical: {
    id: "medical",
    name: "Dr Vale",
    short: "vale",
    traits: "Human life first. Acts without waiting.",
    doctrine: { ...base, literalness: 0.65, initiative: 0.7, riskAversion: 0.55, obedience: 0.65, precedentWeight: 0.65, lifePriority: 1.6 },
    voice: "Leda",
  },
  engineering: {
    id: "engineering",
    name: "Chief Orlov",
    short: "orlov",
    traits: "Systems thinker. Protects infrastructure. Follows standing orders.",
    doctrine: { ...base, literalness: 0.7, initiative: 0.6, riskAversion: 0.6, obedience: 0.8, precedentWeight: 0.8, infrastructureWeight: 1.5 },
    voice: "Charon",
  },
};

export const OFFICER_LIST: readonly OfficerSpec[] = [OFFICERS.security, OFFICERS.logistics, OFFICERS.medical, OFFICERS.engineering];

export const DEPARTMENT_LABEL: Record<Department, string> = {
  security: "Security",
  logistics: "Logistics",
  medical: "Medical",
  engineering: "Engineering",
};

/** How the player addresses the colony's senior authority, and how officers address them. */
export const COMMANDER = "Commander";
