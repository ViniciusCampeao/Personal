/**
 * Generates the PWA icon set from the brand logo, without any image dependency.
 *
 * The source of truth is `src/assets/logo.png` (the full badge) and
 * `src/assets/logo-mark.png` (the head, cropped to a disc, for sizes where the ring
 * lettering would be mush). Both are also imported by the app itself, so the icons and
 * the on-screen brand can never drift apart. Replace those two files and re-run.
 *
 * Run with: pnpm --filter @pt/web icons
 */
import { deflateSync, inflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(HERE, '..', 'public');
const ASSETS_DIR = join(HERE, '..', 'src', 'assets');

/** Mirrors --color-surface in src/index.css: the ground every icon is flattened onto. */
const BACKGROUND = [5, 5, 6];

// -- PNG decode ---------------------------------------------------------------------
// Only what these two assets actually are: 8-bit indexed with a tRNS table, or 8-bit
// RGB/RGBA, non-interlaced. Anything else is a re-export mistake worth failing loudly on.

function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');

  let width = 0;
  let height = 0;
  let colorType = 0;
  let palette = null;
  let alphas = null;
  const idat = [];

  for (let at = 8; at < buffer.length;) {
    const length = buffer.readUInt32BE(at);
    const type = buffer.toString('ascii', at + 4, at + 8);
    const data = buffer.subarray(at + 8, at + 8 + length);
    at += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
      if (data[8] !== 8) throw new Error(`unsupported bit depth ${data[8]}`);
      if (data[12] !== 0) throw new Error('interlaced PNGs are not supported');
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') alphas = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported colour type ${colorType}`);

  const raw = unfilter(inflateSync(Buffer.concat(idat)), width, height, channels);
  const pixels = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i += 1) {
    const from = i * channels;
    const to = i * 4;
    if (colorType === 3) {
      const index = raw[from];
      pixels[to] = palette[index * 3];
      pixels[to + 1] = palette[index * 3 + 1];
      pixels[to + 2] = palette[index * 3 + 2];
      // tRNS is shorter than the palette whenever the trailing entries are opaque.
      pixels[to + 3] = alphas && index < alphas.length ? alphas[index] : 255;
    } else {
      const grey = channels <= 2;
      pixels[to] = raw[from];
      pixels[to + 1] = grey ? raw[from] : raw[from + 1];
      pixels[to + 2] = grey ? raw[from] : raw[from + 2];
      pixels[to + 3] = channels === 4 ? raw[from + 3] : channels === 2 ? raw[from + 1] : 255;
    }
  }

  return { width, height, pixels };
}

/** Reverses the per-scanline filters (PNG spec §9.2) in place, dropping the filter byte. */
function unfilter(raw, width, height, channels) {
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));

    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? out[y * stride + x - channels] : 0;
      const up = y > 0 ? out[(y - 1) * stride + x] : 0;
      const upLeft = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      let value = line[x];

      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) value += paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`unknown filter ${filter}`);

      out[y * stride + x] = value & 0xff;
    }
  }
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

// -- resample + flatten -------------------------------------------------------------

/**
 * Area-average resample onto a `size` canvas, flattened over BACKGROUND.
 *
 * `inset` shrinks the art inside the canvas — maskable icons must keep everything
 * inside the middle 80%, because the launcher is free to crop to a circle.
 *
 * Averaging happens on premultiplied values: mixing a transparent pixel's RGB into its
 * neighbours is what gives resized cut-outs their dark halo.
 */
function render(source, size, inset = 1) {
  const art = Math.round(size * inset);
  const offset = Math.floor((size - art) / 2);
  const out = Buffer.alloc(size * size * 4);

  for (let i = 0; i < size * size; i += 1) {
    out[i * 4] = BACKGROUND[0];
    out[i * 4 + 1] = BACKGROUND[1];
    out[i * 4 + 2] = BACKGROUND[2];
    out[i * 4 + 3] = 255;
  }

  const scaleX = source.width / art;
  const scaleY = source.height / art;

  for (let y = 0; y < art; y += 1) {
    for (let x = 0; x < art; x += 1) {
      const [r, g, b, a] = sampleBox(
        source,
        x * scaleX,
        (x + 1) * scaleX,
        y * scaleY,
        (y + 1) * scaleY,
      );
      const at = ((y + offset) * size + x + offset) * 4;
      const alpha = a / 255;
      out[at] = Math.round(r * alpha + BACKGROUND[0] * (1 - alpha));
      out[at + 1] = Math.round(g * alpha + BACKGROUND[1] * (1 - alpha));
      out[at + 2] = Math.round(b * alpha + BACKGROUND[2] * (1 - alpha));
      out[at + 3] = 255;
    }
  }

  return encodePng(size, out);
}

/** Mean colour of the source rectangle [x0,x1) × [y0,y1), weighted by pixel coverage. */
function sampleBox(source, x0, x1, y0, y1) {
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;
  let weight = 0;

  for (let y = Math.floor(y0); y < Math.min(Math.ceil(y1), source.height); y += 1) {
    const coverY = Math.min(y + 1, y1) - Math.max(y, y0);
    if (coverY <= 0) continue;

    for (let x = Math.floor(x0); x < Math.min(Math.ceil(x1), source.width); x += 1) {
      const coverX = Math.min(x + 1, x1) - Math.max(x, x0);
      if (coverX <= 0) continue;

      const at = (y * source.width + x) * 4;
      const a = source.pixels[at + 3] / 255;
      const w = coverX * coverY;
      red += source.pixels[at] * a * w;
      green += source.pixels[at + 1] * a * w;
      blue += source.pixels[at + 2] * a * w;
      alpha += a * w;
      weight += w;
    }
  }

  if (alpha === 0) return [0, 0, 0, 0];
  // Un-premultiply: the colour is the average of what was actually opaque.
  return [red / alpha, green / alpha, blue / alpha, (alpha / weight) * 255];
}

// -- PNG encode ---------------------------------------------------------------------

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

// -- outputs ------------------------------------------------------------------------

const badge = decodePng(readFileSync(join(ASSETS_DIR, 'logo.png')));
const mark = decodePng(readFileSync(join(ASSETS_DIR, 'logo-mark.png')));

mkdirSync(PUBLIC_DIR, { recursive: true });
const outputs = [
  ['pwa-192x192.png', render(badge, 192)],
  ['pwa-512x512.png', render(badge, 512)],
  // Maskable icons must keep their art inside the middle 80% safe zone.
  ['maskable-512x512.png', render(badge, 512, 0.78)],
  ['apple-touch-icon.png', render(badge, 180)],
  // A browser tab is 16–32px: the ring lettering is illegible there, the head is not.
  ['favicon-32x32.png', render(mark, 32)],
  ['favicon-192x192.png', render(mark, 192)],
];

for (const [name, data] of outputs) {
  writeFileSync(join(PUBLIC_DIR, name), data);
  console.log(`wrote public/${name} (${data.length} bytes)`);
}
