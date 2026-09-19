# orders

A command game where the enemy is what people think you meant. The player writes natural-language orders to four officers of a failing frontier colony; TypeSafe Jev measures what each order means, and deterministic doctrine turns the same measurement into four different actions. Read these before doing anything:

1. `docs/ORDERS_SPEC.md`: the intended full game.
2. `docs/DECISIONS.md`: what was decided and why. Do not reopen a decision without saying so.
3. `docs/PLAN.md`: construction order and what to do next.

## The thesis

The model understands; the game decides. Jev returns typed probabilities about one order. Everything else is code: officer utility, resource allocation, the world tick, dialogue selection, endings. If the game cannot explain a model-influenced outcome numerically, the model has too much authority.

## How to work here

- Use the `typesafe-ai` skill for anything touching the model. Read the live docs at https://docs.typesafe.ai/llms.txt rather than relying on memory. One narrow judgment per question, named state fields in backticks, a no-match option where nothing may fit, every independent question in one request.
- Code owns every threshold and weight. Thresholds live in `src/engine/thresholds.ts` and are tested. Doctrine lives in `src/content/officers.ts` as numbers, never prose prompts.
- The engine is pure and deterministic given a seed and a stream of `(order, measurements)`. Nothing under `src/engine` imports from `src/client`, `src/worker` or `src/judge`. Tests never call Jev; fixture vectors live in `test/fixtures.ts`.
- Officers speak from authored lines in `src/content/lines/`. Never generate dialogue. Specifics are rendered by code as `= note:` lines under the authored line so every line can be voice-acted once.
- Explain everything: every utility term, allocation and world delta is recorded and shown in the inspector.
- Design language: dark command post. `--bg #0c0e0d`, `--panel #141716`, `--ink #e6e8e3`, `--dim #8a9086`, `--rule #2a2e2a`; amber `#eaaa08` for command and warning, red `#f97066` critical, green `#75e0a7` acknowledged, blue `#84adff` note. Three type registers (D27): Big Shoulders Display (20px and up) and Big Shoulders Text (labels, buttons, tags) are the station's signage, always caps and tracked; Literata is everything a person says, never caps; Martian Mono is everything the machine measured or the commander typed, and every number, at width 87.5 for dense lines. No rounded corners, no gradients, controls in a row share one box height (40px). Dry copy, sentence case, as few words as possible.
- Footer links: source, MIT, and the X mark linking to https://x.com/ashthepeasant.

## Environment notes

- `TYPESAFE_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY` are set at Windows user scope.
- `CLOUDFLARE_API_TOKEN` in the environment has only Turnstile scope. Deploys and `wrangler secret put` must run with it removed (`env -u CLOUDFLARE_API_TOKEN npx wrangler deploy`) so wrangler uses the OAuth login. Turnstile commands need it plus `CLOUDFLARE_ACCOUNT_ID=0c2d9127ae2095948325cb0ff08583cb`.
- The zone `asfarlab.fun` is on this account; the custom domain is declared in `wrangler.jsonc` `routes` with `custom_domain: true`.
- Vite dev server quirk: after it restarts itself, served modules can reference stale dependency hashes and the page hangs blank. Stop and restart `npm run dev`.
- Shell heredocs here truncate above roughly 10 KB and mangle backslash escapes; write large files with the Write tool.
- The in-app browser cannot pass Turnstile in production; verify production in a real browser or with the dev keys.

## What the owner cares about

- Polished, well engineered, deterministic. Misaligned controls and unexplained numbers get called out.
- Fun first: the player must be able to say "I know exactly why Chen did that."
- The repo is public from the first commit: no secrets, no generated junk, provenance for every asset.
