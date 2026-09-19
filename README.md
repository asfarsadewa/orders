# orders

A command game where the enemy is what people think you meant.

You command Vesper Station, a colony of 184 people, for 14 days after a systems failure. You write orders in plain text to four officers. You can write up to three orders each day. A System One model, [TypeSafe Jev](https://typesafe.ai), measures each order one time. Each officer applies a different doctrine to the same measurement. Each officer selects one action. The selected actions share the fuel, the trucks, the crew hours and the medicine. The game simulates the night. The morning report shows each action and its effects. Every number is visible.

Live: https://orders.asfarlab.fun

![Vesper Station at dusk](public/og.jpg)

```
O-6-1 · you
Get Sector B evacuated before dark. Use whatever vehicles are available, but keep
enough fuel for the water pumps tonight. Security should cover the evacuation
instead of chasing whatever is outside.

Captain Ilya   acknowledged   Clear enough for me. Moving out.
Chen           priority noted A stated priority. Thank you. I can allocate now.
Chief Orlov    objects        Complying. Please read the fuel line tomorrow.
                              = complies · the action works against preserve reserve

Night 6 · cold · -14 C
Captain Ilya: escort the evacuation
Chen: reserve fuel for the pumps · 100%
Chief Orlov: power to the pumps
Security walked 16 colonists from the habitat to the core.
10 fuel is held for the pumps tonight.
Pumps ran on fuel.
```

## How it works

1. **The judge** (`src/judge/questions.ts`). The browser builds a compact state for each order. The state holds the order text, the day and one line per active crisis. It also holds one line per resource, the active standing orders, the last four orders and any open officer question. The Worker sends the state and a fixed question set to Jev. The set has five Choices: objective, target, owner, sector and timeframe. It has forty Nouls: department scope, eleven priorities, twelve constraints and thirteen properties of the wording. It has six Scores: urgency, risk tolerance, resource flexibility, specificity, clarity and delegated discretion. It adds two Nouls per active standing order and one Noul per open question. Jev returns probabilities in about 400 ms. It does not return a plan.
2. **The officers** (`src/engine/resolve.ts`, `src/content/officers.ts`, `src/content/actions.ts`). Each department has a finite action library. Each officer scores every action with a fixed formula. The formula adds the objective match and the stated priorities weighted by doctrine. It adds the constraints the action honours or violates, weighted by literalness. It subtracts a penalty for a permission the order did not give. It adds urgency times the action's speed and subtracts risk times risk aversion. It adds the sector match, discretion, standing orders in scope, the department's record and the officer's own initiative. The engine records every term.
3. **Clarification** (`src/engine/resolve.ts`). The engine calculates a need to ask. Low clarity, an unnamed target, a contradiction and two resources with no precedence raise the need. A conflict with a standing order or the record raises it too. Literalness raises the need. Initiative lowers it. If the need crosses the threshold, the officer asks an authored question and holds to routine until the answer arrives.
4. **The world** (`src/engine/world.ts`, `src/content/crises.ts`). Power output decides which sectors have heat. Cold in an unheated sector injures colonists. Cold in Works freezes the pipes. Fuel feeds the generator, the pumps and the trucks. The pumps produce water. Medicine and a heated ward decide which patients live. The state gates thirty-one crisis templates. The seed draws them. Every change to the world is an effect with a cause and one sentence.
5. **Memory** (`src/engine/orders.ts`, `src/engine/trust.ts`). An order that sets a rule becomes a standing order with its own measurement. Each order updates a per-department record of the priorities it stated. The record decays each night. Trust moves by fixed rules. Trust changes how much an officer reads intent, asks questions and follows the record.

The engine is deterministic. A run is a seed plus the stream of `(order, measurements)`. A replay of the stream reproduces every action, allocation, casualty, line and ending. The stream is the save format, the test fixture format and the replay view.

## The officers

| | doctrine | rule |
| --- | --- | --- |
| Captain Ilya, security | initiative .90, literalness .45, risk aversion .25 | If you do not accept casualties, do not write "whatever it takes". |
| Chen, logistics | literalness .92, resource caution 1.45, initiative .45 | State which resource comes first. If you do not, she asks and waits. |
| Dr Vale, medical | life priority 1.60, initiative .70 | If you want her to conserve medicine, say so in the order. |
| Chief Orlov, engineering | infrastructure 1.50, precedent .80 | He protects the systems before comfort. He follows standing orders. |

## Calibration

`npm run calibrate` sends 46 authored orders through the real question set at a fixed day-six situation. The orders are clear, vague, contradictory, conditional, absolute, in conflict with a standing order, or addressed to the model. The script grades every answer against the engine's thresholds and writes [docs/CALIBRATION.md](docs/CALIBRATION.md). The report lists the pass rate per question, the separation between high and low labels, and the drift between runs. If the corpus fails, change the question wording or the label. Do not change the thresholds to fit the wording.

`npm run sim` runs seeded games with scripted commanders and no model calls. It reports endings, deaths, clarification counts and action diversity. `scripts/morale.ts` sums every recorded morale effect and every death by its sentence. `scripts/play.ts` sends authored orders through the live judge and saves the event stream. `--explain <day> <department>` replays one decision offline.

## Presentation

The game generates nothing at runtime. Each script below runs one time and commits its output. The prompts and the provenance are in `public/art/PROMPTS.md` and `public/audio/PROMPTS.md`.

- **Portraits and key art**: gpt-image-2.5-sunburst, one style reference and three edits. `scripts/art.py` post-processes the files.
- **Voice**: Gemini TTS, one clip per authored line, 184 clips (`npm run voice`).
- **Sound**: ElevenLabs text-to-sound-effects, twelve cues (`npm run sfx`).
- **Music**: Lyria 3.5, three tracks: title, day, night (`npm run music`).
- **Type**: three registers. Big Shoulders (Display and Text) is the station's signage. Literata is what people say. Martian Mono is what the machine measured and what you typed. All three come from Google Fonts.

## Stack

- Cloudflare Workers with static assets, through `@cloudflare/vite-plugin`
- React 19, Vite, TypeScript, Vitest
- `@typesafe-ai/sdk` for the model calls, on the server only
- Cloudflare Turnstile one time per run, then a signed session token. Rate limits per session and per IP.

The model key stays on the server. The browser runs the engine and builds the compact judge state. The Worker replaces the fixed descriptions with its own copies, attaches the question set, calls Jev and returns the measurements. The Worker logs the request size and time. It does not log the order text.

## Development

```bash
npm install
cp .dev.vars.example .dev.vars   # then put your TYPESAFE_API_KEY in it
npm run dev                      # http://localhost:5173
npm test
npm run typecheck
```

`.dev.vars` uses Cloudflare's test keys for Turnstile. The test keys always pass. Asset scripts need keys in the environment: `OPENAI_API_KEY` for portraits, `GEMINI_API_KEY` for `npm run voice` and `npm run music`, `ELEVENLABS_API_KEY` for `npm run sfx`. `npm run calibrate` needs `TYPESAFE_API_KEY`.

## Documents

- [docs/ORDERS_SPEC.md](docs/ORDERS_SPEC.md): the intended full game.
- [docs/DECISIONS.md](docs/DECISIONS.md): each decision and its reason.
- [docs/PLAN.md](docs/PLAN.md): the construction order.
- [docs/CALIBRATION.md](docs/CALIBRATION.md): the latest calibration report.

MIT.
