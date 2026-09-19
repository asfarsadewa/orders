// Renders public/og.jpg (1200x630) for link previews from the key art, with
// the wordmark and tagline set in the game's own type so the words are never
// left to the image model. Run with `npm run og`.

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

const FONTS = [
  ["IBMPlexMono-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/IBMPlexMono-Regular.ttf"],
  ["IBMPlexMono-SemiBold.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/IBMPlexMono-SemiBold.ttf"],
  ["XanhMono-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/xanhmono/XanhMono-Regular.ttf"],
];

async function fonts() {
  await mkdir(cache, { recursive: true });
  const files = [];
  for (const [name, url] of FONTS) {
    const file = path.join(cache, name);
    if (!existsSync(file)) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`font download failed: ${url} (${r.status})`);
      await writeFile(file, Buffer.from(await r.arrayBuffer()));
    }
    files.push(file);
  }
  return files;
}

const W = 1200;
const H = 630;
const BAND = 150;
const C = { bg: "#0c0e0d", ink: "#e6e8e3", dim: "#8a9086", rule: "#2a2e2a", amber: "#eaaa08", green: "#75e0a7", blue: "#84adff" };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const mono = (x, y, text, fill = C.ink, size = 18, weight = 400, anchor = "start") =>
  `<text x="${x}" y="${y}" font-family="IBM Plex Mono" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" xml:space="preserve">${esc(text)}</text>`;

async function main() {
  const jpg = await readFile(art);
  const href = `data:image/jpeg;base64,${jpg.toString("base64")}`;
  const bandY = H - BAND;
  const base = bandY + 62;
  // A small officer strip motif: three stances to the same order.
  const strip = [
    ["Ilya", "acknowledged", C.green],
    ["Chen", "asks", C.blue],
    ["Orlov", "objects", C.amber],
  ]
    .map(([name, act, col], i) => {
      const x = W - 44 - (3 - i) * 150;
      return `${mono(x, bandY + 40, name, C.ink, 15, 600)}${mono(x, bandY + 62, act, col, 13)}`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <image href="${href}" x="0" y="0" width="${W}" height="${bandY}" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="${bandY}" width="${W}" height="${BAND}" fill="${C.bg}"/>
  <rect x="0" y="${bandY}" width="${W}" height="1" fill="${C.rule}"/>
  <text x="44" y="${base}" font-family="Xanh Mono" font-size="64" fill="${C.ink}" letter-spacing="-1">orders</text>
  ${mono(44, base + 36, "Four officers. One colony. The enemy is what people think you meant.", C.ink, 18, 600)}
  ${mono(44, base + 62, "Write orders in your own words. TypeSafe Jev measures what you meant; doctrine decides what they do.", C.dim, 13)}
  ${strip}
  ${mono(W - 44, bandY + 22, "one order, three readings", C.dim, 11, 400, "end")}
</svg>`;
  const fontFiles = await fonts();
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: W }, font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "IBM Plex Mono" } });
  const image = resvg.render();
  const { data } = jpeg.encode({ data: Buffer.from(image.pixels), width: image.width, height: image.height }, 86);
  await writeFile(out, data);
  console.log(`wrote ${path.relative(root, out)} (${data.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
