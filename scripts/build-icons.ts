import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const source = resolve(root, 'youtube-summary-icon.png');
const outDir = resolve(root, 'public/icons');

const sizes = [16, 32, 48, 128] as const;

await mkdir(outDir, { recursive: true });

await Promise.all(
  sizes.map((size) =>
    sharp(source)
      .resize(size, size)
      .png()
      .toFile(resolve(outDir, `icon-${size}.png`)),
  ),
);

console.log(`Generated ${sizes.length} icons at ${outDir}`);
