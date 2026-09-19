# ORDERS

> **A command game where the enemy is what people think you meant.**

## 1. Premise

**ORDERS** is a single-player command simulation in which the player leads a failing expedition, colony, military outpost, ship, or other constrained organisation under pressure.

The player does not issue commands through menus such as:

- `RETREAT`
- `FORTIFY`
- `RESCUE`
- `DIVERT_POWER`

Instead, the player writes natural-language orders:

> Get everyone across the river before nightfall. Save the wounded first. Leave the wagons if they slow you down, but do not abandon the medicine.

A calibrated semantic model, **TypeSafe Jev**, measures what that order means. Jev does not generate a plan, dialogue, or outcome. It produces a structured semantic interpretation.

The game engine then applies that interpretation through:

- officer doctrine,
- personality,
- standing orders,
- institutional precedent,
- available resources,
- physical constraints,
- uncertainty,
- and deterministic simulation rules.

The result is not a game about prompting an AI.

It is a game about **commanding people who interpret language differently**.

---

# 2. Design Thesis

The core thesis is:

> **The model understands. The game decides.**

Jev is not the game master.

Jev is not the storyteller.

Jev is not an NPC.

Jev is a semantic instrument that converts free-form human language into typed, probabilistic measurements.

The simulation remains authoritative.

```text
PLAYER ORDER
     │
     ▼
    JEV
     │
     ▼
SEMANTIC MEASUREMENTS
     │
     ├───────────────┬───────────────┬───────────────┐
     ▼               ▼               ▼               ▼
 ENGINEERING       SECURITY        MEDICAL        LOGISTICS
 doctrine          doctrine        doctrine        doctrine
 personality       personality     personality     personality
 precedent         precedent       precedent       precedent
     │               │               │               │
     └───────────────┴───────────────┴───────────────┘
                         │
                         ▼
                 DETERMINISTIC ACTIONS
                         │
                         ▼
                   WORLD SIMULATION
```

The player should be able to ask after every outcome:

> Why did they do that?

And the game should always have an answer.

---

# 3. What ORDERS Must Prove

Human Compiler demonstrated:

```text
Jev → semantic measurements → deterministic rules
```

Werewolf demonstrated:

```text
Jev → measurements → beliefs → autonomous agents
```

ORDERS should demonstrate:

```text
Jev → intent interpretation → divergent human execution → physical simulation
```

The central research/game-design question is:

> **Can unrestricted natural-language instructions become reliable game controls without surrendering authority to a generative model?**

## 3.1 Construction Philosophy — Retire Uncertainty, Not Scope

This document describes the **intended full game**, not an MVP or an artificially constrained v1.

ORDERS should not reduce its ambition merely to make an early version easier to finish. The project already has a clear destination:

- four distinct officers,
- a proper colony simulation,
- simultaneous orders,
- standing orders,
- institutional precedent,
- resource contention,
- cascading consequences,
- authored character presentation,
- explainability,
- deterministic replay,
- calibration tooling,
- audio and visual identity,
- and a meaningful full-run structure.

The constraint is **construction order**, not final scope.

We should retire technical uncertainty in dependency order:

```text
semantic interpretation
        ↓
officer divergence
        ↓
action resolution
        ↓
world simulation
        ↓
standing orders + precedent
        ↓
content scale
        ↓
presentation + replay + reports
```

A one-off sandbox, one-officer scenario, or reduced simulation is therefore a **test harness**, not the product definition.

Once a risky layer is trustworthy, continue immediately toward the full intended game.

The working rule:

> **Do not budget ambition. Budget uncertainty.**

---

# 4. Game Fantasy

The player is the senior authority of an isolated operation under increasing pressure.

Possible skins:

1. **Frontier colony after a systems collapse**
2. **Military expedition trapped behind enemy lines**
3. **Arctic research base during cascading failures**
4. **Generation ship with failing infrastructure**
5. **Besieged medieval fortress**
6. **Disaster-response command centre**

The canonical setting for ORDERS is the one with the clearest systemic language:

## Canonical setting: Failing frontier colony

Why:

- power, food, medicine, security, water, shelter, and population are immediately understandable;
- departments naturally map to officers;
- consequences can cascade;
- orders can conflict across departments;
- no procedural combat system is required;
- the fiction supports difficult trade-offs without requiring huge content volume.

Working title can remain **ORDERS** regardless of skin.

---

# 5. Core Player Fantasy

The player is not controlling units.

The player is **commanding through language**.

Their actual skill becomes:

- understanding the officers,
- wording orders carefully,
- knowing when precision matters,
- knowing when flexibility matters,
- managing contradictions,
- maintaining doctrine,
- deciding who gets discretion,
- and learning how different people interpret the same sentence.

The ideal player thought is:

> “I know exactly why Chen did that. I should have said medicine outranks fuel.”

The game should rarely feel like:

> “The AI misunderstood me randomly.”

---

# 6. Core Loop

A run is divided into days or command cycles.

Each cycle:

1. **Situation**
   - world systems update,
   - crises emerge,
   - officers report state,
   - new constraints appear.

2. **Command**
   - player receives a limited number of orders,
   - player writes natural-language instructions.

3. **Interpretation**
   - Jev measures each order once,
   - semantic vector is stored permanently.

4. **Officer Resolution**
   - relevant officers interpret the same vector differently,
   - standing orders and precedent modify interpretation,
   - each officer selects an action.

5. **Execution**
   - deterministic systems resolve actions,
   - simultaneous actions may interfere.

6. **Consequences**
   - resources move,
   - people live or die,
   - infrastructure changes,
   - morale changes,
   - new crises are created.

7. **Debrief**
   - player sees what each officer thought the order meant,
   - optionally opens a full causal trace.

8. **Next Cycle**
   - previous orders become part of institutional memory.

---

# 7. Example Turn

## Situation

```text
DAY 6 — 17:20

POWER            41%
WATER            2.3 days
FOOD             6.1 days
MEDICAL          38%
MORALE           54%

SECTOR A         generator fire
SECTOR B         23 civilians trapped
SECTOR C         water pumps failing
SECTOR D         unknown movement outside perimeter
```

The player writes:

> Get Sector B evacuated before dark. Use whatever vehicles are available, but keep enough fuel for the water pumps tonight. Security should cover the evacuation instead of chasing whatever is outside.

Jev returns something conceptually like:

```text
objective:
  evacuate                    .92
  defend                      .04
  investigate                 .02
  other                       .02

priority_civilians             .96
protect_fuel_reserve           .84
deprioritise_external_threat   .88
security_supports_evacuate     .91

urgency                        2.7 / 3
risk_tolerance                 1.5 / 3
resource_flexibility           2.2 / 3

deadline_present               .95
fallback_present               .41
contradictory_order            .12
ambiguous_resource_priority    .36
```

The officers receive the same interpretation.

### Security — Captain Ilya

Doctrine:

```text
initiative        HIGH
aggression        HIGH
literalness       LOW
risk tolerance    HIGH
```

Decision:

```text
ESCORT EVACUATION
```

### Logistics — Chen

Doctrine:

```text
resource caution  HIGH
literalness       HIGH
initiative        MEDIUM
```

She sees:

```text
protect_fuel_reserve .84
use_available_vehicles
```

and reserves two vehicles instead of one.

Result:

- civilians evacuate more slowly,
- water pumps remain guaranteed,
- six civilians are still in Sector B at dark.

Nothing was generated.

The game mechanically derived the outcome.

---

# 8. The Jev Contract

Jev should be given a compact, exact state.

Never send the whole simulation.

Example state:

```ts
{
  order: string,
  current_crisis: [...],
  departments: [...],
  resources: {...},
  standing_orders: [...],
  recent_orders: [...],
  explicit_question?: string
}
```

One request should ask a large number of independent questions.

The exact question set can evolve through calibration.

---

# 9. Semantic Measurement Categories

## 9.1 Objective Choice

```text
evacuate
defend
repair
investigate
ration
transport
treat
fortify
abandon
negotiate
observe
other
```

Possibly multiple Choices if the command spans departments.

---

# 10. Priority Nouls

Examples:

```text
priority_people
priority_wounded
priority_children
priority_infrastructure
priority_supplies
priority_medicine
priority_power
priority_water
priority_speed
priority_safety
```

The important part is not creating hundreds of domain labels.

Use only predicates that have real mechanical consequences.

---

# 11. Constraint Nouls

Examples:

```text
deadline_present
resource_cap_present
fallback_present
preserve_reserve
avoid_casualties
avoid_combat
maintain_position
do_not_abandon_equipment
permission_to_sacrifice_equipment
permission_to_use_force
requires_confirmation
```

---

# 12. Communication Quality Nouls

These are particularly important because they affect interpretation rather than direct action.

```text
ambiguous
contradictory
underspecified
conflicts_with_standing_order
conflicts_with_recent_order
assigns_clear_owner
gives_clear_priority
contains_conditional
contains_exception
allows_discretion
```

---

# 13. Scores

Useful Score primitives:

```text
urgency              0..3
risk_tolerance       0..3
resource_flexibility 0..3
specificity          0..3
clarity              0..3
delegated_discretion 0..3
```

These are not direct action values.

They are modifiers used by officer policy.

---

# 14. Officer Model

Start with four officers.

Each officer has:

```ts
interface Officer {
  id: string
  department: Department
  doctrine: Doctrine
  thresholds: Thresholds
  standingOrders: StandingOrder[]
  trustInCommand: number
}
```

Avoid prose-heavy “AI personality prompts.”

Personality should primarily exist as numeric policy.

---

# 15. Core Officers

## 15.1 Captain Ilya — Security

Theme:

> Fast, aggressive, initiative-heavy.

```text
literalness        0.45
initiative         0.90
risk_aversion      0.25
obedience          0.75
precedent_weight   0.30
urgency_response   1.40
```

Behaviour:

- acts quickly on implied intent,
- interprets urgency aggressively,
- prefers decisive action,
- uses discretion readily,
- may overcommit.

Player lesson:

> Never tell Ilya “at any cost” unless you mean it.

---

## 15.2 Chen — Logistics

Theme:

> Precise, resource-protective, literal.

```text
literalness        0.92
initiative         0.45
risk_aversion      0.85
obedience          0.90
precedent_weight   0.70
resource_caution   1.45
```

Behaviour:

- respects explicit constraints,
- dislikes conflicting priorities,
- delays when resource precedence is unclear,
- preserves reserves aggressively.

Player lesson:

> Chen needs explicit ordering when two resources conflict.

---

## 15.3 Dr Vale — Medical

Theme:

> Human life first.

```text
literalness          0.65
initiative           0.70
risk_aversion        0.55
obedience            0.65
precedent_weight     0.65
life_priority        1.60
```

Behaviour:

- interprets ambiguous orders toward saving lives,
- resists abandoning wounded,
- may consume scarce supplies contrary to strategic needs.

Player lesson:

> If medicine must be conserved, tell Vale directly.

---

## 15.4 Chief Orlov — Engineering

Theme:

> Systems thinker.

```text
literalness            0.70
initiative             0.60
risk_aversion          0.60
obedience              0.80
precedent_weight       0.80
infrastructure_weight  1.50
```

Behaviour:

- values long-term infrastructure,
- interprets “temporary” sacrifices conservatively,
- follows standing doctrine strongly,
- may accept short-term human discomfort to protect core systems.

Player lesson:

> Orlov hears “keep the colony alive” as “keep the systems alive.”

---

# 16. Interpretation Divergence

This is the core mechanic.

Every relevant officer receives the same semantic measurements.

They do **not** receive a custom Jev interpretation.

Their differences come from code.

Example:

```text
order:
"Restore power to medical immediately.
Use emergency reserve if necessary."
```

Jev:

```text
restore_power            .97
priority_medical         .96
urgency                   2.9
permission_use_reserve   .78
preserve_reserve         .32
```

Ilya:

```text
not responsible
```

Vale:

```text
interprets reserve permission strongly
```

Orlov:

```text
interprets .78 through high infrastructure caution
```

Chen:

```text
checks existing standing reserve doctrine first
```

The game should never need:

```text
"What does Chen think?"
```

as another model call.

That is deterministic officer policy.

---

# 17. Standing Orders

A major mechanic.

The player may establish durable doctrine:

> No vehicle leaves the colony with less than half a tank.

> Civilian life takes priority over equipment.

> Nobody enters Sector D without Security clearance.

These become structured standing-order records.

Example:

```ts
{
  id: "SO-012",
  issuedDay: 3,
  semanticVector: {...},
  scope: ["logistics", "security"],
  authority: 1.0,
  supersededBy: null
}
```

Future commands are checked against relevant standing orders.

Jev can measure:

```text
conflicts_with_standing_order
supersedes_standing_order
creates_exception
temporarily_suspends_order
```

The game engine decides how officers resolve the conflict.

---

# 18. Precedent

This should become one of ORDERS' signature systems.

The player teaches the organisation how to interpret them.

Example:

Day 2:

> Protect civilians above everything else.

Day 6:

> Seal Sector B immediately. Do not divert personnel.

Jev:

```text
conflicts_with_prior_directive .86
```

Ilya:

```text
latest_order_priority = HIGH
→ seal now
```

Vale:

```text
precedent_weight = HIGH
civilian doctrine conflict
→ delays and requests evacuation
```

Orlov:

```text
literal order overrides broad precedent
→ seal now
```

One instruction produces three legitimate interpretations.

---

# 19. Order Memory

Do not keep all raw text forever in the Jev prompt.

Compile old orders into a small ledger.

```ts
interface OrderRecord {
  id: string
  day: number
  text: string
  semantic: OrderSemantic
  scope: Department[]
  persistent: boolean
  superseded: boolean
}
```

Only send Jev:

- relevant standing orders,
- recent commands,
- explicit precedents relevant to the current problem.

This keeps state bounded and interpretable.

---

# 20. Conflict Resolution

Officer action should be a deterministic utility function.

Conceptual form:

```text
utility(action) =
    objective_match
  + officer_doctrine
  + priority_match
  + precedent
  + standing_orders
  + resource_feasibility
  + urgency
  + initiative
  - risk
  - ambiguity_penalty
  - contradiction_penalty
```

No hidden generative planning.

Possible actions come from a finite action library.

---

# 21. Action Library

Each department has authored/system-defined actions.

Example Engineering:

```text
repair_generator
isolate_generator
divert_power
shed_nonessential_load
use_emergency_reserve
repair_water_pump
stabilise_structure
evacuate_engineering_team
do_nothing
request_clarification
```

Security:

```text
escort
hold_position
investigate
patrol
fortify
evacuate
engage
withdraw
split_force
request_clarification
```

The combination of semantic input + deterministic utility selects among them.

---

# 22. Clarification as a Real Action

Officers should sometimes refuse to guess.

If ambiguity is high and an officer's initiative is low:

```text
REQUEST_CLARIFICATION
```

This consumes time.

Potentially valuable mechanic:

> A vague order may not create the wrong action. It may create delay.

This is often more believable and strategically interesting.

Example:

```text
Chen:
"I need a priority: fuel reserve or transport capacity."
```

The line itself is authored.

Player can answer with a second order.

---

# 23. Physical Simulation

The world must be sufficiently real that interpretation matters.

Core systems:

```text
POWER
WATER
FOOD
MEDICINE
FUEL
SHELTER
SECURITY
MORALE
POPULATION
```

Potential secondary state:

```text
weather
time_of_day
road_condition
injuries
fire
contamination
equipment_damage
external_threat
```

Begin with a small simulation kernel only long enough to validate causality, then expand it toward the intended full colony model.

The final simulation should be broad enough for cross-system consequences, while still favouring understandable cascading effects over opaque complexity.

---

# 24. Resource Cascades

Example:

```text
Player:
"Get medical back online at any cost."
```

Execution:

```text
Engineering diverts reactor reserve
        ↓
medical power restored
        ↓
14 patients stabilised
        ↓
Sector C heating disabled
        ↓
pipes freeze overnight
        ↓
water capacity falls next day
```

The game never needs generated narration to make this compelling.

Consequences can be assembled from authored event fragments and system data.

---

# 25. Simultaneous Orders

One of the most interesting systems.

Player issues two orders:

```text
1. Security: evacuate Sector B.
2. Logistics: preserve fuel for water pumps.
```

Both independently make sense.

Together:

```text
evacuation requires vehicles
vehicles require fuel
```

The engine discovers the conflict through shared simulation resources.

This produces outcomes the player did not explicitly command.

That is desirable.

---

# 26. Interdepartmental Conflict

Officers can compete for resources.

Example:

```text
Engineering requests 30 fuel
Security requests 20 fuel
Available: 35
```

Order interpretation may include:

```text
priority_security
priority_infrastructure
```

Without explicit priority, officer initiative and doctrine determine allocation.

This should create the classic:

> “That isn't what I meant.”

And the game can explain exactly why it happened.

---

# 27. Explainability UI

Every action must support a detailed trace.

Example:

```text
CHEN / LOGISTICS

ORDER
"Get everyone across the river before nightfall.
Leave the wagons if they slow you down, but do not
abandon the medicine."

INTERPRETATION
evacuate                    .94
priority_people             .91
sacrifice_equipment         .72
protect_medicine            .96
urgency                     2.7
resource_flexibility        2.2

DOCTRINE
literalness                 .92
resource_caution            .85
precedent weight            .70

CONFLICT
vehicles require fuel
standing order SO-004:
"Maintain one night of pump fuel."

DECISION
RESERVE TWO TRUCKS
SEND THREE

CONSEQUENCE
6 civilians remained at dark.
Water reserve preserved.
```

This screen is ORDERS' equivalent of Werewolf's belief trace.

---

# 28. Main UI

Recommended layout:

```text
┌──────────────────────────────────────────────────────────┐
│ DAY 6   17:20        COLONY STATUS                       │
├──────────────────────────┬───────────────────────────────┤
│                          │ POWER   41%                   │
│        MAP / WORLD       │ WATER   2.3d                  │
│                          │ FOOD    6.1d                  │
│                          │ MED     38%                   │
│                          │ MORALE  54%                   │
├──────────────────────────┴───────────────────────────────┤
│ OFFICERS                                                 │
│ ILYA       CHEN        VALE        ORLOV                 │
│ action     action      action      action                │
├──────────────────────────────────────────────────────────┤
│ COMMAND HISTORY / REPORTS                                │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ > issue order...                                         │
└──────────────────────────────────────────────────────────┘
```

The text box is the primary control surface.

Menus should support inspection, not replace command language.

---

# 29. Player Feedback

Immediately after submitting an order, do **not** reveal the whole Jev vector by default.

Possible default:

```text
ORDER RECEIVED

Engineering     acknowledged
Security        acknowledged
Medical         —
Logistics       interpreting...
```

Then consequences occur.

The player can open an inspector afterward.

This preserves uncertainty during play while keeping complete explainability available.

---

# 30. Difficulty Modes

## Analyst

Full semantic vector visible immediately.

Useful for:

- development,
- TypeSafe demo,
- learning mechanics.

## Commander

Only officer interpretation summaries visible after execution.

## Iron Command

No semantic vector during the run.

Only authored officer responses and consequences.

Full trace unlocked in post-game replay.

---

# 31. Officer Dialogue

Same rule as Werewolf:

> **No runtime text generation.**

Use authored response libraries.

Categories:

```text
acknowledge
clarify
object
warn
confirm_priority
report_success
report_partial
report_failure
report_unexpected
```

Each officer has a distinct authored voice.

Jev may choose among appropriate authored candidates.

But the semantic decision and simulation state determine which category is available.

---

# 32. Optional Jev Candidate Selection

We can reuse the successful Werewolf pattern:

```text
policy decides speech act
        ↓
authored candidate lines
        ↓
Jev Choice
        ↓
best contextual line
```

Jev should not invent dialogue.

---

# 33. Deterministic Replay

Preserve the strongest Werewolf design.

A game is:

```text
seed
+
ordered stream of player orders
+
stored Jev measurements
```

Replaying those reproduces:

- officer decisions,
- resource outcomes,
- crises,
- report text,
- every number.

This enables:

- debugging,
- deterministic tests,
- post-game replay,
- balance analysis,
- sharing runs.

---

# 34. Replay View

The player should be able to scrub through the run.

At each order:

```text
ORDER
    ↓
JEV
    ↓
OFFICER INTERPRETATION
    ↓
ACTION
    ↓
WORLD DELTA
```

This turns the game into its own postmortem tool.

---

# 35. Calibration Harness

This is mandatory.

Before balancing officer personalities, test Jev's semantics.

Create a corpus of authored orders representing:

- clear commands,
- ambiguous commands,
- conflicting commands,
- priorities,
- conditions,
- exceptions,
- standing-order overrides,
- vague urgency,
- dangerous absolutes,
- resource conflicts.

Example:

```text
"Save everyone."
"Save as many as possible without risking the reactor."
"Do not lose the medicine."
"Leave the wagons, not the medicine."
"Use the reserve only if Sector B cannot otherwise be evacuated."
```

Run them through Jev and record distributions.

Do not tune thresholds around bad wording in the question set.

Improve the semantic questions first.

---

# 36. Calibration Metrics

Track:

```text
signal crossing rate
target/objective accuracy
clarity separation
ambiguity separation
contradiction detection
standing-order conflict detection
score stability
repeat-run stability
latency
token usage
```

Also maintain human-labelled expected measurements for a test corpus.

---

# 37. Semantic Regression Tests

Examples:

```text
"Take all the fuel."
```

should strongly imply:

```text
resource_flexibility = high
preserve_reserve = low
```

while:

```text
"Use fuel if required, but keep enough for one night of pumps."
```

should strongly imply:

```text
preserve_reserve = high
resource_constraint_present = high
```

Regression tests should protect the game against question wording changes.

---

# 38. Engine Tests

Engine tests must not call Jev.

Given fixed semantic measurements:

```text
Officer + doctrine + world + vector
→ deterministic action
```

Tests should cover:

- conflicting priorities,
- precedent,
- standing-order override,
- resource contention,
- officer divergence,
- clarification,
- simultaneous execution,
- failure cascades.

---

# 39. World Event System

Crises should be authored templates driven by state.

Example:

```ts
{
  id: "generator_fire",
  requires: state.power < 0.6,
  probabilityWeight: ...,
  effects: ...,
  choicesCreated: ...
}
```

The player should face different combinations across runs.

Avoid hand-authored linear story branches.

---

# 40. Run Structure

Initial full-game target:

```text
12–18 command cycles
4 core officers
2–3 orders per cycle
1 colony map with multiple operational sectors
8+ major resource systems
30+ crisis / complication templates
standing orders and precedent active throughout
```

Target:

```text
25–40 minutes per run
```

Longer than Werewolf.

Short enough to replay.

---

# 41. Win / Loss

Avoid one binary victory condition only.

End state should evaluate:

```text
population_alive
infrastructure_stability
resource_security
morale
mission_objective
officer_confidence
```

Possible endings:

```text
COLONY SURVIVES
PYRRHIC SURVIVAL
EVACUATION
INFRASTRUCTURE COLLAPSE
MUTINY
ABANDONMENT
TOTAL LOSS
```

Authored ending text can be selected from deterministic state.

---

# 42. Hidden Variables

Some officer traits should be visible.

Others can be learned.

Example visible:

```text
Chen — Logistics
"Cautious. Literal. Protective of reserves."
```

Hidden numeric weights remain unknown.

Players learn through behaviour.

This creates mastery without turning the game into a spreadsheet.

---

# 43. Trust and Command Legitimacy

This is part of the intended game, introduced after the interpretation and precedent layers are stable.

Officers can track trust in the commander.

Trust changes when:

- commands contradict themselves,
- orders cause unnecessary harm,
- player repeatedly overrides expertise,
- player gives clear successful orders,
- player honours prior commitments.

Trust should not make officers randomly disobey.

Instead it modifies:

```text
willingness_to_use_discretion
willingness_to_request_clarification
obedience_to_current_order
precedent_weight
```

---

# 44. Deliberate Ambiguity

Sometimes ambiguity should be useful.

Example:

> Keep the eastern road open if you can.

High-discretion officers gain flexibility.

Literal officers may underperform.

Thus:

```text
more specificity != always better
```

The player chooses between:

```text
precision
vs
delegation
```

That is strategically important.

---

# 45. Orders Can Be Wrong

Do not make the game a writing-quality test.

A perfectly clear command can be strategically disastrous.

Example:

> Divert all reserve power to medical immediately.

Jev interprets it perfectly.

Orlov obeys perfectly.

The colony loses its water pumps.

Excellent.

The challenge is command, not grammar.

---

# 46. Orders Can Be Morally Clear but Operationally Impossible

Example:

> Save everyone.

Jev:

```text
priority_people .99
```

Engine:

```text
available vehicles insufficient
time insufficient
```

Officers then choose according to doctrine.

The game should distinguish:

```text
misinterpretation
from
physical impossibility
```

The explain trace must make that obvious.

---

# 47. No Hidden Model Authority

The following must never come directly from Jev:

- final action,
- casualties,
- resource consumption,
- movement,
- success/failure,
- officer loyalty,
- world events,
- win/loss,
- rule enforcement.

Jev measures semantics only.

---

# 48. Proposed Architecture

```text
src/
  engine/
    game.ts
    world.ts
    actions.ts
    officers.ts
    doctrine.ts
    orders.ts
    precedent.ts
    resolution.ts
    explain.ts
    rng.ts
    types.ts

  judge/
    questions.ts
    state.ts
    calibration.ts

  content/
    officers/
    crises/
    dialogue/

  client/
    map/
    command/
    reports/
    inspector/
    replay/

  worker/
    index.ts
    validate.ts
    session.ts
```

Do not create a shared `jev-game-kit` yet.

---

# 49. API Shape

Conceptually:

```text
POST /api/judge-order
```

Input:

```json
{
  "order": "...",
  "context": { }
}
```

Worker:

- validates bounded state,
- attaches fixed question set,
- calls Jev,
- returns measurements only.

The model key remains server-side.

---

# 50. Security

Apply lessons from Werewolf:

- signed game session,
- bounded input,
- fixed question set,
- strict schema,
- rate limits,
- no arbitrary candidate evaluation endpoint,
- no model key in browser.

Prompt injection has little authority because the model cannot alter rules.

---

# 51. Deliberate Scope Boundaries

ORDERS is intended to be a full-fledged game, but not every possible system belongs in it.

The following are **deliberate exclusions unless later play proves they directly strengthen the command-through-language thesis**:

- runtime generative dialogue,
- open-world avatar movement,
- procedural tactical combat,
- hundreds of officers,
- MMO-style multiplayer,
- romance systems,
- arbitrary political-faction simulation,
- moddable semantic schemas,
- premature extraction into a shared Jev framework.

These are not deferred because the project needs to be a small v1.

They are excluded because they would pull design authority away from the core:

```text
language
→ interpretation
→ doctrine
→ action
→ consequence
```

Other ambitious systems are explicitly in scope when they reinforce that loop:

- four full officer personalities,
- colony-wide resource simulation,
- simultaneous orders,
- standing orders,
- precedent,
- trust and command legitimacy,
- cascading crises,
- authored dialogue,
- strong audiovisual presentation,
- deterministic replay,
- post-run analysis,
- meaningful run variety.

The target is:

> **One colony. Four officers. One deep, polished simulation whose complexity comes from interpretation and consequence rather than feature count for its own sake.**

---

# 52. Construction Order — Retire Uncertainty, Not Scope

These are not product versions.

They are the order in which we remove unknowns so later systems are built on trustworthy foundations.

A reduced stage may be ugly, temporary, or disposable. Completing one stage means **proceed to the next layer of the full game**, not ship a permanently reduced feature set.

## Stage 1 — Semantic Instrument

Build:

- Jev question set,
- order inspector,
- calibration corpus,
- semantic regression tests,
- stability and latency measurements.

Use deliberately adversarial orders:

- clear,
- ambiguous,
- conditional,
- contradictory,
- resource-constrained,
- precedent-conflicting,
- permissive,
- absolute,
- underspecified.

Exit condition:

> We trust the semantic interpretation vector enough to make game rules depend on it.

---

## Stage 2 — Interpretation Harness

Use one officer and one contained logistics crisis if that is the fastest way to isolate the mechanic.

Example harness:

```text
fuel
vehicles
water pumps
civilian evacuation
```

This is **not the intended game scope**.

It exists to answer:

> Can a deterministic officer policy turn the same semantic vector into an action that feels understandable and fair?

Once yes, move on.

---

## Stage 3 — Full Officer Divergence

Bring in all four core officers:

- Ilya,
- Chen,
- Vale,
- Orlov.

The same order must produce meaningfully different action preferences because of doctrine, not because each officer gets a different model prompt.

Exit condition:

> Players can begin learning how each officer thinks.

---

## Stage 4 — Action Resolution and Resource Contention

Build the real shared action layer:

- finite departmental action libraries,
- feasibility,
- shared resources,
- simultaneous execution,
- cross-department conflicts,
- clarification as an action,
- failure and partial-success states.

Exit condition:

> Two individually sensible orders can collide in the world in understandable ways.

---

## Stage 5 — Full Colony Simulation

Expand from the harness into the intended systemic game:

- power,
- water,
- food,
- medicine,
- fuel,
- shelter,
- security,
- morale,
- population,
- sectors,
- infrastructure state,
- environmental pressure,
- injuries and casualties,
- time pressure.

Build cascades deliberately.

Exit condition:

> Commands create systemic second- and third-order consequences rather than isolated state changes.

---

## Stage 6 — Standing Orders and Institutional Precedent

Add:

- persistent directives,
- exceptions,
- temporary suspensions,
- supersession,
- contradiction detection,
- officer-specific precedent weighting,
- order ledger compilation.

This is a core ORDERS system, not an expansion pack.

Exit condition:

> The organisation has memory, and yesterday's command can legitimately change today's execution.

---

## Stage 7 — Trust and Command Legitimacy

Add command relationship state:

- trust,
- willingness to use discretion,
- willingness to ask for clarification,
- obedience to current orders,
- reliance on precedent,
- response to repeated strategic failure.

Keep disobedience rule-based and explainable.

Exit condition:

> Officers react not only to the current sentence but to the commander's demonstrated history.

---

## Stage 8 — Explainability and Causal Replay

Every significant outcome must expose:

```text
order
semantic interpretation
officer doctrine
standing orders
precedent
resource constraints
selected action
simultaneous conflicts
world delta
downstream consequence
```

Add deterministic replay and timeline scrubbing.

Exit condition:

> A player can inspect any disaster and distinguish misunderstanding, doctrine, resource impossibility, and a simply bad command.

---

## Stage 9 — Crisis Ecology and Run Variety

Scale content:

- 30+ crisis / complication templates,
- interacting crisis chains,
- state-dependent events,
- multiple viable colony trajectories,
- endings based on accumulated state rather than a single final choice.

Avoid linear authored branching.

Exit condition:

> Replays create different command problems without changing the core rules.

---

## Stage 10 — Authored Character Layer

Build the complete authored communication library:

```text
acknowledge
clarify
object
warn
confirm_priority
report_success
report_partial
report_failure
report_unexpected
challenge_precedent
request_exception
```

Jev may select among appropriate authored candidates where contextual choice helps.

No runtime text generation.

Exit condition:

> Officers are recognisable as characters even though their decisions remain code.

---

## Stage 11 — Full Presentation

Treat presentation as part of the game, not post-prototype decoration:

- officer portraits / sprites,
- colony map,
- sector states,
- sound design,
- music,
- pre-rendered or otherwise bounded voice work where practical,
- command-terminal interaction,
- visible system deterioration,
- crisis transitions,
- strong end-of-day rhythm.

Exit condition:

> The simulation is watchable and emotionally legible, not merely technically impressive.

---

## Stage 12 — Post-Run Analysis

End-of-run report can include:

```text
most ambiguous order
most expensive order
most successful order
best delegation
largest precedent conflict
largest interpretation divergence
officer who challenged you most
officer whose judgement saved the colony
resource system you sacrificed most
avoidable casualties
orders that were understood perfectly but strategically disastrous
```

All computed from deterministic state.

Exit condition:

> A finished run teaches the player something about how they commanded.

---

## Stage 13 — Balance by Full Runs

At this point, stop reasoning from isolated examples.

Run large seeded simulations and human playtests.

Measure:

```text
survival distribution
officer action diversity
clarification frequency
order ambiguity frequency
resource bottlenecks
dominant strategies
precedent usefulness
trust-state movement
average run length
Jev cost and latency
```

Tune weights and systems, not by making the model more authoritative, but by making the deterministic game better.

---

# 53. Success Criteria

ORDERS succeeds if players naturally say things like:

> “I should have told Chen which resource mattered more.”

> “Ilya did exactly what I said, unfortunately.”

> “Vale ignored the spirit of the order because I had already told her civilians came first.”

> “Orlov understood me correctly; the plan itself was stupid.”

The game fails if players say:

> “The AI randomly misunderstood me.”

or:

> “I need to find the magic prompt.”

---

# 54. The Crucial Distinction

ORDERS is not:

> “Write a prompt and see what the AI does.”

It is:

> **“Issue an order and manage an organisation whose people interpret intent through different doctrines.”**

Jev provides semantic perception.

The officers provide interpretation.

The world provides consequences.

---

# 55. Optional Expansion Axes

These are directions ORDERS could grow after the core full game is coherent. They are not excuses to amputate the main design now:

- more officers,
- officer replacement,
- rival chains of command,
- political factions,
- mutiny,
- encrypted/incomplete orders,
- delayed communication,
- radio degradation,
- subordinate commanders,
- fog of war,
- doctrine editing,
- generated scenarios built from deterministic templates,
- campaign continuity.

---

# 56. Possible Alternate Skins

The engine should be skin-agnostic enough that later variants could include:

## HOLDFAST

Besieged medieval fortress.

```text
food
walls
troops
civilians
disease
morale
```

## FARLIGHT

Damaged generation ship.

```text
oxygen
power
habitats
reactor
navigation
population
```

## WHITEOUT

Arctic expedition.

```text
heat
fuel
food
shelter
visibility
medical
```

But do not abstract for these prematurely.

Build ORDERS first.

---

# 57. Final Design Rule

The strongest rule inherited from Human Compiler and Werewolf:

> **If the game cannot explain a model-influenced outcome numerically and deterministically, the model has too much authority.**

And the defining rule of ORDERS:

> **One sentence may mean the same thing to Jev and still produce four different actions — because understanding the words is not the same as deciding what to do.**
