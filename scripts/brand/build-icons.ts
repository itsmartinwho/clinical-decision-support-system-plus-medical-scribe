// pnpm brand:icons
// Makes the favicons, the app icons and the share image from public/mark.svg:
// the mark in paper on an ink tile for icons, and in ink on paper with the
// product name for the share image. Run it again when the mark or the name changes.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import toIco from 'to-ico';
import { PRODUCT_NAME, PRODUCT_DESCRIPTION } from '../../src/lib/brand';

const root = path.join(__dirname, '..', '..');
const pub = path.join(root, 'public');
const INK = '#1C211F';
const PAPER = '#F6F4EF';
const MUTED = '#5E625D';

async function bars(fill: string): Promise<string> {
  const svg = await fs.readFile(path.join(pub, 'mark.svg'), 'utf8');
  return svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<rect /g, `<rect fill="${fill}" `);
}

async function tile(size: number): Promise<Buffer> {
  const inner = await bars(PAPER);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">
    <rect width="40" height="40" rx="9" fill="${INK}"/>
    <g transform="translate(6 6) scale(0.875)">${inner}</g>
  </svg>`;
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function main() {
  const icon = async (size: number, file: string) => fs.writeFile(path.join(pub, file), await tile(size));
  await icon(180, 'apple-touch-icon.png');
  await icon(192, 'android-chrome-192x192.png');
  await icon(512, 'android-chrome-512x512.png');
  await fs.writeFile(path.join(pub, 'favicon.ico'), await toIco(await Promise.all([16, 32, 48].map(tile))));

  const inner = await bars(INK);
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="${PAPER}"/>
    <rect x="80" y="80" width="1040" height="1" fill="#DDD9CF"/>
    <g transform="translate(80 200) scale(5)">${inner}</g>
    <text x="80" y="450" font-family="Georgia, 'Times New Roman', serif" font-size="72" fill="${INK}">${escape(PRODUCT_NAME)}</text>
    <text x="82" y="510" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="${MUTED}">${escape(PRODUCT_DESCRIPTION)}</text>
  </svg>`;
  await fs.writeFile(path.join(pub, 'og.png'), await sharp(Buffer.from(og)).png().toBuffer());
  console.log('Wrote favicon.ico, apple-touch-icon.png, android-chrome-192x192.png, android-chrome-512x512.png and og.png');
}

main().catch((e) => { console.error(e); process.exit(1); });
