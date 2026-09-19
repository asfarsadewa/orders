// The questions officers ask when they will not guess. One per officer per
// reason. The judge sees the question text, so an answer can be measured
// against it, and the player reads exactly what was asked.

import type { Department } from "../../engine/types";
import type { ClarifyQuestions } from "./types";

export const CLARIFY_QUESTION: Record<Department, ClarifyQuestions> = {
  security: {
    resource_precedence: "Which comes first, Commander: the gate, or the people on the move? I can hold one.",
    target: "Where do you want the squad? Name the sector and we move.",
    scope: "Is that mine, Commander, or is it Chen's? I will not have two crews on one job.",
    standing_order: "That cuts across a standing order. Say the word and I set it aside.",
    precedent: "You told us the people came first. Does that still hold tonight?",
    contradiction: "That order asks for two things that cannot both happen. Which one do you want?",
  },
  logistics: {
    resource_precedence: "I need a priority: fuel for the pumps tonight, or fuel for the trucks?",
    target: "Which sector am I moving people or stock from? I will not send trucks on a guess.",
    scope: "Is that for my crew, or for engineering? Tell me who owns it and I will start.",
    standing_order: "That would break a standing order. I need you to lift it, in writing.",
    precedent: "Earlier orders said keep the reserve. Am I spending it now, or not?",
    contradiction: "I can do one half of that or the other. Which half?",
  },
  medical: {
    resource_precedence: "Treat everyone, or only the critical? I need it said plainly.",
    target: "Which ward, which sector? Tell me where the patients are that you mean.",
    scope: "Is that mine to do, or are you asking security to carry them? I will not send medics blind.",
    standing_order: "That goes against a standing order about the medicine. Are you lifting it?",
    precedent: "You told me lives came first. Do you still mean that, or has that changed?",
    contradiction: "I cannot move the patients and keep them where they are. Which is it?",
  },
  engineering: {
    resource_precedence: "Power to the ward, or power to the pumps? I cannot give both tonight.",
    target: "Which system, Commander? Generator, pumps, pipes, or the roof. Pick one.",
    scope: "Is my crew doing this, or logistics? I need to know before I pull anyone off the generator.",
    standing_order: "That runs against a standing order. I will do it if you say so plainly.",
    precedent: "Yesterday it was the pumps before anything. Is that still the rule?",
    contradiction: "I cannot keep the reserve and spend it. Tell me which.",
  },
};
