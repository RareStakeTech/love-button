/**
 * Generates minimal PNG icons for the Love Button extension.
 * Run once: node gen-icons.js
 * Requires only Node.js built-ins (zlib + fs).
 */

const fs   = require('fs');
const zlib = require('zlib');
const path = require('path');

const outDir = path.join(__dirname, 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

// ── Minimal PNG writer ────────────────────────────────────────────────────────

function uint32BE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function crc32(buf) {
  const table = crc32.table || buildCrcTable();
  crc32.table = table;
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}

function buildCrcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = uint32BE(data.length);
  const crc = uint32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([len, typeBytes, data, crc]);
}

function makePNG(size, r, g, b) {
  const PNG_SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);

  // IHDR: width, height, 8-bit, RGB colour type 2
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type RGB
  // bytes 10-12 are 0 (compression, filter, interlace)

  // Raw scanlines: filter byte (0) + RGB per pixel
  const rowLen = 1 + size * 3;
  const raw = Buffer.alloc(size * rowLen);
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const base = y * rowLen + 1 + x * 3;

      // Draw a simple red-on-dark icon:
      // Outer ring: #CC1111 (red), interior: #080808 (near-black),
      // central "R" shape drawn with red pixels.
      const cx = size / 2, cy = size / 2;
      const dx = x - cx + 0.5, dy = y - cy + 0.5;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const outerR = size * 0.47, innerR = size * 0.32;

      let pr = 0x08, pg = 0x08, pb = 0x08; // bg

      if (dist >= innerR && dist <= outerR) {
        pr = r; pg = g; pb = b; // ring
      } else if (dist < innerR) {
        // Simple letter-like mark: a cross/dot pattern
        const nx = dx / innerR, ny = dy / innerR;
        if (Math.abs(nx) < 0.25 || (ny < 0 && Math.abs(ny) < 0.25 && nx > -0.55)) {
          pr = r; pg = g; pb = b;
        }
      }

      raw[base]     = pr;
      raw[base + 1] = pg;
      raw[base + 2] = pb;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idat = chunk('IDAT', compressed);

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    idat,
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Generate icons ────────────────────────────────────────────────────────────

const sizes = [16, 48, 128];
const RED = [0xCC, 0x11, 0x11];

for (const size of sizes) {
  const png = makePNG(size, ...RED);
  const filePath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Written: ${filePath} (${png.length} bytes)`);
}

console.log('Done. Icons are ready in the icons/ directory.');
