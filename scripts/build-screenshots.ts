import sharp from 'sharp';
import { mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname, basename } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const srcDir = resolve(root, 'internal/screenshots');
const outDir = resolve(root, 'docs/screenshots');

const MAX_WIDTH = 1600;

await mkdir(outDir, { recursive: true });

const files = (await readdir(srcDir)).filter((f) => extname(f).toLowerCase() === '.png');

await Promise.all(
  files.map(async (file) => {
    const src = resolve(srcDir, file);
    const stem = basename(file, extname(file));
    const out = resolve(outDir, `${stem}.webp`);
    const image = sharp(src);
    const meta = await image.metadata();
    const width = meta.width ?? MAX_WIDTH;
    const targetWidth = Math.min(width, MAX_WIDTH);
    await image
      .resize({ width: targetWidth, withoutEnlargement: true, kernel: 'lanczos3' })
      .webp({ quality: 82, effort: 6 })
      .toFile(out);
  }),
);

console.log(`Optimized ${files.length} screenshots → ${outDir}`);
