import Phaser from 'phaser';

export function applySmoothFilter(scene, sheetKey) {
  const tex = scene.textures.get(sheetKey);
  if (tex) {
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}

/** Force character sprites fully opaque at runtime (fixes faded cutouts). */
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

  // Fast pass only — the old flood-fill hole repair blocked the main thread
  // for minutes on large JPEG sprites and froze the loading screen.
  for (let p = 0; p < total; p += 1) {
    const i = p * 4;
    const a = data[i + 3];
    if (a < 10) data[i + 3] = 0;
    else if (a >= 200) data[i + 3] = 255;
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
