import fs from 'fs';
import path from 'path';
import { decode as decodeJpeg } from 'jpeg-js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRITES = path.join(__dirname, '../public/assets/sprites');

const FILES = {
  gojo: 'jjk/gojo.png',
  yuji: 'jjk/yuji.png',
  megumi: 'jjk/megumi.png',
  nobara: 'jjk/nobara.png',
  sukuna: 'jjk/sukuna.png',
  deku: 'mha/deku.png',
  bakugo: 'mha/bakugo.png',
  todoroki: 'mha/todoroki.png',
  allmight: 'mha/allmight.png',
  shigaraki: 'mha/shigaraki.png',
};

function loadImage(filePath) {
  const buf = fs.readFileSync(filePath);
  return decodeJpeg(buf, { useTArray: true });
}

function sampleBg(img) {
  const pts = [
    [0, 0],
    [img.width - 1, 0],
    [0, img.height - 1],
    [img.width - 1, img.height - 1],
    [Math.floor(img.width / 2), 0],
  ];
  const counts = new Map();
  for (const [x, y] of pts) {
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

function isBg(img, x, y, bg, tol = 38) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return true;
  const i = (img.width * y + x) * 4;
  return (
    Math.abs(img.data[i] - bg[0]) <= tol
    && Math.abs(img.data[i + 1] - bg[1]) <= tol
    && Math.abs(img.data[i + 2] - bg[2]) <= tol
  );
}

function rowHasContent(img, y, bg) {
  let count = 0;
  for (let x = 0; x < img.width; x += 1) {
    if (!isBg(img, x, y, bg)) count += 1;
  }
  return count > img.width * 0.015;
}

function findContentRows(img, bg) {
  const rows = [];
  let start = null;
  for (let y = 0; y < img.height; y += 1) {
    const active = rowHasContent(img, y, bg);
    if (active && start === null) start = y;
    if (!active && start !== null) {
      rows.push({ yStart: start, yEnd: y - 1, height: y - start });
      start = null;
    }
  }
  if (start !== null) rows.push({ yStart: start, yEnd: img.height - 1, height: img.height - start });
  return rows.filter((r) => r.height >= 18 && r.height <= 120);
}

function splitRowFrames(img, row, bg, maxFrames = 6) {
  const { yStart, yEnd } = row;
  const colCounts = new Array(img.width).fill(0);
  for (let y = yStart; y <= yEnd; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      if (!isBg(img, x, y, bg)) colCounts[x] += 1;
    }
  }

  const threshold = (yEnd - yStart + 1) * 0.12;
  const segments = [];
  let start = null;
  for (let x = 0; x <= img.width; x += 1) {
    const active = x < img.width && colCounts[x] > threshold;
    if (active && start === null) start = x;
    if (!active && start !== null) {
      segments.push({ x: start, w: x - start });
      start = null;
    }
  }

  const merged = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (prev && seg.x - (prev.x + prev.w) <= 2) prev.w = seg.x + seg.w - prev.x;
    else merged.push({ ...seg });
  }

  return merged
    .filter((seg) => seg.w >= 12)
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

for (const [id, rel] of Object.entries(FILES)) {
  const img = loadImage(path.join(SPRITES, rel));
  const bg = sampleBg(img);
  const rows = findContentRows(img, bg);
  console.log(`\n${id} (${img.width}x${img.height}) bg=${bg.join(',')} rows=${rows.length}`);
  rows.slice(0, 12).forEach((row, i) => {
    const frames = splitRowFrames(img, row, bg, 6);
    if (frames.length === 0) return;
    console.log(`  row${i} y=${row.yStart}-${row.yEnd} h=${row.height} frames=${frames.length}`);
    frames.forEach((f, j) => console.log(`    [${j}]`, f));
  });
}
