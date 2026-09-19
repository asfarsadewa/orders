// Dr Vale. Warm, direct, and always counting patients.

import { lines } from "./types";

const who = "medical" as const;

export const MEDICAL_LINES = [
  ...lines(who, "acknowledge", [
    "I'll have the ward ready.",
    "Understood. My people are moving.",
    "Yes, Commander. Thank you.",
    "That is what I would have done. Going.",
    "Received. I read it the way you meant it.",
  ]),
  ...lines(who, "object", [
    "I will do it. I want you to know who it costs.",
    "As ordered. I will be in the ward if you need me.",
    "I do not agree, and I will comply. Both are true.",
    "Fine. I will treat who I am allowed to treat.",
  ]),
  ...lines(who, "warn", [
    ["If I treat everyone now, there is nothing left in a week.", ["medicine"]],
    "There are people who will not survive that. I need you to know that first.",
    ["You are asking me to choose who waits. I will, but say it.", ["medicine"]],
    ["Medics in a burning building are patients in ten minutes.", ["field"]],
  ]),
  ...lines(who, "confirm_priority", [
    "The wounded first. Good. I will hold you to it.",
    "A clear line. Thank you. It makes the next hour easier.",
    "Priority understood. I can triage to it.",
  ]),
  ...lines(who, "report_success", [
    "Done. Everyone I reached is stable.",
    "The ward is quiet. That is the best news I have.",
    "Finished. Nobody died who did not have to.",
    "Carried out. Some of them will walk tomorrow.",
    "Done. My people are tired and nobody was lost.",
  ]),
  ...lines(who, "report_partial", [
    "I reached some of them. Not all.",
    "Part of it. The ward is fuller than it should be.",
    "We did what we could with the stock we had.",
    "Half. I am not going to dress it up.",
  ]),
  ...lines(who, "report_failure", [
    "I could not do it. I need you to look at the ward and see why.",
    "Not done. There was no power, no heat, or no medicine, take your pick.",
    "It failed. People are paying for it tonight.",
    "I could not reach them. I am sorry.",
  ]),
  ...lines(who, "report_unexpected", [
    "Something I did not plan for. Read it before you sleep.",
    "There is a case in the ward that changes things.",
    "It went differently than either of us expected.",
  ]),
  ...lines(who, "challenge_precedent", [
    "You told me lives came first. I am holding to that until you tell me otherwise.",
    "This cuts across a standing order about the medicine. I would rather hear you lift it.",
    "That is not what you said before. I am going with what you said before.",
  ]),
  ...lines(who, "request_exception", [
    "Let me treat the children regardless. Just the children.",
    "I want leave to use the reserve for the critical. Only them.",
  ]),
  ...lines(who, "routine", [
    "Rounds done. The ward is as it was.",
    "No orders for me, so I treated who was in front of me.",
    "Quiet ward. That will not last.",
  ]),
];
