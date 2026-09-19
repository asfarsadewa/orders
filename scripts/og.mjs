// Renders public/og.jpg (1200x630) for link previews from the key art, with
// the wordmark, tagline and an officer-strip motif set in the game's own type
// so the words are never left to the image model. Run with `npm run og`.
//
// Fonts come from Google Fonts as static instances: the css2 endpoint serves
// per-weight TrueType files to a legacy user agent, which is what the SVG
// renderer needs. They are cached under node_modules/.cache/og-fonts.

import { Resvg } from "@resvg/resvg-js";
import jpeg from "jpeg-js";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = path.join(root, "node_modules", ".cache", "og-fonts");
const out = path.join(root, "public", "og.jpg");
const art = path.join(root, "public", "art", "keyart.jpg");

/** family, css2 axis spec, cache name. */
const FONTS = [
  ["Big Shoulders Display", "Big+Shoulders+Display:wght@800", "BigShouldersDisplay-800.ttf"],
  ["Big Shoulders Text", "Big+Shoulders+Text:wght@700", "BigShouldersText-700.ttf"],
  ["Literata", "Literata:wght@400", "Literata-400.ttf"],
  ["Martian Mono", "Martian+Mono:wght@500", "MartianMono-500.ttf"],
];
const LEGACY_UA = "Mozilla/5.0 (Windows NT 6.1)";

async function fonts() {
  await mkdir(cache, { recursive: true });
  const files = [];
  for (const [, spec, name] of FONTS) {
    const file = path.join(cache, name);
    if (!existsSync(file)) {
      const css = await fetch(`https://fonts.googleapis.com/css2?family=${spec}`, { headers: { "User-Agent": LEGACY_UA } });
      if (!css.ok) throw new Error(`font css failed: ${spec} (${css.status})`);
      const body = await css.text();
      const m = /url\((https:[^)]+\.ttf)\)/.exec(body) ?? /url\((https:[^)]+)\)/.exec(body);
      if (!m) throw new Error(`no ttf url for ${spec}`);
      const r = await fetch(m[1]);
      if (!r.ok) throw new Error(`font download failed: ${m[1]} (${r.status})`);
      await writeFile(file, Buffer.from(await r.arrayBuffer()));
    }
    files.push(file);
  }
  return files;
}

const W = 1200;
const H = 630;
const BAND = 156;
const C = { bg: "#0c0e0d", ink: "#e6e8e3", ink2: "#a8ada4", dim: "#8a9086", rule: "#2a2e2a", amber: "#eaaa08", green: "#75e0a7", blue: "#84adff" };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const text = (x, y, t, { family = "Literata", size = 16, weight = 400, fill = C.ink, anchor = "start", spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}" xml:space="preserve">${esc(t)}</text>`;

async function main() {
  const jpg = await readFile(art);
  const href = `data:image/jpeg;base64,${jpg.toString("base64")}`;
  const bandY = H - BAND;
  // Officer strip: one order, three readings.
  const strip = [
    ["CAPTAIN ILYA", "acknowledged", C.green],
    ["CHEN", "asks", C.blue],
    ["CHIEF ORLOV", "objects", C.amber],
  ]
    .map(([name, act, col], i) => {
      const x = W - 44 - (3 - i) * 172;
      return text(x, bandY + 46, name, { family: "Big Shoulders Display", size: 22, weight: 800, spacing: 1 }) + text(x, bandY + 68, act, { family: "Martian Mono", size: 12, weight: 500, fill: col });
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <image href="${href}" x="0" y="0" width="${W}" height="${bandY}" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="${bandY}" width="${W}" height="${BAND}" fill="${C.bg}"/>
  <rect x="0" y="${bandY}" width="${W}" height="1" fill="${C.rule}"/>
  ${text(44, bandY + 74, "ORDERS", { family: "Big Shoulders Display", size: 78, weight: 800, spacing: 5 })}
  ${text(44, bandY + 106, "Four officers. One colony. The enemy is what people think you meant.", { size: 19 })}
  ${text(44, bandY + 132, "Write orders in your own words. TypeSafe Jev measures what you meant; doctrine decides what they do.", { family: "Martian Mono", size: 12, weight: 500, fill: C.dim })}
  ${strip}
  ${text(W - 44, bandY + 24, "ONE ORDER · THREE READINGS", { family: "Big Shoulders Text", size: 12, weight: 700, fill: C.dim, anchor: "end", spacing: 2 })}
</svg>`;
  const fontFiles = await fonts();
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: W }, font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Literata" } });
  const image = resvg.render();
  const { data } = jpeg.encode({ data: Buffer.from(image.pixels), width: image.width, height: image.height }, 86);
  await writeFile(out, data);
  await writeFile(path.join(cache, "og.svg"), svg);
  console.log(`wrote ${path.relative(root, out)} (${data.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
