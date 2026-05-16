import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const source = resolve(root, 'youtube-summary-icon.png');
const outDir = resolve(root, 'public/icons');

const sizes = [16, 32, 48, 128] as const;

// The source is RGB on a black background with a soft drop shadow under the
// white rounded-square base. Pixels whose R+G+B sum is below this threshold
// are flood-filled away from each corner — covers pure black and the shadow
// but stays well below the white base (~762) and the red play button (~255+).
const BACKGROUND_SUM_THRESHOLD = 240;

async function buildTransparentRgba() {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const mask = Buffer.alloc(width * height, 255);
  const stack: Array<[number, number]> = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  while (stack.length > 0) {
    const [x, y] = stack.pop() as [number, number];
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const mi = y * width + x;
    if (mask[mi] === 0) continue;
    const pi = mi * channels;
    const sum = (data[pi] ?? 0) + (data[pi + 1] ?? 0) + (data[pi + 2] ?? 0);
    if (sum > BACKGROUND_SUM_THRESHOLD) continue;
    mask[mi] = 0;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  const featheredAlpha = await sharp(mask, { raw: { width, height, channels: 1 } })
    .blur(1.5)
    .raw()
    .toBuffer();

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = data[i * channels] ?? 0;
    rgba[i * 4 + 1] = data[i * channels + 1] ?? 0;
    rgba[i * 4 + 2] = data[i * channels + 2] ?? 0;
    rgba[i * 4 + 3] = featheredAlpha[i] ?? 0;
  }

  return { data: rgba, width, height };
}

await mkdir(outDir, { recursive: true });

const master = await buildTransparentRgba();

await Promise.all(
  sizes.map((size) =>
    sharp(master.data, {
      raw: { width: master.width, height: master.height, channels: 4 },
    })
      .resize(size, size, { kernel: 'lanczos3' })
      .png({ compressionLevel: 9 })
      .toFile(resolve(outDir, `icon-${size}.png`)),
  ),
);

// Landing page (GitHub Pages) hero icon. Committed to git so GH Pages can serve it.
await sharp(master.data, {
  raw: { width: master.width, height: master.height, channels: 4 },
})
  .resize(256, 256, { kernel: 'lanczos3' })
  .png({ compressionLevel: 9 })
  .toFile(resolve(root, 'docs/icon.png'));

console.log(`Generated ${sizes.length} icons at ${outDir} + docs/icon.png`);
