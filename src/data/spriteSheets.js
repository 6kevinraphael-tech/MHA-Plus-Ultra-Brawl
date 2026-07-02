import Phaser from 'phaser';

export function applySmoothFilter(scene, sheetKey) {
  const tex = scene.textures.get(sheetKey);
  if (tex) {
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}

/** Force character PNGs fully opaque at runtime (fixes faded / holey cutouts). */
export function solidifyCharacterImageAlpha(scene, sheetKey) {
  if (!scene.textures.exists(sheetKey)) return;

  const tex = scene.textures.get(sheetKey);
  const src = tex.getSourceImage?.() ?? tex.source?.[0]?.image;
  if (!src) return;

  const w = src.width ?? src.naturalWidth;
  const h = src.height ?? src.naturalHeight;
  if (!w || !h) return;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);

  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  const total = w * h;

  for (let p = 0; p < total; p += 1) {
    const i = p * 4;
    const a = data[i + 3];
    if (a < 10) data[i + 3] = 0;
    else if (a >= 250) data[i + 3] = 255;
  }

  const outside = new Uint8Array(total);
  const stack = [];
  const pushClear = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (outside[p] || data[p * 4 + 3] > 16) return;
    outside[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x += 1) { pushClear(x, 0); pushClear(x, h - 1); }
  for (let y = 0; y < h; y += 1) { pushClear(0, y); pushClear(w - 1, y); }
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
    if (data[p * 4 + 3] > 16 || outside[p]) continue;
    const x = p % w;
    const y = (p - x) / w;
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = (ny * w + nx) * 4;
        if (data[ni + 3] < 200) continue;
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

  ctx.putImageData(image, 0, 0);
  scene.textures.remove(sheetKey);
  const baked = scene.textures.addCanvas(sheetKey, canvas);
  if (baked) baked.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

function dominantColor(data, w, h) {
  const counts = new Map();
  for (let y = 0; y < h; y += 6) {
    for (let x = 0; x < w; x += 6) {
      const i = (y * w + x) * 4;
      const key = `${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let best = '0,0,0';
  let bc = 0;
  for (const [k, c] of counts) {
    if (c > bc) { bc = c; best = k; }
  }
  return best.split(',').map((v) => Number(v) * 16 + 8);
}

/**
 * Replace a JPEG sprite sheet's flat/green background with transparency so
 * fighters render cleanly (no colored box). Rebuilds the texture as a canvas.
 */
export function makeSheetTransparent(scene, sheetKey) {
  if (!scene.textures.exists(sheetKey)) return;

  const source = scene.textures.get(sheetKey).getSourceImage();
  const w = source.width;
  const h = source.height;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);

  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  const bg = dominantColor(data, w, h);

  const greenScreen = bg[1] > bg[0] + 24 && bg[1] > bg[2] + 24;
  const tol = 60;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let isBackground;
    if (greenScreen) {
      isBackground = g - Math.max(r, b) > 14;
    } else {
      isBackground = Math.abs(r - bg[0]) <= tol
        && Math.abs(g - bg[1]) <= tol
        && Math.abs(b - bg[2]) <= tol;
    }

    if (isBackground) {
      data[i + 3] = 0;
    } else if (greenScreen && g > r && g > b) {
      const excess = g - Math.max(r, b);
      if (excess > 6) data[i + 1] = Math.max(r, b) + 6;
    }
  }

  ctx.putImageData(image, 0, 0);

  scene.textures.remove(sheetKey);
  const tex = scene.textures.addCanvas(sheetKey, canvas);
  if (tex) tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
}
