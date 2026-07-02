import fs from 'fs';
import path from 'path';
import { decode as decodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SPRITES_DIR = path.join(ROOT, 'public/assets/sprites');

const CHARACTERS = {
  gojo: { file: 'jjk/gojo.png', sheet: 'sprite-jjk-gojo', displayH: 150, idleMs: 130 },
  yuji: { file: 'jjk/yuji.png', sheet: 'sprite-jjk-yuji', displayH: 150, idleMs: 120 },
  megumi: { file: 'jjk/megumi.png', sheet: 'sprite-jjk-megumi', displayH: 145, idleMs: 140 },
  nobara: { file: 'jjk/nobara.png', sheet: 'sprite-jjk-nobara', displayH: 145, idleMs: 125 },
  sukuna: { file: 'jjk/sukuna.png', sheet: 'sprite-jjk-sukuna', displayH: 150, idleMs: 120 },
  deku: { file: 'mha/deku.png', sheet: 'sprite-mha-deku', displayH: 150, idleMs: 120 },
  bakugo: { file: 'mha/bakugo.png', sheet: 'sprite-mha-bakugo', displayH: 150, idleMs: 110 },
  todoroki: { file: 'mha/todoroki.png', sheet: 'sprite-mha-todoroki', displayH: 148, idleMs: 130 },
  allmight: { file: 'mha/allmight.png', sheet: 'sprite-mha-allmight', displayH: 155, idleMs: 140 },
  shigaraki: { file: 'mha/shigaraki.png', sheet: 'sprite-mha-shigaraki', displayH: 148, idleMs: 125 },
};

function loadImage(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const decoded = decodeJpeg(buf, { useTArray: true });
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  }
  return new Promise((resolve, reject) => {
    new PNG().parse(buf, (err, png) => {
      if (err) reject(err);
      else resolve(png);
    });
  });
}

function sampleBg(img) {
  const corners = [
    [0, 0],
    [img.width - 1, 0],
    [0, img.height - 1],
    [img.width - 1, img.height - 1],
    [Math.floor(img.width / 2), 0],
  ];
  const counts = new Map();
  for (const [x, y] of corners) {
    const i = (img.width * y + x) * 4;
    const key = `${img.data[i]},${img.data[i + 1]},${img.data[i + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = [0, 0, 0];
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = key.split(',').map(Number);
    }
  }
  return best;
}

function isBg(img, x, y, bg, tol = 36) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return true;
  const i = (img.width * y + x) * 4;
  return (
    Math.abs(img.data[i] - bg[0]) <= tol
    && Math.abs(img.data[i + 1] - bg[1]) <= tol
    && Math.abs(img.data[i + 2] - bg[2]) <= tol
  );
}

function rowContent(img, y, bg) {
  let minX = img.width;
  let maxX = -1;
  let count = 0;
  for (let x = 0; x < img.width; x += 1) {
    if (!isBg(img, x, y, bg)) {
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }
  return { count, minX, maxX, span: maxX >= minX ? maxX - minX + 1 : 0 };
}

function findIdleRow(img, bg) {
  const bands = [];
  for (let y = 0; y < img.height; y += 1) {
    const row = rowContent(img, y, bg);
    if (row.count > img.width * 0.02) bands.push({ y, ...row });
  }
  if (bands.length === 0) return null;

  const rows = [];
  let current = null;
  for (const band of bands) {
    if (!current || band.y - current.yEnd > 3) {
      if (current) rows.push(current);
      current = { yStart: band.y, yEnd: band.y, minX: band.minX, maxX: band.maxX, pixels: band.count };
    } else {
      current.yEnd = band.y;
      current.minX = Math.min(current.minX, band.minX);
      current.maxX = Math.max(current.maxX, band.maxX);
      current.pixels += band.count;
    }
  }
  if (current) rows.push(current);

  const candidates = rows
    .map((row) => ({
      ...row,
      height: row.yEnd - row.yStart + 1,
      width: row.maxX - row.minX + 1,
    }))
    .filter((row) => row.height >= 8 && row.height <= 120 && row.width >= 30);

  const upper = candidates.filter((row) => row.yStart < img.height * 0.45);
  const pool = upper.length ? upper : candidates;

  pool.sort((a, b) => {
    const densityA = a.pixels / (a.height * a.width);
    const densityB = b.pixels / (b.height * b.width);
    if (Math.abs(densityA - densityB) > 0.05) return densityB - densityA;
    return a.yStart - b.yStart;
  });

  return pool[0] ?? candidates[0] ?? null;
}

function splitRowIntoFrames(img, row, bg, maxFrames = 4) {
  const yStart = row.yStart;
  const yEnd = row.yEnd;
  const height = yEnd - yStart + 1;

  const colCounts = new Array(img.width).fill(0);
  for (let y = yStart; y <= yEnd; y += 1) {
    for (let x = row.minX; x <= row.maxX; x += 1) {
      if (!isBg(img, x, y, bg)) colCounts[x] += 1;
    }
  }

  const segments = [];
  let start = null;
  for (let x = row.minX; x <= row.maxX + 1; x += 1) {
    const active = x <= row.maxX && colCounts[x] > height * 0.15;
    if (active && start === null) start = x;
    if (!active && start !== null) {
      segments.push({ x: start, w: x - start });
      start = null;
    }
  }

  if (segments.length === 0) return [];

  const merged = [segments[0]];
  for (let i = 1; i < segments.length; i += 1) {
    const prev = merged[merged.length - 1];
    const seg = segments[i];
    if (seg.x - (prev.x + prev.w) <= 4) prev.w = seg.x + seg.w - prev.x;
    else merged.push(seg);
  }

  return merged
    .filter((seg) => seg.w >= 8)
    .slice(0, maxFrames)
    .map((seg) => {
      let minY = yEnd;
      let maxY = yStart;
      for (let y = yStart; y <= yEnd; y += 1) {
        for (let x = seg.x; x < seg.x + seg.w; x += 1) {
          if (!isBg(img, x, y, bg)) {
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }
      const pad = 1;
      return {
        x: Math.max(0, seg.x - pad),
        y: Math.max(0, minY - pad),
        w: Math.min(img.width - seg.x, seg.w + pad * 2),
        h: Math.min(img.height - minY, maxY - minY + 1 + pad * 2),
      };
    });
}

function findAttackFrame(img, bg, idleRow) {
  const startY = idleRow ? idleRow.yEnd + 8 : Math.floor(img.height * 0.15);
  for (let y = startY; y < Math.min(img.height * 0.55, img.height - 20); y += 1) {
    const row = rowContent(img, y, bg);
    if (row.span > 20 && row.span < img.width * 0.35) {
      const frames = splitRowIntoFrames(
        img,
        { yStart: y, yEnd: Math.min(y + 50, img.height - 1), minX: row.minX, maxX: row.maxX },
        bg,
        1,
      );
      if (frames[0]) return frames[0];
    }
  }
  return idleRow
    ? { x: idleRow.minX, y: idleRow.yStart, w: 50, h: idleRow.height }
    : { x: 0, y: 0, w: 48, h: 72 };
}

async function detectCharacter(id, meta) {
  const filePath = path.join(SPRITES_DIR, meta.file);
  const img = await loadImage(filePath);
  const bg = sampleBg(img);
  const idleRow = findIdleRow(img, bg);
  const idle = idleRow ? splitRowIntoFrames(img, idleRow, bg, 4) : [];
  const attack = findAttackFrame(img, bg, idleRow);

  console.log(`${id}: ${img.width}x${img.height} bg=${bg} idleFrames=${idle.length} row@${idleRow?.yStart}`);
  idle.forEach((f, i) => console.log(`  idle[${i}]`, f));

  return {
    sheet: meta.sheet,
    displayH: meta.displayH,
    idleMs: meta.idleMs,
    idle: idle.length ? idle : [{ x: 0, y: 0, w: 48, h: 72 }],
    attack,
    special: attack,
  };
}

async function main() {
  const write = process.argv.includes('--write');
  const out = {};
  for (const [id, meta] of Object.entries(CHARACTERS)) {
    out[id] = await detectCharacter(id, meta);
  }

  if (!write) {
    console.log('\nDry run only. Pass --write to overwrite src/data/characterSprites.js');
    return;
  }

  const lines = [
    '/** Auto-detected sprite sheet frame data — run: node scripts/detect-sprite-frames.mjs */',
    'export const CHARACTER_SPRITES = ' + JSON.stringify(out, null, 2).replace(/"([^"]+)":/g, '$1:') + ';',
    '',
    'export function getSpriteDef(characterId) {',
    '  return CHARACTER_SPRITES[characterId] ?? null;',
    '}',
    '',
    'export function getFrameCrop(spriteDef, frameName, frameIndex = 0) {',
    '  if (!spriteDef) return null;',
    '  if (frameName === \'idle\') {',
    '    const frames = spriteDef.idle;',
    '    const frame = frames[frameIndex % frames.length];',
    '    return { cropX: frame.x, cropY: frame.y, cropW: frame.w, cropH: frame.h };',
    '  }',
    '  const frame = spriteDef[frameName];',
    '  if (!frame) return getFrameCrop(spriteDef, \'idle\', 0);',
    '  return { cropX: frame.x, cropY: frame.y, cropW: frame.w, cropH: frame.h };',
    '}',
    '',
    'export function getFrameName(characterId, frameName, frameIndex = 0) {',
    '  if (frameName === \'idle\') return `${characterId}-idle-${frameIndex % 4}`;',
    '  return `${characterId}-${frameName}`;',
    '}',
    '',
  ];

  fs.writeFileSync(path.join(ROOT, 'src/data/characterSprites.js'), lines.join('\n'));
  console.log('\nWrote src/data/characterSprites.js');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
