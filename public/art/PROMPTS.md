# Art prompts and provenance

Generated 2026-09-19 with OpenAI `gpt-image-2.5-sunburst`, quality `high`, through the sprite-pipeline CLI (`image_gen.py`), prompts passed verbatim (`--no-augment`). Portraits were requested at 1024x1024 with `--background transparent --output-format png`; the key art at 1536x640 opaque PNG. Ilya was generated first and the other three portraits were made with the `edit` endpoint, passing Ilya's PNG as image 1 for style only. `scripts/art.py` post-processes: alpha below 24 cleared as haze, the band up to 48 scaled, the model's modal body alpha (254) stretched to 255, a square crop around the alpha bounding box padded by twelve percent and anchored above the head, LANCZOS to 256 and 128, WebP quality 92. The key art is written as JPEG at 1536x640 and 768x320, and `scripts/og.mjs` sets the wordmark and tagline on it for `public/og.jpg`.

| asset | files | call | size | model |
|---|---|---|---|---|
| ilya | `ilya.webp` 256, `ilya-128.webp` 128 | generate | 1024x1024 transparent | gpt-image-2.5-sunburst |
| chen | `chen.webp`, `chen-128.webp` | edit, image 1 = ilya (style reference) | 1024x1024 transparent | gpt-image-2.5-sunburst |
| vale | `vale.webp`, `vale-128.webp` | edit, image 1 = ilya (style reference) | 1024x1024 transparent | gpt-image-2.5-sunburst |
| orlov | `orlov.webp`, `orlov-128.webp` | edit, image 1 = ilya (style reference) | 1024x1024 transparent | gpt-image-2.5-sunburst |
| keyart | `keyart.jpg` 1536x640, `keyart-768.jpg` | generate | 1536x640 | gpt-image-2.5-sunburst |

## The style sentence (in every portrait prompt)

```text
Style: screen-print poster portrait for a personnel card in a cold, serious command game. Four flat inks only: near-black (#0c0e0d), slate grey (#5c6a78), bone white (#e6e8e3), and one small amber (#eaaa08) accent. Heavy simplified shapes, strong silhouette, flat fills with hard edges, no gradients, no texture, no rendered shading beyond one flat darker tone, no outline glow, no drop shadow, no text, no watermark, no background. Bust from the shoulders up, three-quarter view facing slightly to the viewer's left, centred, generous padding on all sides, the whole bust inside the canvas taking roughly 70 percent of the height, clean antialiased edges on a fully transparent background. The lower edge of the bust is a clean straight horizontal cut below the chest, never the image border.
```

## ilya

```text
Character portrait for a command game. Captain Ilya, security officer in his forties: close-cropped dark hair, a hard jaw, narrowed alert eyes, a heavy parka with the collar turned up, a radio handset clipped high on the chest strap. The only amber is the small indicator light on the radio. Expression: impatient, already moving.

Style: screen-print poster portrait for a personnel card in a cold, serious command game. Four flat inks only: near-black (#0c0e0d), slate grey (#5c6a78), bone white (#e6e8e3), and one small amber (#eaaa08) accent. Heavy simplified shapes, strong silhouette, flat fills with hard edges, no gradients, no texture, no rendered shading beyond one flat darker tone, no outline glow, no drop shadow, no text, no watermark, no background. Bust from the shoulders up, three-quarter view facing slightly to the viewer's left, centred, generous padding on all sides, the whole bust inside the canvas taking roughly 70 percent of the height, clean antialiased edges on a fully transparent background. The lower edge of the bust is a clean straight horizontal cut below the chest, never the image border.
```

## chen

```text
Image 1 is a style reference only; do not reproduce this character. Generate a new character in exactly the same illustration style, ink palette, line weight and framing, on a fully transparent background:

Character portrait for a command game. Chen, logistics chief in her thirties: dark hair tied back tight, thin-rimmed rectangular glasses, a quilted work jacket zipped to the neck, a flat ledger held against her chest with one hand. The only amber is a single narrow tab on the ledger's edge. Expression: composed, precise, unimpressed.

Style: screen-print poster portrait for a personnel card in a cold, serious command game. Four flat inks only: near-black (#0c0e0d), slate grey (#5c6a78), bone white (#e6e8e3), and one small amber (#eaaa08) accent. Heavy simplified shapes, strong silhouette, flat fills with hard edges, no gradients, no texture, no rendered shading beyond one flat darker tone, no outline glow, no drop shadow, no text, no watermark, no background. Bust from the shoulders up, three-quarter view facing slightly to the viewer's left, centred, generous padding on all sides, the whole bust inside the canvas taking roughly 70 percent of the height, clean antialiased edges on a fully transparent background. The lower edge of the bust is a clean straight horizontal cut below the chest, never the image border.
```

## vale

```text
Image 1 is a style reference only; do not reproduce this character. Generate a new character in exactly the same illustration style, ink palette, line weight and framing, on a fully transparent background:

Character portrait for a command game. Dr Vale, colony doctor in her fifties: grey-streaked hair pinned up, tired steady eyes, a wool coat worn open over medical scrubs, a stethoscope around the neck. The only amber is a small badge at the coat's lapel. Expression: direct, kind, worn.

Style: screen-print poster portrait for a personnel card in a cold, serious command game. Four flat inks only: near-black (#0c0e0d), slate grey (#5c6a78), bone white (#e6e8e3), and one small amber (#eaaa08) accent. Heavy simplified shapes, strong silhouette, flat fills with hard edges, no gradients, no texture, no rendered shading beyond one flat darker tone, no outline glow, no drop shadow, no text, no watermark, no background. Bust from the shoulders up, three-quarter view facing slightly to the viewer's left, centred, generous padding on all sides, the whole bust inside the canvas taking roughly 70 percent of the height, clean antialiased edges on a fully transparent background. The lower edge of the bust is a clean straight horizontal cut below the chest, never the image border.
```

## orlov

```text
Image 1 is a style reference only; do not reproduce this character. Generate a new character in exactly the same illustration style, ink palette, line weight and framing, on a fully transparent background:

Character portrait for a command game. Chief Orlov, chief engineer in his sixties: broad weathered face, short grey beard, heavy insulated coveralls with a tool loop at the shoulder, a headlamp pushed up onto his forehead. The only amber is the headlamp lens. Expression: dry, patient, thinking.

Style: screen-print poster portrait for a personnel card in a cold, serious command game. Four flat inks only: near-black (#0c0e0d), slate grey (#5c6a78), bone white (#e6e8e3), and one small amber (#eaaa08) accent. Heavy simplified shapes, strong silhouette, flat fills with hard edges, no gradients, no texture, no rendered shading beyond one flat darker tone, no outline glow, no drop shadow, no text, no watermark, no background. Bust from the shoulders up, three-quarter view facing slightly to the viewer's left, centred, generous padding on all sides, the whole bust inside the canvas taking roughly 70 percent of the height, clean antialiased edges on a fully transparent background. The lower edge of the bust is a clean straight horizontal cut below the chest, never the image border.
```

## keyart

```text
Wide key art for a command game called Orders. Vesper Station, a frontier colony on a cold high plateau at dusk: four low prefabricated blocks half-buried in drifted snow, a tall thin antenna mast with one small light at its tip, a chain-link fence line running across the foreground snow, jagged dark mountains under a darkening slate sky with the last band of pale light on the horizon. Screen-print poster style in four flat inks only: near-black (#0c0e0d), slate blue-grey, bone white snow (#e6e8e3), and a handful of small amber (#eaaa08) windows. Heavy simplified shapes, hard edges, no gradients, no texture, no text, no watermark, no people. Landscape composition with the colony in the lower half and open sky above, quiet and severe.
```
