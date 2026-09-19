// Chen. Precise, literal, protective of every unit in the ledger.

import { lines } from "./types";

const who = "logistics" as const;

export const LOGISTICS_LINES = [
  ...lines(who, "acknowledge", [
    "Noted. I will do exactly that.",
    "Understood, Commander. The ledger is updated.",
    "Received. I will follow it as written.",
    "Yes. That is clear enough to act on.",
    "Acknowledged. I have it in writing now.",
  ]),
  ...lines(who, "object", [
    "I will comply. I want it noted that this spends what we cannot replace.",
    "As ordered. The reserve will not thank you.",
    "Done as written. I would have held something back.",
    "Complying. Please read the fuel line tomorrow.",
  ]),
  ...lines(who, "warn", [
    "If I take all of it, there is no all of it tomorrow.",
    ["That leaves nothing for the pumps tonight. Say so if that is intended.", ["fuel", "reserve"]],
    ["Every trip is fuel we do not get back. I will count them for you.", ["fuel", "trucks"]],
    ["Whatever it takes, in my department, means the last drum.", ["fuel"]],
    ["Feed people from the reserve and the reserve is gone by the week's end.", ["food", "reserve"]],
  ]),
  ...lines(who, "confirm_priority", [
    "Pumps before trucks. Understood. That is all I needed.",
    "A stated priority. Thank you. I can allocate now.",
    "Clear precedence. I will hold to it until you change it.",
  ]),
  ...lines(who, "report_success", [
    "Done, as written. The numbers are in the ledger.",
    "Complete. Every trip accounted for.",
    "Carried out in full. Nothing wasted.",
    "Finished. I kept to the limit you set.",
    "Done. Stock and trucks as reported.",
  ]),
  ...lines(who, "report_partial", [
    "Partly done. We ran short of what it needed.",
    "I did what the pool allowed. It was not the whole order.",
    "Half of it. The rest waits on fuel or trucks.",
    "As much as the stock would bear. No more.",
  ]),
  ...lines(who, "report_failure", [
    "It could not be done with what we have. I did not pretend otherwise.",
    "Not done. The trucks or the fuel were not there.",
    "I held. There was nothing to send.",
    "Failed for want of stock. The ledger shows why.",
  ]),
  ...lines(who, "report_unexpected", [
    "Something changed on the road. Read the report before you order again.",
    "The count does not match what I expected. You should see this.",
    "There is a line in the ledger I did not plan for.",
  ]),
  ...lines(who, "challenge_precedent", [
    "That contradicts a standing order. I am following the standing order until you lift it.",
    "Earlier you said keep the reserve. I am keeping it unless you say otherwise.",
    "This reverses what you told me. I will need it plainly before I spend.",
  ]),
  ...lines(who, "request_exception", [
    "I would like leave to hold ten units back for the pumps regardless.",
    "May I keep one truck in the bay? I will not ask twice.",
  ]),
  ...lines(who, "routine", [
    "Rations out. Stores counted.",
    "No orders for my crew. We distributed and counted.",
    "Ledger balanced. Nothing moved that did not need to.",
  ]),
];
