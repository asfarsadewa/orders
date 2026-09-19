# Audio prompts and provenance

Generated 2026-09-19. Sound effects from ElevenLabs text-to-sound-effects (`POST /v1/sound-generation?output_format=mp3_44100_128`, default model, `loop` false), music from Google Lyria 3.5 via the Gemini interactions API (`POST /v1beta/interactions`, `{model: "lyria-3.5", input}`), two candidates per track. Every file was post-processed with ffmpeg 8.1: sound effects trimmed at -45 dB relative to a 6 dB pre-gain, capped with a short fade, then two-pass `loudnorm` to the target below (or a plain gain landing the true peak at -1.5 dBTP when linear normalisation would overshoot), `libmp3lame` 64k mono; music trimmed of trailing silence, faded 1.5 s in and 3 s out, two-pass `loudnorm` I=-19 TP=-1.5 LRA=9, `libmp3lame` 96k. Voice is in `public/voice` (see `scripts/voice.ts`): Gemini `gemini-3.1-flash-tts-preview`, one clip per authored line, trimmed and normalised to -18 LUFS, 32k mono. Nothing here is generated at runtime; the manifest is what the client reads.

## Sound effects

| name | prompt | seconds | playback gainDb |
|---|---|---|---|
| send | A single crisp mechanical teletype key strike followed by a short paper advance click. Close, dry, no music. | 0.5 | 0 |
| ack | A short two-tone radio acknowledgement beep, clean and quiet, like a handheld transceiver confirming receipt. No music, no voice. | 0.6 | 0 |
| clarify | A brief burst of soft radio static that resolves into one gentle rising query tone. Quiet, close, no music, no voice. | 1 | 0 |
| warn | A single low muted alert tone, one pulse, like a console warning in a dark control room. No music, no reverb, no voice. | 0.8 | 0 |
| execute | A heavy metal switch thrown with a solid mechanical clunk, then a low electrical hum settling for one second. Industrial, close, no music. | 1.58 | 0 |
| alarm | A colony alarm klaxon, two short low honks heard through concrete walls, muffled and distant. No music, no voice. | 1.6 | 0 |
| loss | A single low sustained electronic tone like a heart monitor going flat, fading away over two seconds. Sombre, no music. | 2.2 | 0 |
| relief | A soft warm chord on a small analogue synthesizer, held briefly and released. Quiet hope, no melody, no percussion. | 1.8 | 0 |
| dawn | Cold wind dying down at dawn on an open snowy plateau, one distant metallic creak, then near silence. Outdoor ambience, no music, no voice. | 3 | 0 |
| click | One very short soft click of a fingertip on a plastic console key. Tiny, dry, no music. | 0.14 | -4 |
| ending-good | A slow warm swell of a low synthesizer pad with a faint high shimmer, rising and settling over three seconds. Hopeful, no melody, no percussion, no voice. | 3.5 | 0 |
| ending-bad | A deep dark drone with cold wind, descending slowly and dying away over three seconds. Bleak, no melody, no percussion, no voice. | 3.5 | 0 |

## Music

| track | prompt | seconds | chosen candidate |
|---|---|---|---|
| title | Main theme for a cold, serious command game about a failing frontier colony in the snow: slow and spacious, a low analogue synth drone, sparse piano notes in a minor key, a faint distant metallic pulse like a generator, restrained, one memorable slow melody stated twice, modest dynamics, ends quietly. Instrumental only, no vocals, no lyrics, no spoken words. | 170.99 | title-2.mp3 |
| day | Tense, quiet underscore for a command post during a long day: soft analogue synth pads, a slow steady ticking pulse, sparse low piano, cold and patient, sits under reading and typing without demanding attention, no big build, no drum fills, gentle enough to loop. Instrumental only, no vocals, no lyrics, no spoken words. | 175.74 | day-1.mp3 |
| night | Dark ambient nocturne for a colony at night on a snowy plateau: wind textures, a very low bowed drone, distant creaking metal, an occasional lonely held note on a cello or a synth, slow and cold, very sparse, no percussion, seamless mood. Instrumental only, no vocals, no lyrics, no spoken words. | 171.36 | night-2.mp3 |
