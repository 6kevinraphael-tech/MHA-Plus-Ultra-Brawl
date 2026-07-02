/**
 * Background cutout for character art with solid backgrounds.
 *
 * Uses edge flood-fill (not a global color key) so it removes ONLY the
 * background-connected region — interior costume/gloves that happen to match
 * the background color are preserved. Then feathers the edge, despills, and
 * auto-crops to the content bounding box.
 *
 * Edit JOBS below and run:  node scripts/cutout.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { PNG } from 'pngjs';
import jpegPkg from 'jpeg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = '/Users/kevvver/.cursor/projects/Users-kevvver-Projects-cursed-clash/assets';
const OUT = path.join(ROOT, 'public/assets/sprites');

const JOBS = [
  { src: 'Shigaraki-af183b64-c318-4b43-86b2-2d0ea3d5d8c0.png', out: 'mha/shigaraki/idle.png', tol: 48 },
  { src: 'chara_l_1181001_01-5f4cd21d-c36a-41b2-9a17-9d30cb9d049c.png', out: 'mha/shigaraki/attack.png', tol: 52 },
  { src: 'chara_l_1181002_01-71a42616-1ef3-4c5e-bdb1-be8b12255fea.png', out: 'mha/shigaraki/special.png', tol: 52 },
  { src: 'Shigaraki__1_-f10ab77c-9412-46af-a081-4061f12e3382.png', out: 'mha/shigaraki/awaken-idle.png', tol: 48 },
  { src: 'dk8h2me-985af49e-9e12-4998-919a-c84e0e9b41d0__1_-febd2276-e265-4586-82d3-6cb0a212be95.png', out: 'mha/shigaraki/awaken-attack.png', tol: 48 },
  { src: 'images__8_-e2be3d6f-87f2-4884-819d-9b045bf3ec03.png', out: 'mha/deku/awaken-idle.png', tol: 42 },
  { src: 'ddm6zm0-66fbc535-2b25-47a9-8456-479468c334ba-18aba29e-e6f9-4810-b46d-24c2763c331c.png', out: 'mha/deku/idle.png', tol: 42 },
  { src: 'images__16_-e2c95024-eec3-4d58-83c2-f76b7ab4f64e.png', out: 'mha/deku/attack.png', tol: 54 },
  { src: 'all-might-izuku-midoriya-my-hero-academia-vol-3-heros-a64f48d4-618e-45b3-aa2d-f63fcc8d549b.png', out: 'mha/allmight/idle.png', tol: 42 },
  { src: 'All-Might-PNG-72b16ca5-4fc8-44ab-b063-a67f34632d2c.png', out: 'mha/allmight/attack.png', tol: 44 },
  { src: 'All-Might-PNG-Photos__2_-18772e19-e968-4fb8-a1ae-e10964959267.png', out: 'mha/allmight/heavy.png', tol: 44 },
  { src: 'dh9ahqi-7c01068a-8abd-4936-81cb-d14495b597b4-8a7edaf7-41a8-4ab1-9a6f-316900762dc6.png', out: 'mha/allmight/special.png', tol: 42 },
  { src: 'dark-deku-fanart-by-me-v0-0a0foliaot1b1-d5962cb3-4e4a-4416-8210-2143a6b99079.png', out: 'mha/deku/awaken-attack.png', tol: 48 },
  { src: '8dcd7d2caf48e3f596859186f2aa8e5f-b7d8bec9-7675-4539-ad36-803f389867f7.png', out: 'mha/deku/awaken-special.png', tol: 44 },
  { src: 'images__9_-609e34de-4063-4055-ada7-4904024f8146.png', out: 'mha/deku/awaken-transform.png', tol: 40 },
  { src: 'all_for_one_artwork_28all27s_justice29_58-4a3767c0-21bc-4aeb-be33-433e1f1e2f97.png', out: 'mha/allforone/idle.png', tol: 48 },
  { src: 'chara_l_1194002_00-b6d688f8-b2ff-40e8-a29e-ba6e4a5cb984.png', out: 'mha/allforone/attack.png', tol: 50 },
  { src: 'images__10_-6ea14ce4-eab3-414c-92d0-4c7ca4b04ea9.png', out: 'mha/allforone/heavy.png', tol: 48 },
  { src: 'T_ui_Skill_Ch016_Unique1-b3f9f20e-c285-4d00-80df-ed844e509d69.png', out: 'mha/allforone/special.png', tol: 42 },
  { src: 'Dabi_Anime_Action_2-49975218-aa20-4d43-8303-28a0fffc9260.png', out: 'mha/dabi/idle.png', tol: 54 },
  { src: 'T_ui_Thumb_13_1700_LL-66a66581-c6fd-41da-a90b-bb3863c1e169.png', out: 'mha/dabi/attack.png', tol: 58 },
  { src: 'images__11_-757ac68c-4f3c-469c-b909-c9dddf76dda3.png', out: 'mha/dabi/heavy.png', tol: 56 },
  { src: 'chara_l_1185003_00-c51fd969-3a3f-4c83-947d-d70d769c5043.png', out: 'mha/dabi/special.png', tol: 50 },
  { src: 'images__12_-5688c98e-7c2a-4a64-99f6-7a6aeb4f7aa8.png', out: 'mha/dabi/awaken-idle.png', tol: 42 },
  { src: 'chara_l_1185003_00-c51fd969-3a3f-4c83-947d-d70d769c5043.png', out: 'mha/dabi/awaken-attack.png', tol: 58 },
  { src: 'images__11_-757ac68c-4f3c-469c-b909-c9dddf76dda3.png', out: 'mha/dabi/awaken-heavy.png', tol: 56 },
  { src: 'images__12_-5688c98e-7c2a-4a64-99f6-7a6aeb4f7aa8.png', out: 'mha/dabi/awaken-special.png', tol: 42 },
  { src: 'images__12_-5688c98e-7c2a-4a64-99f6-7a6aeb4f7aa8.png', out: 'mha/dabi/awaken-transform.png', tol: 40 },
  { src: 'images__13_-6470778a-8de0-49ee-a1e6-adaabe530507.png', out: 'mha/stain/idle.png', tol: 48 },
  { src: 'images__14_-c2609b17-a79a-49e3-8cea-1ccd2c268e36.png', out: 'mha/stain/attack.png', tol: 50 },
  { src: 'def6b8e174f9176c1bed3f2968603431-97d00812-a2d1-4359-bc2a-2fc676a93376.png', out: 'mha/stain/heavy.png', tol: 48 },
  { src: 'tumblr_208c029135802cc73778345a7acc2601_a8e02613_640-81d725ea-fda4-4255-9c1e-a79c7287cfa2.png', out: 'mha/stain/special.png', tol: 44 },
  { src: '1807036_a7f39-c6e624b9-4b23-4551-a57c-db4333223c46.png', out: 'mha/todoroki/special.png', tol: 54 },
  { src: '5a13307d2e3046cec321eaf55c2ed556-89be5cab-0964-4dc1-b90a-0996ebe88418.png', out: 'mha/bakugo/idle.png', tol: 48 },
  { src: 'Dynamight-6071dc1f-83cf-490f-8f73-ddcd1356666f.png', out: 'mha/bakugo/attack.png', tol: 48 },
  { src: '910fb1fe18d864fae8e1ce53e515e73a-60f118eb-fa04-4a44-a754-86e1c9e191f8.png', out: 'mha/bakugo/heavy.png', tol: 50 },
  { src: 'Katsuki_Bakugo-ca99e645-d627-48ad-8dc2-e57928850ff4.png', out: 'mha/bakugo/special.png', tol: 44 },
  { src: 'Twice_TV_Animation_Design-752a686a-b704-4f0a-a707-8daaacb6f9dc.png', out: 'mha/twice/idle.png', tol: 48 },
  { src: 'My_Hero_Ultra_Impact_-_Character_Art_-_Twice_-_Resolution_-_1-e05687e3-5771-4fc4-a201-fa2d4fdf8148.png', out: 'mha/twice/attack.png', tol: 50 },
  { src: 'images__15_-37863595-7aee-4ebe-af67-38cc4b58e42d.png', out: 'mha/twice/heavy.png', tol: 48 },
  { src: '480px-Npc_zoom_3993400000_01-c970741b-df84-45b7-b78b-634b1dcb81eb.png', out: 'mha/twice/special.png', tol: 48 },
  { src: 'Ochako_Hero_Costume-89878467-4413-4fe8-82ae-1131cfd0d8ae.png', out: 'mha/uraraka/idle.png', tol: 48 },
  { src: 'ochaco_uraraka_by_leozurc2210_de3242i-fullview-5b5f242b-e066-45c9-9691-197eff3e4b18.png', out: 'mha/uraraka/attack.png', tol: 44 },
  { src: 'Ochako_Hero_Costume-89878467-4413-4fe8-82ae-1131cfd0d8ae.png', out: 'mha/uraraka/heavy.png', tol: 48 },
  { src: 'deiag0n-33b1e94e-3c73-4bcd-8075-741830f78f4d-2c6bde4c-bb2d-44fb-9b7f-1a518c85e1b9.png', out: 'mha/uraraka/special.png', tol: 48 },
];

function load(file) {
  const full = path.join(SRC, file);
  let buf = fs.readFileSync(full);
  // WEBP → PNG via macOS sips
  if (buf[0] === 0x52 && buf[1] === 0x49) {
    const tmpIn = path.join('/tmp', `cutout-in-${path.basename(file)}.webp`);
    const tmpOut = path.join('/tmp', `cutout-out-${path.basename(file)}.png`);
    fs.writeFileSync(tmpIn, buf);
    execFileSync('sips', ['-s', 'format', 'png', tmpIn, '--out', tmpOut], { stdio: 'ignore' });
    buf = fs.readFileSync(tmpOut);
  }
  if (buf[0] === 0x89) {
    const p = PNG.sync.read(buf, { checkCRC: false });
    return { w: p.width, h: p.height, data: Uint8ClampedArray.from(p.data) };
  }
  const j = jpegPkg.decode(buf, { useTArray: true });
  return { w: j.width, h: j.height, data: Uint8ClampedArray.from(j.data) };
}

function dist(data, i, bg) {
  const dr = data[i] - bg[0];
  const dg = data[i + 1] - bg[1];
  const db = data[i + 2] - bg[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function isLightBackdrop(bg) {
  return (bg[0] + bg[1] + bg[2]) / 3 > 200;
}

/** Edge flood for white/gray studio PNGs — tight crop, no dark-costume issue. */
function buildLightBackdropMask(data, w, h, bg, tol) {
  const total = w * h;
  const isBg = new Uint8Array(total);
  const stack = [];

  const pushIf = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (isBg[p]) return;
    if (dist(data, p * 4, bg) <= tol) { isBg[p] = 1; stack.push(p); }
  };

  for (let x = 0; x < w; x += 1) { pushIf(x, 0); pushIf(x, h - 1); }
  for (let y = 0; y < h; y += 1) { pushIf(0, y); pushIf(w - 1, y); }

  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p - x) / w;
    pushIf(x + 1, y); pushIf(x - 1, y); pushIf(x, y + 1); pushIf(x, y - 1);
  }

  const fg = new Uint8Array(total);
  for (let p = 0; p < total; p += 1) {
    if (!isBg[p]) fg[p] = 1;
  }
  return fg;
}

/** Grow from vivid core pixels so black costumes stay attached on dark backdrops. */
function buildDarkBackdropMask(data, w, h, bg, tol) {
  const total = w * h;
  const core = new Uint8Array(total);
  const fg = new Uint8Array(total);
  const coreTol = tol * 0.38;

  for (let p = 0; p < total; p += 1) {
    if (dist(data, p * 4, bg) > coreTol) core[p] = 1;
  }

  fg.set(core);
  const dilatePasses = Math.max(16, Math.round(Math.min(w, h) * 0.045));
  for (let pass = 0; pass < dilatePasses; pass += 1) {
    const snap = Uint8Array.from(fg);
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const p = y * w + x;
        if (snap[p]) continue;
        if (dist(data, p * 4, bg) > tol * 1.08) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!dx && !dy) continue;
            if (snap[(y + dy) * w + (x + dx)]) { near = true; break; }
          }
        }
        if (near) fg[p] = 1;
      }
    }
  }
  return fg;
}

function cutout({ w, h, data }, tol) {
  // background reference = average of the four corners
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
  const bg = [0, 0, 0];
  for (const c of corners) { bg[0] += data[c]; bg[1] += data[c + 1]; bg[2] += data[c + 2]; }
  bg[0] /= 4; bg[1] /= 4; bg[2] /= 4;

  const fg = isLightBackdrop(bg)
    ? buildLightBackdropMask(data, w, h, bg, tol)
    : buildDarkBackdropMask(data, w, h, bg, tol);

  applyMatteAndFeather(data, w, h, fg, bg, tol);

  pruneForegroundBlobs(data, w, h);
  fillInteriorHoles(data, w, h, 48);

  // bounding box of opaque content
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }

  if (minX <= maxX) {
    solidifySilhouette(data, w, h, minX, minY, maxX, maxY, 5);
    fillInteriorHoles(data, w, h, 32);
    enforceInteriorOpaque(data, w, h, fg);
  }

  // recompute bounds after solidify
  minX = w; minY = h; maxX = 0; maxY = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const pad = 1;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const out = new PNG({ width: cw, height: ch });
  for (let y = 0; y < ch; y += 1) {
    for (let x = 0; x < cw; x += 1) {
      const si = ((minY + y) * w + (minX + x)) * 4;
      const di = (y * cw + x) * 4;
      out.data[di] = data[si];
      out.data[di + 1] = data[si + 1];
      out.data[di + 2] = data[si + 2];
      out.data[di + 3] = data[si + 3];
    }
  }
  return { png: out, cw, ch, bg };
}

/** Solid interior, soft anti-aliased outer edge only. */
function applyMatteAndFeather(data, w, h, fg, bg, tol) {
  const total = w * h;
  const feather = tol * 0.5;

  for (let p = 0; p < total; p += 1) {
    const i = p * 4;
    if (!fg[p]) {
      data[i + 3] = 0;
      continue;
    }

    const x = p % w;
    const y = (p - x) / w;
    const onEdge = x === 0 || x === w - 1 || y === 0 || y === h - 1
      || !fg[p - 1] || !fg[p + 1] || !fg[p - w] || !fg[p + w];

    if (!onEdge) {
      data[i + 3] = 255;
      continue;
    }

    const d = dist(data, i, bg);
    const t = Math.min(1, d / feather);
    data[i + 3] = Math.round(140 + t * 115);
  }
}

/** Keep body pixels fully opaque without hardening the silhouette fringe. */
function enforceInteriorOpaque(data, w, h, fg) {
  const total = w * h;
  for (let p = 0; p < total; p += 1) {
    if (!fg[p]) continue;
    const x = p % w;
    const y = (p - x) / w;
    const onEdge = x === 0 || x === w - 1 || y === 0 || y === h - 1
      || !fg[p - 1] || !fg[p + 1] || !fg[p - w] || !fg[p + w];
    if (onEdge) continue;
    if (data[p * 4 + 3] > 24) data[p * 4 + 3] = 255;
  }
}

/** Remove small disconnected alpha blobs while keeping the main figure + flame VFX. */
function pruneForegroundBlobs(data, w, h, alphaMin = 28) {
  const total = w * h;
  const visited = new Uint8Array(total);
  const blobs = [];

  for (let p = 0; p < total; p += 1) {
    if (visited[p] || data[p * 4 + 3] < alphaMin) continue;

    const queue = [p];
    visited[p] = 1;
    let area = 0;
    let hasBright = false;
    let hasBlue = false;
    const pixels = [];

    while (queue.length) {
      const cur = queue.pop();
      area += 1;
      pixels.push(cur);
      const i = cur * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r + g + b > 165) hasBright = true;
      if (b > 85 && b > r + 18) hasBlue = true;

      const x = cur % w;
      const y = (cur - x) / w;
      if (x > 0) {
        const np = cur - 1;
        if (!visited[np] && data[np * 4 + 3] >= alphaMin) { visited[np] = 1; queue.push(np); }
      }
      if (x < w - 1) {
        const np = cur + 1;
        if (!visited[np] && data[np * 4 + 3] >= alphaMin) { visited[np] = 1; queue.push(np); }
      }
      if (y > 0) {
        const np = cur - w;
        if (!visited[np] && data[np * 4 + 3] >= alphaMin) { visited[np] = 1; queue.push(np); }
      }
      if (y < h - 1) {
        const np = cur + w;
        if (!visited[np] && data[np * 4 + 3] >= alphaMin) { visited[np] = 1; queue.push(np); }
      }
    }

    blobs.push({ area, hasBright, hasBlue, pixels });
  }

  if (blobs.length <= 1) return;

  blobs.sort((a, b) => b.area - a.area);
  const maxArea = blobs[0].area;
  const keep = new Set([0]);

  blobs.forEach((blob, idx) => {
    if (idx === 0) return;
    if (blob.hasBlue || blob.hasBright) keep.add(idx);
    if (blob.area > maxArea * 0.06) keep.add(idx);
  });

  blobs.forEach((blob, idx) => {
    if (keep.has(idx)) return;
    for (const p of blob.pixels) data[p * 4 + 3] = 0;
  });
}

/** Fill peppered transparent gaps inside the figure silhouette. */
function solidifySilhouette(data, w, h, minX, minY, maxX, maxY, passes = 4) {
  for (let pass = 0; pass < passes; pass += 1) {
    const snap = Uint8ClampedArray.from(data);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const p = y * w + x;
        if (snap[p * 4 + 3] > 128) continue;

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < minX || ny < minY || nx > maxX || ny > maxY) continue;
            const ni = (ny * w + nx) * 4;
            if (snap[ni + 3] < 180) continue;
            r += snap[ni];
            g += snap[ni + 1];
            b += snap[ni + 2];
            count += 1;
          }
        }

        if (count < 5) continue;
        const i = p * 4;
        data[i] = Math.round(r / count);
        data[i + 1] = Math.round(g / count);
        data[i + 2] = Math.round(b / count);
        data[i + 3] = 255;
      }
    }
  }
}

/** Fill transparent pixels enclosed by the figure (fixes dark-clothing punch-through). */
function fillInteriorHoles(data, w, h, clearMax = 16) {
  const total = w * h;
  const outside = new Uint8Array(total);
  const stack = [];

  const pushClear = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (outside[p]) return;
    if (data[p * 4 + 3] > clearMax) return;
    outside[p] = 1;
    stack.push(p);
  };

  for (let x = 0; x < w; x += 1) {
    pushClear(x, 0);
    pushClear(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    pushClear(0, y);
    pushClear(w - 1, y);
  }

  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p - x) / w;
    pushClear(x + 1, y);
    pushClear(x - 1, y);
    pushClear(x, y + 1);
    pushClear(x, y - 1);
  }

  for (let p = 0; p < total; p += 1) {
    if (data[p * 4 + 3] > clearMax || outside[p]) continue;

    const x = p % w;
    const y = (p - x) / w;
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;

    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = (ny * w + nx) * 4;
        if (data[ni + 3] < 180) continue;
        r += data[ni];
        g += data[ni + 1];
        b += data[ni + 2];
        count += 1;
      }
    }

    if (!count) continue;
    const i = p * 4;
    data[i] = Math.round(r / count);
    data[i + 1] = Math.round(g / count);
    data[i + 2] = Math.round(b / count);
    data[i + 3] = 255;
  }
}

for (const job of JOBS) {
  const img = load(job.src);
  const { png, cw, ch, bg } = cutout(img, job.tol ?? 48);
  const outPath = path.join(OUT, job.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, PNG.sync.write(png));
  console.log(`${job.out}  ${img.w}x${img.h} -> ${cw}x${ch}  bg=[${bg.map((n) => Math.round(n)).join(',')}]`);
}

function loadPng(file) {
  const p = PNG.sync.read(fs.readFileSync(file));
  return { w: p.width, h: p.height, data: Uint8ClampedArray.from(p.data) };
}

/** Flatten existing cutout PNG onto black so re-cutout can detect the backdrop. */
function compositeOnBlack({ w, h, data }) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p += 1) {
    const i = p * 4;
    const a = data[i + 3] / 255;
    out[i] = Math.round(data[i] * a);
    out[i + 1] = Math.round(data[i + 1] * a);
    out[i + 2] = Math.round(data[i + 2] * a);
    out[i + 3] = 255;
  }
  return { w, h, data: out };
}

function walkPngs(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkPngs(p, files);
    else if (ent.name.endsWith('.png')) files.push(p);
  }
  return files;
}

const jobOuts = new Set(JOBS.map((j) => path.join(OUT, j.out)));
const mhaRoot = path.join(OUT, 'mha');
if (fs.existsSync(mhaRoot)) {
  for (const outPath of walkPngs(mhaRoot)) {
    if (jobOuts.has(outPath)) continue;
    try {
      const flat = compositeOnBlack(loadPng(outPath));
      const { png, cw, ch } = cutout(flat, 48);
      fs.writeFileSync(outPath, PNG.sync.write(png));
      console.log(`[in-place] ${path.relative(OUT, outPath)} -> ${cw}x${ch}`);
    } catch (e) {
      console.warn(`[skip] ${path.relative(OUT, outPath)}: ${e.message}`);
    }
  }
}
