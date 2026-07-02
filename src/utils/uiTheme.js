import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../data/characters.js';
import { createPortraitImage, updatePortraitImage } from './spriteFrames.js';

/** Visual language — My Hero One's Justice / All's Justice inspired */
export const UI = {
  font: 'Impact, "Arial Black", "Helvetica Neue", sans-serif',
  fontBody: '"Segoe UI", system-ui, -apple-system, sans-serif',

  bg: 0x08060c,
  bgPanel: 0x120a18,
  bgGlass: 0x1a1024,
  bgDark: 0x050308,
  line: 0x2a1838,
  lineBright: 0x4a2860,

  text: '#fff8f0',
  textMuted: '#c4b8d0',
  textDim: '#7a6890',

  // MHOJ hero side — gold / green
  hero: 0xf1c40f,
  heroSoft: 0x2ecc71,
  heroGlow: '#ffe066',
  heroText: '#ffe066',

  // MHOJ villain side — purple / magenta
  villain: 0x9b59b6,
  villainSoft: 0xe056fd,
  villainGlow: '#e056fd',
  villainText: '#e8b4ff',

  mhaRed: 0xe74c3c,
  mhaOrange: 0xf39c12,
  mhaBlue: 0x3498db,

  accent: 0xf1c40f,
  accentText: '#ffe066',
  warn: 0xff4757,
  ok: 0x2ecc71,
  gold: 0xffd400,
  goldText: '#ffd400',

  tornBar: 0x3d2410,
  tornBarLight: 0x6b4423,

  hudDepth: 120,
  overlayDepth: 200,
  fxDepth: 90,
};

export function hexAlpha(hex, alpha) {
  const a = Math.round(Phaser.Math.Clamp(alpha, 0, 1) * 255);
  return (hex << 8) | a;
}

export function rgba(hex) {
  return Phaser.Display.Color.IntegerToColor(hex).rgba;
}

export function factionPalette(faction) {
  if (faction === 'villain') {
    return { main: UI.villain, soft: UI.villainSoft, text: UI.villainText };
  }
  return { main: UI.hero, soft: UI.heroSoft, text: UI.heroText };
}

export function factionLabel(faction) {
  return faction === 'villain' ? 'VILLAINS' : 'HEROES';
}

/** Cover-fit a texture to the game viewport. */
export function coverImage(scene, key, depth = -100, alpha = 1) {
  if (!scene.textures.exists(key)) return null;
  const img = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key).setDepth(depth).setAlpha(alpha);
  const scale = Math.max(GAME_WIDTH / img.width, GAME_HEIGHT / img.height);
  img.setScale(scale);
  return img;
}

/** Dark vignette + optional faction tint over a title image. */
export function drawTitleVignette(scene, depth = -90, strength = 0.45) {
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, strength).setDepth(depth);
  const g = scene.add.graphics().setDepth(depth + 1);
  g.fillGradientStyle(0x9b59b6, 0x9b59b6, 0x000000, 0x000000, 0.22, 0.22, 0, 0);
  g.fillRect(0, 0, GAME_WIDTH * 0.52, GAME_HEIGHT);
  g.fillGradientStyle(0x000000, 0x000000, 0xf1c40f, 0xf1c40f, 0, 0, 0.12, 0.12);
  g.fillRect(GAME_WIDTH * 0.48, 0, GAME_WIDTH * 0.52, GAME_HEIGHT);
  return g;
}

/** Lightweight halftone-style overlay (sparse dots — avoids thousands of draw calls). */
export function drawHalftoneOverlay(scene, depth = 50, alpha = 0.07, spacing = 22) {
  const g = scene.add.graphics().setDepth(depth).setAlpha(alpha);
  g.fillStyle(0xffffff, 1);
  for (let y = 0; y < GAME_HEIGHT; y += spacing) {
    const offset = (Math.floor(y / spacing) % 2) * (spacing / 2);
    for (let x = offset; x < GAME_WIDTH; x += spacing) {
      g.fillCircle(x, y, 1.1);
    }
  }
  return g;
}

/** Vertical split divider with jagged comic-book edge. */
export function drawVsSplit(scene, x = GAME_WIDTH / 2, depth = 5) {
  const g = scene.add.graphics().setDepth(depth);
  g.lineStyle(3, 0xffffff, 0.85);
  g.lineBetween(x, 0, x, GAME_HEIGHT);
  g.lineStyle(1, 0x000000, 0.6);
  g.lineBetween(x + 2, 0, x + 2, GAME_HEIGHT);
  g.lineBetween(x - 2, 0, x - 2, GAME_HEIGHT);
  return g;
}

/** Shattered diagonal panels radiating from center (character select). */
export function drawShatteredPanels(scene, depth = -80) {
  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2;
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(0x0a0610, 0.72);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const shards = [
    { pts: [0, 0, cx - 40, cy - 60, cx - 80, 0], color: 0x1a0a28, a: 0.9 },
    { pts: [0, 0, cx - 80, 0, cx - 20, cy - 80, 0, 120], color: 0x2a1040, a: 0.85 },
    { pts: [0, GAME_HEIGHT, cx - 60, cy + 40, cx - 100, GAME_HEIGHT], color: 0x180828, a: 0.88 },
    { pts: [GAME_WIDTH, 0, cx + 40, cy - 60, cx + 80, 0], color: 0x1a1808, a: 0.9 },
    { pts: [GAME_WIDTH, 0, cx + 80, 0, cx + 20, cy - 80, GAME_WIDTH, 120], color: 0x282010, a: 0.85 },
    { pts: [GAME_WIDTH, GAME_HEIGHT, cx + 60, cy + 40, cx + 100, GAME_HEIGHT], color: 0x181008, a: 0.88 },
  ];

  for (const s of shards) {
    g.fillStyle(s.color, s.a);
    const points = [];
    for (let i = 0; i < s.pts.length; i += 2) points.push({ x: s.pts[i], y: s.pts[i + 1] });
    g.fillPoints(points, true);
  }

  g.lineStyle(2, 0xffffff, 0.35);
  g.lineBetween(cx - 120, cy - 140, cx + 80, cy - 20);
  g.lineBetween(cx - 80, cy + 20, cx + 120, cy + 140);
  g.lineBetween(cx - 140, cy + 60, cx + 40, cy + 160);
  g.lineBetween(cx + 140, cy - 60, cx - 40, cy - 160);

  return g;
}

/** MY HERO ACADEMIA stacked logo (All's Justice title screen style). */
export function drawMhaLogo(scene, x, y, depth = 10) {
  const con = scene.add.container(x, y).setDepth(depth);

  const myHero = scene.add.text(0, -38, 'MY HERO', {
    fontFamily: UI.font,
    fontSize: '42px',
    color: '#ffffff',
    fontStyle: 'italic',
    stroke: '#000000',
    strokeThickness: 8,
  }).setOrigin(0.5);
  myHero.setShadow(3, 4, '#000000', 8, true, true);

  const academia = scene.add.text(0, 4, 'ACADEMIA', {
    fontFamily: UI.font,
    fontSize: '48px',
    color: '#ff5533',
    fontStyle: 'italic',
    stroke: '#1a0800',
    strokeThickness: 9,
  }).setOrigin(0.5);
  academia.setShadow(3, 5, '#000000', 10, true, true);

  const subtitle = scene.add.text(0, 52, "All's Justice", {
    fontFamily: UI.font,
    fontSize: '28px',
    color: '#ffffff',
    fontStyle: 'italic',
    stroke: '#000000',
    strokeThickness: 6,
  }).setOrigin(0.5);
  subtitle.setShadow(2, 3, '#000000', 6, true, true);

  // lightning bolt accent between All's and Justice feel
  const bolt = scene.add.text(18, 52, '⚡', {
    fontSize: '22px',
  }).setOrigin(0.5).setAlpha(0.9);

  con.add([myHero, academia, subtitle, bolt]);
  return con;
}

/** Large halftone-style background words (ALL'S / JUSTICE split). */
export function drawHalftoneWords(scene, depth = 3) {
  const left = scene.add.text(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.38, "ALL'S", {
    fontFamily: UI.font,
    fontSize: '72px',
    color: '#111111',
    fontStyle: 'italic',
    stroke: '#333333',
    strokeThickness: 2,
  }).setOrigin(0.5).setDepth(depth).setAlpha(0.55);

  const right = scene.add.text(GAME_WIDTH * 0.75, GAME_HEIGHT * 0.38, 'JUSTICE', {
    fontFamily: UI.font,
    fontSize: '72px',
    color: '#eeeeee',
    fontStyle: 'italic',
    stroke: '#444444',
    strokeThickness: 2,
  }).setOrigin(0.5).setDepth(depth).setAlpha(0.5);

  return { left, right };
}

/** Torn brush-stroke menu bar (MHOJ bottom menu). */
export function drawTornMenuBar(scene, x, y, w, h, depth = 20) {
  const g = scene.add.graphics().setDepth(depth);
  const left = x - w / 2;
  const top = y - h / 2;

  // jagged top edge
  const topPts = [{ x: left, y: top + 8 }];
  for (let i = 0; i <= 24; i += 1) {
    const px = left + (w * i) / 24;
    const jag = (i % 2 === 0 ? 0 : 6) + (Math.sin(i * 1.7) * 3);
    topPts.push({ x: px, y: top + jag });
  }
  topPts.push({ x: left + w, y: top + 10 });
  topPts.push({ x: left + w, y: top + h });
  topPts.push({ x: left, y: top + h });

  g.fillStyle(UI.tornBar, 0.94);
  g.fillPoints(topPts, true);
  g.lineStyle(2, UI.tornBarLight, 0.8);
  g.strokePoints(topPts, true);

  // inner highlight strip
  g.fillStyle(0xffffff, 0.06);
  g.fillRect(left + 8, top + h * 0.15, w - 16, 3);

  return g;
}

/** Menu row inside torn bar — returns text object for updates. */
export function menuRowText(scene, x, y, text, selected, depth = 21) {
  const t = scene.add.text(x, y, text, {
    fontFamily: UI.font,
    fontSize: selected ? '22px' : '18px',
    color: selected ? '#ffffff' : UI.textMuted,
    fontStyle: 'italic',
    stroke: '#000000',
    strokeThickness: selected ? 5 : 3,
  }).setOrigin(0, 0.5).setDepth(depth);
  if (selected) t.setShadow(2, 2, '#000000', 4, true, true);
  return t;
}

/** MHOJ-style loading bar. */
export function drawMhaLoadingBar(scene, x, y, w, depth = 5) {
  const track = scene.add.rectangle(x, y, w, 10, 0x1a1020, 0.95).setDepth(depth);
  track.setStrokeStyle(2, UI.gold, 0.9);
  const fill = scene.add.rectangle(x - w / 2, y, 0, 8, UI.mhaRed, 1).setOrigin(0, 0.5).setDepth(depth + 1);
  const gloss = scene.add.rectangle(x - w / 2, y - 2, 0, 3, 0xffffff, 0.35).setOrigin(0, 0.5).setDepth(depth + 2);
  return { track, fill, gloss, maxW: w - 4 };
}

export function setMhaLoadingBar(bar, ratio) {
  const w = Math.max(0, bar.maxW * Phaser.Math.Clamp(ratio, 0, 1));
  bar.fill.width = w;
  bar.gloss.width = w;
  bar.fill.x = bar.track.x - bar.maxW / 2 - 2;
  bar.gloss.x = bar.track.x - bar.maxW / 2 - 2;
}

/** Subtle perspective grid backdrop */
export function drawBackdrop(scene, accent = UI.accent) {
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, UI.bg);

  const g = scene.add.graphics().setDepth(-50);
  g.lineStyle(1, UI.line, 0.35);
  for (let x = 0; x <= GAME_WIDTH; x += 40) g.lineBetween(x, 0, x, GAME_HEIGHT);
  for (let y = 0; y <= GAME_HEIGHT; y += 40) g.lineBetween(0, y, GAME_WIDTH, y);

  g.lineStyle(2, accent, 0.15);
  g.lineBetween(0, 72, GAME_WIDTH, 72);
  g.lineBetween(0, GAME_HEIGHT - 56, GAME_WIDTH, GAME_HEIGHT - 56);

  drawHalftoneOverlay(scene, -49, 0.04, 22);
}

export function drawGlassPanel(scene, x, y, w, h, opts = {}) {
  const {
    depth = 0,
    fill = UI.bgGlass,
    fillAlpha = 0.72,
    border = UI.lineBright,
    borderAlpha = 0.9,
    accent = null,
    accentSide = 'left',
  } = opts;

  const container = scene.add.container(x, y).setDepth(depth);
  const panel = scene.add.rectangle(0, 0, w, h, fill, fillAlpha);
  panel.setStrokeStyle(1, border, borderAlpha);
  container.add(panel);

  if (accent != null) {
    const barW = 3;
    const barX = accentSide === 'left' ? -w / 2 + barW / 2 : w / 2 - barW / 2;
    container.add(scene.add.rectangle(barX, 0, barW, h - 8, accent, 0.95));
  }

  container.setData('panel', panel);
  return container;
}

export function drawCenterDivider(scene, x, y, h) {
  const g = scene.add.graphics().setDepth(5);
  g.lineStyle(1, UI.lineBright, 0.6);
  g.lineBetween(x, y - h / 2, x, y + h / 2);
  const glow = scene.add.rectangle(x, y, 2, h, UI.accent, 0.15);
  return { g, glow };
}

export function label(scene, x, y, text, style = {}) {
  return scene.add.text(x, y, text, {
    fontFamily: style.fontFamily ?? UI.fontBody,
    fontSize: '12px',
    color: UI.text,
    ...style,
  }).setOrigin(style.originX ?? 0.5, style.originY ?? 0.5);
}

export function sectionTag(scene, x, y, text, color) {
  return label(scene, x, y, text.toUpperCase(), {
    fontSize: '10px',
    color: rgba(color),
    letterSpacing: 4,
    fontStyle: '600',
  });
}

/** Bold italic comic-style headline with thick dark outline + drop shadow */
export function comicTitle(scene, x, y, text, opts = {}) {
  const { size = 44, color = UI.goldText, depth = 10, accent = '#000000' } = opts;
  const t = scene.add.text(x, y, text, {
    fontFamily: UI.font,
    fontSize: `${size}px`,
    color,
    fontStyle: 'italic',
    stroke: accent,
    strokeThickness: Math.max(5, Math.round(size / 5)),
  }).setOrigin(0.5).setDepth(depth);
  t.setShadow(3, 4, '#000000', 8, true, true);
  return t;
}

/** Pulsing VS badge for character select */
export function holographicVsBadge(scene, x, y, depth = 12) {
  const glow = scene.add.ellipse(x, y, 96, 96, UI.gold, 0.18).setDepth(depth - 1);
  const ring = scene.add.ellipse(x, y, 78, 78, 0x000000, 0).setDepth(depth - 1);
  ring.setStrokeStyle(3, UI.gold, 0.85);

  const vs = comicTitle(scene, x, y, 'VS', { size: 52, color: '#ffffff', depth, accent: '#000000' });

  scene.tweens.add({
    targets: [glow, ring],
    scaleX: 1.14,
    scaleY: 1.14,
    alpha: { from: 0.7, to: 0.3 },
    duration: 800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  scene.tweens.add({
    targets: vs,
    scale: 1.08,
    duration: 600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  return { vs, glow, ring };
}

/* ---------- Angled (parallelogram) meters ---------- */

function meterPoints(x, y, w, h, skew, align) {
  if (align === 'left') {
    return [
      { x: x + skew, y },
      { x: x + w + skew, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  }
  return [
    { x: x - skew, y },
    { x: x - w - skew, y },
    { x: x - w, y: y + h },
    { x, y: y + h },
  ];
}

function redrawAngledMeter(m) {
  const g = m.g;
  g.clear();

  if (!m.noTrack) {
    g.fillStyle(UI.bgDark, 0.92);
    g.fillPoints(meterPoints(m.x, m.y, m.w, m.h, m.skew, m.align), true);
  }

  const fw = m.w * Phaser.Math.Clamp(m.ratio, 0, 1);
  if (fw > 1) {
    g.fillStyle(m.fill, 1);
    g.fillPoints(meterPoints(m.x, m.y, fw, m.h, m.skew, m.align), true);
    // glossy top highlight
    g.fillStyle(0xffffff, 0.28);
    g.fillPoints(meterPoints(m.x, m.y, fw, m.h * 0.4, m.skew, m.align), true);
    // darker base for depth
    g.fillStyle(0x000000, 0.18);
    g.fillPoints(meterPoints(m.x, m.y + m.h * 0.74, fw, m.h * 0.26, m.skew, m.align), true);
  }

  if (!m.noBorder) {
    g.lineStyle(2, m.border, 1);
    g.strokePoints(meterPoints(m.x, m.y, m.w, m.h, m.skew, m.align), true);
  }
}

export function createAngledMeter(scene, x, y, w, h, opts = {}) {
  const {
    align = 'left',
    skew = Math.round(h * 0.7),
    depth = UI.hudDepth,
    fill = UI.ok,
    border = UI.gold,
    noTrack = false,
    noBorder = false,
  } = opts;

  const g = scene.add.graphics().setDepth(depth);
  const meter = { g, x, y, w, h, skew, align, fill, border, ratio: 1, noTrack, noBorder };
  redrawAngledMeter(meter);
  return meter;
}

export function setAngledMeter(meter, ratio, lowColor, highColor) {
  meter.ratio = ratio;
  if (lowColor != null && highColor != null) {
    meter.fill = ratio > 0.3 ? highColor : lowColor;
  }
  redrawAngledMeter(meter);
}

/** Angled portrait frame (My Hero One's Justice corner badge) */
export function addAngledPortrait(scene, anchorX, topY, size, char, accent, align = 'left') {
  const skew = Math.round(size * 0.18);
  const back = scene.add.graphics().setDepth(UI.hudDepth - 1);
  back.fillStyle(UI.bgDark, 0.96);
  back.fillPoints(meterPoints(anchorX, topY, size, size, skew, align), true);

  const cx = align === 'left' ? anchorX + size / 2 + skew / 2 : anchorX - size / 2 - skew / 2;
  const cy = topY + size / 2;
  const portrait = createPortraitImage(scene, cx, cy, char, size - 8, size - 8);
  if (portrait) portrait.setDepth(UI.hudDepth);

  const border = scene.add.graphics().setDepth(UI.hudDepth + 1);
  border.lineStyle(2.5, accent, 1);
  border.strokePoints(meterPoints(anchorX, topY, size, size, skew, align), true);

  return {
    portrait,
    redraw(newChar) {
      if (portrait) updatePortraitImage(portrait, newChar, size - 8, size - 8);
    },
  };
}

/** Diagonal faction panel for character select previews */
export function drawAngledPanel(scene, cx, cy, w, h, opts = {}) {
  const { fill = UI.bgPanel, fillAlpha = 0.9, border = UI.accent, skew = 18, depth = 1 } = opts;
  const x = cx - w / 2;
  const y = cy - h / 2;

  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(fill, fillAlpha);
  g.fillPoints(meterPoints(x, y, w, h, skew, 'left'), true);
  g.lineStyle(2, border, 1);
  g.strokePoints(meterPoints(x, y, w, h, skew, 'left'), true);

  g.fillStyle(border, 0.9);
  g.fillPoints(meterPoints(x, y, 4, h, skew, 'left'), true);

  return g;
}

/* ---------- super-move cut-in (signature hero/villain banner) ---------- */

export function superCutIn(scene, character, accentColor, facing = 'left') {
  const cy = GAME_HEIGHT / 2;
  const depth = UI.overlayDepth + 5;
  const con = scene.add.container(0, 0).setDepth(depth);

  // angled dark band sweeping across the screen
  const g = scene.add.graphics();
  g.fillStyle(0x05070d, 0.93);
  g.fillPoints([
    { x: -60, y: cy - 95 }, { x: GAME_WIDTH + 60, y: cy - 135 },
    { x: GAME_WIDTH + 60, y: cy + 95 }, { x: -60, y: cy + 135 },
  ], true);
  g.fillStyle(accentColor, 0.95);
  g.fillPoints([
    { x: -60, y: cy + 62 }, { x: GAME_WIDTH + 60, y: cy + 26 },
    { x: GAME_WIDTH + 60, y: cy + 40 }, { x: -60, y: cy + 78 },
  ], true);
  // speed lines
  g.fillStyle(0xffffff, 0.06);
  for (let i = 0; i < 18; i += 1) {
    const yy = cy - 90 + i * 11;
    g.fillPoints([
      { x: -60, y: yy }, { x: GAME_WIDTH + 60, y: yy - 30 },
      { x: GAME_WIDTH + 60, y: yy - 27 }, { x: -60, y: yy + 3 },
    ], true);
  }
  con.add(g);

  const left = facing === 'left';
  const portraitStartX = left ? -240 : GAME_WIDTH + 240;
  const portraitEndX = left ? 210 : GAME_WIDTH - 210;
  const portrait = createPortraitImage(scene, portraitStartX, cy - 6, character, 230, 230);
  if (portrait) con.add(portrait);

  const nameStartX = left ? GAME_WIDTH + 260 : -260;
  const nameEndX = left ? GAME_WIDTH - 70 : 70;
  const nameAlign = left ? 1 : 0;

  const moveName = scene.add.text(nameStartX, cy - 8, (character.specialName ?? 'SPECIAL').toUpperCase(), {
    fontFamily: UI.font,
    fontSize: '38px',
    color: '#ffffff',
    fontStyle: 'italic 800',
    stroke: '#10131c',
    strokeThickness: 7,
    align: left ? 'right' : 'left',
    wordWrap: { width: 360 },
  }).setOrigin(nameAlign, 0.5);
  moveName.setShadow(2, 4, '#000000', 6, true, true);
  con.add(moveName);

  const tag = scene.add.text(nameEndX, cy + 30, character.faction === 'villain' ? 'VILLAIN UNLEASHED' : 'PLUS ULTRA', {
    fontFamily: UI.font,
    fontSize: '12px',
    color: rgba(accentColor),
    fontStyle: 'italic 800',
    letterSpacing: 4,
  }).setOrigin(nameAlign, 0.5).setAlpha(0);
  con.add(tag);

  scene.cameras.main.flash(130, 255, 255, 255, false);

  if (portrait) scene.tweens.add({ targets: portrait, x: portraitEndX, duration: 280, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: moveName, x: nameEndX, duration: 300, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: tag, alpha: 1, delay: 220, duration: 180 });

  scene.tweens.add({
    targets: con,
    alpha: 0,
    delay: 720,
    duration: 240,
    onComplete: () => con.destroy(),
  });

  return con;
}

/* ---------- legacy straight meter (kept for compatibility) ---------- */

export function createMeter(scene, x, y, width, height, opts = {}) {
  const { originY = 0.5, depth = UI.hudDepth, fill = UI.ok, track = UI.bgGlass, align = 'left' } = opts;
  const container = scene.add.container(x, y).setDepth(depth);
  const trackRect = scene.add.rectangle(0, 0, width, height, track, 0.85);
  trackRect.setStrokeStyle(1, UI.lineBright, 0.8);
  trackRect.setOrigin(align === 'left' ? 0 : 1, originY);
  const fillRect = scene.add.rectangle(0, 0, width, height, fill, 1);
  fillRect.setOrigin(align === 'left' ? 0 : 1, originY);
  container.add([trackRect, fillRect]);
  container.setData('fill', fillRect);
  container.setData('maxWidth', width);
  return container;
}

export function setMeterRatio(meter, ratio, lowColor = UI.warn, highColor = UI.ok) {
  const fill = meter.getData('fill');
  const maxW = meter.getData('maxWidth');
  fill.width = Math.max(0, maxW * Phaser.Math.Clamp(ratio, 0, 1));
  fill.setFillStyle(ratio > 0.3 ? highColor : lowColor);
}

/* ---------- scoped keyboard handlers ---------- */

export function trackKey(scene, event, fn) {
  scene.input.keyboard.on(event, fn);
  if (!scene._keyHandlers) scene._keyHandlers = [];
  scene._keyHandlers.push({ event, fn });
}

export function untrackKeys(scene) {
  if (!scene._keyHandlers) return;
  for (const { event, fn } of scene._keyHandlers) {
    scene.input.keyboard.off(event, fn);
  }
  scene._keyHandlers = [];
}
