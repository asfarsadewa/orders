// Captain Ilya. Clipped, fast, certain. Speaks like someone already moving.

import { lines } from "./types";

const who = "security" as const;

export const SECURITY_LINES = [
  ...lines(who, "acknowledge", [
    "Understood. Moving.",
    "Copy that, Commander. The squad is on it.",
    "Good. I was waiting for that.",
    "Received. We go now.",
    "Clear enough for me. Moving out.",
  ]),
  ...lines(who, "object", [
    "I'll do it. For the record, I would not.",
    "That ties my hands, Commander. Noted, and complied with.",
    "Understood. If it goes wrong, remember I said so.",
    "That is not how I would run it. But it is your call.",
  ]),
  ...lines(who, "warn", [
    "You said whatever it takes. I will take you at your word.",
    "Commander, that will cost people. Say it again if you mean it.",
    "At any cost is a big phrase. I intend to use all of it.",
    ["If I go out there armed, I am not coming back quiet.", ["force"]],
  ]),
  ...lines(who, "confirm_priority", [
    "People first, then the gate. Understood.",
    "Priority noted. Nothing else gets in the way of it.",
    "Good. A clear priority is all I ever ask for.",
  ]),
  ...lines(who, "report_success", [
    "Done. Squad's back inside, everyone accounted for.",
    "Job done, Commander. No losses.",
    "We got it done. The rest is your problem now.",
    "Finished before dark. Told you we would.",
    "Handled. Next.",
  ]),
  ...lines(who, "report_partial", [
    "Got most of it. Ran out of daylight before we ran out of work.",
    "Half done. We needed more hands than we had.",
    "Part of it. The rest is still out there.",
    "Made a start. Give me tomorrow and I'll finish it.",
  ]),
  ...lines(who, "report_failure", [
    "Could not do it. Not with what we had.",
    "No good. We were stopped cold.",
    "It did not happen, Commander. I take that.",
    "Failed. I want it on the record why.",
  ]),
  ...lines(who, "report_unexpected", [
    "Commander, it was not what we thought out there.",
    "Something happened you need to hear about.",
    "We found out the hard way. Read the report.",
  ]),
  ...lines(who, "challenge_precedent", [
    "This goes against what you told us before. I'll follow today's order.",
    "You said one thing yesterday and another today. Today wins with me.",
    "That breaks a standing order. Fine. Standing orders are for quiet days.",
  ]),
  ...lines(who, "request_exception", [
    "Give me leave to go past the road if they run. Otherwise I lose them.",
    "I want permission to use force if it comes to that. Yes or no.",
  ]),
  ...lines(who, "routine", [
    "Perimeter quiet. Patrols out.",
    "Nothing from you, so we walked the fence.",
    "Squad on the gate. Nothing moved.",
  ]),
];
