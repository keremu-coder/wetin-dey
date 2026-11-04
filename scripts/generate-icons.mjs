// scripts/generate-icons.mjs
// Renders every app icon from public/icon.svg.
// Run: node scripts/generate-icons.mjs
//
// Outputs (in public/):
//   icon-192.png          — Android launcher
//   icon-512.png          — Android launcher (hi-res)
//   icon-1024.png         — iOS App Store
//   apple-touch-icon.png  — iOS home screen (180x180)
//   icon-maskable-512.png — Android adaptive icon, safe padding around mark

import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = join(root, "public", "icon.svg");
const svg = readFileSync(svgPath);

// Full-bleed render (icon.svg already fills the 100x100 viewBox).
async function renderFull(size, out) {
  await sharp(svg, { density: 400 })
    .resize(size, size, { fit: "contain", background: { r: 30, g: 47, b: 92, alpha: 1 } })
    .png()
    .toFile(join(root, "public", out));
  console.log("wrote:", out, size + "x" + size);
}

// Maskable: same icon, but scaled to 70% inside an indigo square so
// Android's circular/rounded crop never clips the bubble.
async function renderMaskable(size, out) {
  const inner = Math.round(size * 0.7);
  const innerPng = await sharp(svg, { density: 400 })
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const offset = Math.round((size - inner) / 2);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 30, g: 47, b: 92, alpha: 1 }
    }
  })
    .composite([{ input: innerPng, top: offset, left: offset }])
    .png()
    .toFile(join(root, "public", out));
  console.log("wrote:", out, size + "x" + size, "(maskable)");
}

await renderFull(192, "icon-192.png");
await renderFull(512, "icon-512.png");
await renderFull(1024, "icon-1024.png");
await renderFull(180, "apple-touch-icon.png");
await renderMaskable(512, "icon-maskable-512.png");
console.log("done.");