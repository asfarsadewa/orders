// Chief Orlov. Dry, slow, thinks in systems. The machines are his patients.

import { lines } from "./types";

const who = "engineering" as const;

export const ENGINEERING_LINES = [
  ...lines(who, "acknowledge", [
    "The generator hears you. I'll see what it can give.",
    "Understood. I'll put the crew on it.",
    "Right. That can be done.",
    "Received. I will do it the way that does the least damage.",
    "Yes, Commander. Give me the day.",
  ]),
  ...lines(who, "object", [
    "I'll do it. The system will remember it longer than you will.",
    "As ordered. Do not ask me to fix it afterward.",
    "Complying. I would have done it slower and kept the machine.",
    "It is your colony. I will bend the system to it.",
  ]),
  ...lines(who, "warn", [
    ["Run it hot tonight and it is scrap by spring.", ["overrun"]],
    ["If I spend the battery now, the next bad night is dark.", ["reserve"]],
    ["Every watt to the ward means no watt to the pumps. Say if that is meant.", ["divert"]],
    "A temporary sacrifice in my department has a way of becoming permanent.",
    ["The fire will take the hall or the crew. I would rather it took the hall.", ["fire"]],
  ]),
  ...lines(who, "confirm_priority", [
    "The pumps first. Good. That is a system I can plan around.",
    "A stated priority. I can balance the load to it.",
    "Understood. That answers the question I would have asked.",
  ]),
  ...lines(who, "report_success", [
    "Done. The system is holding.",
    "Finished. It will run, if nobody asks too much of it.",
    "Carried out. The numbers should look better in the morning.",
    "Done. My crew earned their bunks.",
    "Complete. The machine forgave us this time.",
  ]),
  ...lines(who, "report_partial", [
    "Part way. The crew ran out before the job did.",
    "Some of it. It will hold, barely.",
    "I got what I could out of it. Not all.",
    "Half done. Tomorrow finishes it, if tomorrow lets us.",
  ]),
  ...lines(who, "report_failure", [
    "It could not be done. Not with the hall in that state.",
    "No. The system beat us today.",
    "Failed. I will tell you exactly where, if you want it.",
    "It did not hold. Nothing I could do about it from here.",
  ]),
  ...lines(who, "report_unexpected", [
    "Something in the system did not behave. Read it.",
    "The numbers moved in a direction I did not expect.",
    "There is a consequence you should see before you order again.",
  ]),
  ...lines(who, "challenge_precedent", [
    "That runs against a standing order. I am keeping to the standing order.",
    "Yesterday it was the pumps before anything. I am holding to that.",
    "This contradicts an earlier order. Older rule wins with me unless you say otherwise.",
  ]),
  ...lines(who, "request_exception", [
    "Let me keep ten percent on the battery whatever else you spend.",
    "I want leave to shed the workshop load tonight. It costs nothing that matters.",
  ]),
  ...lines(who, "routine", [
    "Maintenance rounds. Nothing new broke.",
    "No orders for the crew, so we kept the machines alive.",
    "Systems as they were. Which is not saying much.",
  ]),
];
