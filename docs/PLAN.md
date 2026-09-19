# Plan

Construction order follows the spec's section 52: retire uncertainty in dependency order, then continue toward the full game. Each stage lists what exists when it is done.

## Stage 1: Semantic instrument

- `src/judge/questions.ts`: the fixed question set (Choices for objective, sector and timeframe; Nouls for department scope, priorities, constraints, communication quality; per-standing-order and per-clarification Nouls; Scores for urgency, risk tolerance, resource flexibility, specificity, clarity, delegated discretion).
- `src/judge/state.ts`: the compact state builder. Never the whole simulation.
- `scripts/calibrate.ts`: an authored corpus with expected measurements, run against the live model, reported to `docs/CALIBRATION.md` with crossing rates, separation and repeat-run stability.
- Exit: the vector is trusted enough to hang rules on.

## Stage 2 to 4: Officers, resolution, contention

- `src/engine/types.ts`, `rng.ts`, `officers.ts`, `actions.ts`, `resolve.ts`.
- Four doctrines from the spec, a finite action library per department, an explicit utility with a recorded trace, clarification as an action, shared-resource allocation, partial success.
- `test/resolve.test.ts` with fixture vectors: divergence, precedent, standing-order override, contention, clarification, simultaneous execution.

## Stage 5: Colony simulation

- `src/engine/world.ts`: power, water, food, medicine, fuel, vehicles, shelter, security, morale, population, five sectors, weather, injuries, fire, contamination, external threat; a daily tick with deliberate cascades.
- `src/content/crises.ts`: thirty-plus templates gated by state, weighted, seeded.
- `test/world.test.ts`: cascades and conservation (nothing appears from nowhere).

## Stage 6 to 7: Memory and trust

- `src/engine/orders.ts`: ledger, standing orders, supersession, exceptions, precedent memory.
- `src/engine/trust.ts`.

## Stage 8: Explain and replay

- `src/engine/explain.ts`, `src/engine/game.ts` (reducer over the event stream), `src/engine/report.ts` (post-run analysis), `src/engine/endings.ts`.

## Stage 9 to 10: Content

- Crisis ecology to thirty-plus templates with chains; `src/content/lines/*.ts` per officer with a lint for coverage.

## Stage 11: Presentation

- `src/client`: title, run, command composer, officer strip, map, status, reports, inspector, replay, post-run report; audio manager.
- `scripts/`: portraits and key art (Sunburst), voice (Gemini TTS), sound (ElevenLabs), music (Lyria 3.5), share card.

## Stage 12 to 13: Ship and balance

- Worker, Turnstile widget, secrets, custom domain `orders.asfarlab.fun`, README, public repo.
- `scripts/sim.ts`: seeded batch runs with scripted commanders; survival distribution, clarification frequency, action diversity, bottlenecks. Tune the deterministic game, not the model.
