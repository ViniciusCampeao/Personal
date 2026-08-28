/**
 * Generates the PWA icon set without any image dependency.
 *
 * Placeholder art: dark slate square with a white dumbbell. Replace `public/*.png`
 * with the real brand icons whenever they exist — nothing else has to change.
 *
 * Run with: pnpm --filter @pt/web icons
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const BACKGROUND = [15, 23, 42, 255]; // slate-900
const FOREGROUND = [248, 250, 252, 255]; // slate-50

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Draws the dumbbell inside a square of `size`, scaled by `inset` (maskable safe zone). */
function drawIcon(size, inset) {
  const pixels = Buffer.alloc(size * size * 4);
  const rects = [];
  const unit = size / 100;
  const scale = inset;
  const cx = size / 2;
  const cy = size / 2;

  const add = (w, h) => {
    rects.push({
      x0: cx - (w * unit * scale) / 2,
      x1: cx + (w * unit * scale) / 2,
      y0: cy - (h * unit * scale) / 2,
      y1: cy + (h * unit * scale) / 2,
    });
  };

  add(56, 8); // bar
  const plate = (offset, w, h) => {
    rects.push({
      x0: cx + (offset - w / 2) * unit * scale,
      x1: cx + (offset + w / 2) * unit * scale,
      y0: cy - (h / 2) * unit * scale,
      y1: cy + (h / 2) * unit * scale,
    });
  };
  plate(-26, 10, 40); // outer left plate
  plate(-15, 8, 28); // inner left plate
  plate(26, 10, 40);
  plate(15, 8, 28);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inside = rects.some(
        (r) => x + 0.5 >= r.x0 && x + 0.5 <= r.x1 && y + 0.5 >= r.y0 && y + 0.5 <= r.y1,
      );
      const color = inside ? FOREGROUND : BACKGROUND;
      const offset = (y * size + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
    }
  }
  return encodePng(size, pixels);
}

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#0f172a"/>
  <g fill="#f8fafc">
    <rect x="22" y="46" width="56" height="8"/>
    <rect x="19" y="30" width="10" height="40"/>
    <rect x="31" y="36" width="8" height="28"/>
    <rect x="71" y="30" width="10" height="40"/>
    <rect x="61" y="36" width="8" height="28"/>
  </g>
</svg>
`;

mkdirSync(PUBLIC_DIR, { recursive: true });
const outputs = [
  ['pwa-192x192.png', drawIcon(192, 1)],
  ['pwa-512x512.png', drawIcon(512, 1)],
  // Maskable icons must keep their art inside the middle 80% safe zone.
  ['maskable-512x512.png', drawIcon(512, 0.7)],
  ['apple-touch-icon.png', drawIcon(180, 1)],
  ['favicon.svg', Buffer.from(FAVICON_SVG, 'utf8')],
];

for (const [name, data] of outputs) {
  writeFileSync(join(PUBLIC_DIR, name), data);
  console.log(`wrote public/${name} (${data.length} bytes)`);
}
