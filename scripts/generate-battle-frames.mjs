import fs from 'fs';
import path from 'path';
import { decode as decodeJpeg } from 'jpeg-js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SPRITES = path.join(ROOT, 'public/assets/sprites');

const CHARACTERS = {
  gojo: { file: 'jjk/gojo.png', sheet: 'sprite-jjk-gojo', displayH: 150, idleMs: 150 },
  yuji: { file: 'jjk/yuji.png', sheet: 'sprite-jjk-yuji', displayH: 150, idleMs: 150 },
  megumi: { file: 'jjk/megumi.png', sheet: 'sprite-jjk-megumi', displayH: 148, idleMs: 150 },
  sukuna: { file: 'jjk/sukuna.png', sheet: 'sprite-jjk-sukuna', displayH: 152, idleMs: 150 },
  deku: { file: 'mha/deku.png', sheet: 'sprite-mha-deku', displayH: 150, idleMs: 150 },
  todoroki: { file: 'mha/todoroki.png', sheet: 'sprite-mha-todoroki', displayH: 150, idleMs: 150 },
  allmight: { file: 'mha/allmight.png', sheet: 'sprite-mha-allmight', displayH: 156, idleMs: 150 },
  shigaraki: { file: 'mha/shigaraki.png', sheet: 'sprite-mha-shigaraki', displayH: 150, idleMs: 150 },
};

function loadImage(p) {
  return decodeJpeg(fs.readFileSync(p), { useTArray: true });
}

function sampleBg(img) {
  const counts = new Map();
  for (let y = 0; y < img.height; y += 6) {
    for (let x = 0; x < img.width; x += 6) {
      const i = (img.width * y + x) * 4;
      const key = `${img.data[i] >> 4},${img.data[i + 1] >> 4},${img.data[i + 2] >> 4}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let best = '0,0,0'; let bc = 0;
  for (const [k, c] of counts) if (c > bc) { bc = c; best = k; }
  return best.split(',').map((v) => Number(v) * 16 + 8);
}

function isBg(img, x, y, bg, tol = 46) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return true;
  const i = (img.width * y + x) * 4;
  return Math.abs(img.data[i] - bg[0]) <= tol
    && Math.abs(img.data[i + 1] - bg[1]) <= tol
    && Math.abs(img.data[i + 2] - bg[2]) <= tol;
}

function rowActive(img, y, bg) {
  let n = 0;
  for (let x = 0; x < img.width; x += 1) if (!isBg(img, x, y, bg)) { n += 1; if (n > img.width * 0.015) return true; }
  return false;
}

function contentRows(img, bg) {
  const rows = [];
  let start = null;
  for (let y = 0; y < img.height; y += 1) {
    const a = rowActive(img, y, bg);
    if (a && start === null) start = y;
    if (!a && start !== null) { rows.push({ yStart: start, yEnd: y - 1, h: y - start }); start = null; }
  }
  if (start !== null) rows.push({ yStart: start, yEnd: img.height - 1, h: img.height - start });
  return rows.filter((r) => r.h >= 16 && r.h <= 64);
}

function splitFrames(img, row, bg, max = 6) {
  const { yStart, yEnd } = row;
  const col = new Array(img.width).fill(0);
  for (let y = yStart; y <= yEnd; y += 1) {
    for (let x = 0; x < img.width; x += 1) if (!isBg(img, x, y, bg)) col[x] += 1;
  }
  const thr = (yEnd - yStart + 1) * 0.12;
  const segs = [];
  let s = null;
  for (let x = 0; x <= img.width; x += 1) {
    const a = x < img.width && col[x] > thr;
    if (a && s === null) s = x;
    if (!a && s !== null) { segs.push({ x: s, w: x - s }); s = null; }
  }
  const merged = [];
  for (const seg of segs) {
    const p = merged[merged.length - 1];
    if (p && seg.x - (p.x + p.w) <= 2) p.w = seg.x + seg.w - p.x;
    else merged.push({ ...seg });
  }
  return merged
    .filter((seg) => seg.w >= 10 && seg.w <= 90)
    .slice(0, max)
    .map((seg) => {
      let minY = yEnd; let maxY = yStart;
      for (let y = yStart; y <= yEnd; y += 1) {
        for (let x = seg.x; x < seg.x + seg.w; x += 1) {
          if (!isBg(img, x, y, bg)) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
        }
      }
      return {
        x: Math.max(0, seg.x - 1),
        y: Math.max(0, minY - 1),
        w: Math.min(img.width - seg.x, seg.w + 2),
        h: Math.min(img.height - minY, maxY - minY + 3),
      };
    })
    .filter((f) => f.h >= 14);
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s[s.length >> 1];
}

function variance(arr) {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
}

function buildCharacter(meta) {
  const img = loadImage(path.join(SPRITES, meta.file));
  const bg = sampleBg(img);
  const rows = contentRows(img, bg);

  const candidates = rows
    .map((row) => ({ row, frames: splitFrames(img, row, bg, 6) }))
    .filter((c) => c.frames.length >= 2)
    .map((c) => {
      const widths = c.frames.map((f) => f.w);
      return {
        y: c.row.yStart,
        frames: c.frames,
        medW: median(widths),
        varW: variance(widths),
        count: c.frames.length,
      };
    })
    .filter((c) => c.medW <= 70);

  if (candidates.length === 0) {
    const fallback = [{ x: 0, y: 0, w: 40, h: 60 }];
    return { sheet: meta.sheet, displayH: meta.displayH, idleMs: meta.idleMs,
      idle: fallback, walk: fallback, attack: fallback, heavy: fallback, special: fallback };
  }

  const topHalf = candidates.filter((c) => c.y < img.height * 0.5);
  const idlePool = (topHalf.length ? topHalf : candidates)
    .filter((c) => c.count >= 3)
    .sort((a, b) => a.varW - b.varW);

  const idleRow = idlePool[0] ?? candidates[0];
  const order = candidates.slice().sort((a, b) => a.y - b.y);
  const idleIdx = order.findIndex((c) => c === idleRow);

  const pick = (idx) => order[Math.min(idx, order.length - 1)];
  const take4 = (c) => c.frames.slice(0, 4);

  const walkRow = pick(idleIdx + 1);
  const attackRow = pick(Math.max(idleIdx + 2, Math.floor(order.length * 0.45)));
  const heavyRow = pick(Math.min(order.length - 1, Math.floor(order.length * 0.6)));
  const lowerPool = order.filter((c) => c.y > img.height * 0.55);
  const specialRow = lowerPool.sort((a, b) => b.medW - a.medW)[0] ?? pick(order.length - 1);

  return {
    sheet: meta.sheet,
    displayH: meta.displayH,
    idleMs: meta.idleMs,
    idle: take4(idleRow),
    walk: take4(walkRow),
    attack: take4(attackRow),
    heavy: take4(heavyRow),
    special: take4(specialRow),
  };
}

const out = {};
for (const [id, meta] of Object.entries(CHARACTERS)) {
  out[id] = buildCharacter(meta);
  const i = out[id].idle[0];
  console.log(`${id}: idle@${i.y} ${out[id].idle.length}f  ${i.w}x${i.h}`);
}

const header = `/** Battle sprite frames — generated by scripts/generate-battle-frames.mjs, then hand-tunable.\n * Frames are small source-sheet sprites scaled up to displayH at render time. */`;

const body = `${header}
export const CHARACTER_SPRITES = ${JSON.stringify(out, null, 2)};

const ANIM_KEYS = ['idle', 'walk', 'attack', 'heavy', 'special', 'hit'];

export function getSpriteDef(characterId) {
  return CHARACTER_SPRITES[characterId] ?? null;
}

export function getAnimFrames(spriteDef, animName) {
  if (!spriteDef) return [];
  const data = spriteDef[animName];
  if (Array.isArray(data) && data.length > 0) return data;
  if (data && typeof data === 'object') return [data];
  if (animName === 'walk') return spriteDef.idle ?? [];
  if (animName === 'heavy') return getAnimFrames(spriteDef, 'attack');
  if (animName === 'hit') return getAnimFrames(spriteDef, 'idle').slice(0, 1);
  return spriteDef.idle ?? [];
}

export function getAnimMs(spriteDef, animName) {
  if (!spriteDef) return 130;
  if (animName === 'attack') return 70;
  if (animName === 'heavy') return 85;
  if (animName === 'special') return 90;
  if (animName === 'walk') return 90;
  if (animName === 'hit') return 100;
  return spriteDef.idleMs ?? 150;
}

export function getBattleFrameKey(characterId, animName, frameIndex = 0) {
  return \`\${characterId}-\${animName}-\${frameIndex}\`;
}

export function getFrameCrop(spriteDef, frameName, frameIndex = 0) {
  const frames = getAnimFrames(spriteDef, frameName);
  const frame = frames[frameIndex % frames.length];
  if (!frame) return null;
  return { cropX: frame.x, cropY: frame.y, cropW: frame.w, cropH: frame.h };
}

export function getAllBattleFrameRegistrations() {
  const registrations = [];
  for (const [characterId, def] of Object.entries(CHARACTER_SPRITES)) {
    for (const animName of ANIM_KEYS) {
      const frames = getAnimFrames(def, animName);
      frames.forEach((frame, index) => {
        registrations.push({ characterId, sheet: def.sheet, animName, index, frame });
      });
    }
  }
  return registrations;
}
`;

fs.writeFileSync(path.join(ROOT, 'src/data/characterSprites.js'), body);
console.log('\nWrote src/data/characterSprites.js');
