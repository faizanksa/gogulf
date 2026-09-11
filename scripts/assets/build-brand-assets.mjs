/**
 * Brand assets, exported from the original artwork — never redrawn.
 *
 *   node scripts/assets/build-brand-assets.mjs
 *
 * Master: brand/go-gulf-logo-master.png (1254 × 1254, the logo supplied with the site).
 * Kept outside public/ so it is preserved but never served. Replace it with vector
 * artwork when the business supplies one, and re-run.
 *
 * Outputs
 *   public/brand/logo-96.png           header/footer logo (40–44px shown, 2× for sharp
 *                                      screens); a plain <img>, so no next/image client
 *                                      code ships with every page
 *   public/brand/logo-192.png          manifest icon
 *   public/brand/logo-512.png          structured-data logo, manifest icon, share image
 *   public/brand/icon-maskable-512.png Android adaptive icon (logo inside the safe zone)
 *   app/apple-icon.png                 180 × 180 home-screen icon
 *   app/favicon.ico                    16/32/48 — the falcon mark (wing + head) cropped
 *                                      from the master, because the full logo with its
 *                                      wordmark is illegible at 32px
 */

import { writeFileSync, statSync } from "node:fs";
import sharp from "sharp";

const MASTER = "brand/go-gulf-logo-master.png";
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const png = (img) => img.png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 92, effort: 10, dither: 0.6 });

// The mark: wing + head, cropped from the master. A sliver of the circular frame falls in
// the crop's top-right corner; it is painted white (the falcon itself is untouched), and
// the crop is padded to a square.
const MARK_CROP = { left: 262, top: 196, width: 790, height: 548 };
const FRAME_SLIVER = { left: 668, top: 0, width: 122, height: 70 };

async function mark() {
  const cropped = await sharp(MASTER).extract(MARK_CROP).png().toBuffer();
  const cleaned = await sharp(cropped)
    .composite([{ input: { create: { width: FRAME_SLIVER.width, height: FRAME_SLIVER.height, channels: 3, background: WHITE } }, left: FRAME_SLIVER.left, top: FRAME_SLIVER.top }])
    .png()
    .toBuffer();
  const pad = (MARK_CROP.width - MARK_CROP.height) / 2;
  return sharp(cleaned).extend({ top: Math.floor(pad), bottom: Math.ceil(pad), background: WHITE }).png().toBuffer();
}

function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = header.length + dir.length;
  images.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...images.map((i) => i.data)]);
}

const outputs = [];
async function save(path, pipeline) {
  await pipeline.toFile(path);
  outputs.push(path);
}

await save("public/brand/logo-96.png", png(sharp(MASTER).resize(96)));
await save("public/brand/logo-192.png", png(sharp(MASTER).resize(192)));
await save("public/brand/logo-512.png", png(sharp(MASTER).resize(512)));
await save(
  "public/brand/icon-maskable-512.png",
  png(sharp(await sharp(MASTER).resize(384).png().toBuffer()).extend({ top: 64, bottom: 64, left: 64, right: 64, background: WHITE })),
);
await save("app/apple-icon.png", png(sharp(MASTER).resize(180)));

const markBuf = await mark();
const sizes = [16, 32, 48];
const icoImages = await Promise.all(
  sizes.map(async (size) => ({ size, data: await sharp(markBuf).resize(size).ensureAlpha().png({ compressionLevel: 9 }).toBuffer() })),
);
writeFileSync("app/favicon.ico", ico(icoImages));
outputs.push("app/favicon.ico");

for (const p of outputs) console.log(`${String(statSync(p).size).padStart(8)} B  ${p}`);
