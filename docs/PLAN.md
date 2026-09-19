# Plan

Construction order follows the spec's section 52: retire uncertainty in dependency order, then continue toward the full game. Each stage lists what exists when it is done. Status as of 2026-09-19: stages 1 to 12 are built and live at https://orders.asfarlab.fun; stage 13 has its tools and its first pass.

## Stage 1: Semantic instrument. Done.

- `src/judge/questions.ts`: the fixed question set (Choices for objective, sector and timeframe; Nouls for department scope, priorities, constraints, communication quality; per-standing-order and per-clarification Nouls; Scores for urgency, risk tolerance, resource flexibility, specificity, clarity, delegated discretion).
- `src/judge/state.ts`: the compact state builder. Never the whole simulation.
- `scripts/calibrate.ts` with `scripts/corpus.ts`: forty-six authored orders with expected measurements, run against the live model, reported to `docs/CALIBRATION.md`. Last run 330 of 330 checks, median 365 ms.

## Stage 2 to 4: Officers, resolution, contention. Done.

- `src/engine/resolve.ts`, `src/content/officers.ts`, `src/content/actions.ts`: four doctrines, fifty-two actions, an explicit utility with a recorded trace, clarification as an action on a need threshold, shared-resource allocation by stated priority then initiative, partial success.
- `test/resolve.test.ts`: divergence, precedent, standing-order override, clarification, answers.

## Stage 5: Colony simulation. Done.

- `src/engine/world.ts`, `src/engine/tick.ts`, `src/content/crises.ts`: power, water, food, medicine, fuel, vehicles, shelter, security, morale, population, five sectors, weather from the seed, thirty-one crisis templates, deliberate cascades. `test/world.test.ts` covers cascades and conservation.

## Stage 6 to 7: Memory and trust. Done.

- `src/engine/orders.ts` (ledger, standing orders, supersession, precedent memory), `src/engine/trust.ts`.

## Stage 8: Explain and replay. Done.

- `src/engine/explain.ts`, `src/engine/game.ts` (reducer and replay), `src/engine/report.ts`, `src/engine/endings.ts`; the inspector drawer and the replay scrubber in the client.

## Stage 9 to 10: Content. Done for a first release.

- Thirty-one crisis templates with chains (collapse, trapped dying, contamination, storm, hoarding, protest); 184 authored lines across four voices plus twenty-four clarification questions, linted for coverage.

## Stage 11: Presentation. Done.

- `src/client`: title, run, composer, officer strip, schematic map, status board, log, inspector, night sheet, ending report, replay, help; audio manager with music, sound and voice.
- Portraits and key art (Sunburst), voice (Gemini TTS), sound (ElevenLabs), music (Lyria 3.5), share card.

## Stage 12: Ship. Done.

- Worker with Turnstile, sessions and rate limits; custom domain; public repository.

## Stage 13: Balance by full runs. In progress.

- `scripts/sim.ts` (scripted commanders, no model), `scripts/morale.ts` (effects by cause), `scripts/play.ts` (authored orders through the live judge). First pass recorded in DECISIONS D21.
- Next: human playtests; revisit the clarification floor, fuel economics and the pyrrhic thresholds from real transcripts; consider Jev candidate selection for report lines.

## Stage 14: Engine contracts from the review. Done.

- A second agent's review found five handoff failures: rejected messages in scoring, standing orders matched by position, an allocator that reserved for actions that could not run, unconditional effects at zero allocation, and crisis attendance by department. Regressions in `test/review-regressions.test.ts`; decisions D30 to D34.
- The order representation gained a `target` Choice (D35), calibrated 373/373. The follow-up review moved the minimum effort into allocation (D36) and made old recordings replay with a non-destructive resume (D37); regressions in `test/followup-regressions.test.ts`. Open: quantities in caps, fallback binding, per-clause owners.
