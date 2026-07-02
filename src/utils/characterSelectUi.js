import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../data/characters.js';
import { UI, coverImage, comicTitle, rgba, label } from './uiTheme.js';

/** Wedge slot positions — MHOJ radial layout (≤3 fighters). */
export const SHARD_SLOTS = {
  left: [
    { x: 102, y: 108, w: 156, h: 124 },
    { x: 72, y: 262, w: 176, h: 132 },
    { x: 102, y: 416, w: 156, h: 124 },
  ],
  right: [
    { x: 858, y: 98, w: 156, h: 114 },
    { x: 888, y: 208, w: 156, h: 108 },
    { x: 888, y: 318, w: 156, h: 108 },
    { x: 858, y: 428, w: 156, h: 124 },
  ],
};

/** 2×2 grid — used when a side has 4+ fighters (kept clear of center standee). */
export const GRID_SLOTS = {
  left: [
    { x: 48, y: 128, w: 132, h: 102 },
    { x: 180, y: 128, w: 132, h: 102 },
    { x: 48, y: 278, w: 132, h: 102 },
    { x: 180, y: 278, w: 132, h: 102 },
  ],
  right: [
    { x: 828, y: 128, w: 132, h: 102 },
    { x: 696, y: 128, w: 132, h: 102 },
    { x: 828, y: 278, w: 132, h: 102 },
    { x: 696, y: 278, w: 132, h: 102 },
  ],
};

export const SLOTS_PER_PAGE = 4;

/** 3+2 grid — fits five fighters without scrolling. */
export const GRID_SLOTS_5 = {
  left: [
    { x: 48, y: 108, w: 128, h: 92 },
    { x: 184, y: 108, w: 128, h: 92 },
    { x: 48, y: 218, w: 128, h: 92 },
    { x: 184, y: 218, w: 128, h: 92 },
    { x: 116, y: 328, w: 128, h: 92 },
  ],
  right: [
    { x: 828, y: 108, w: 128, h: 92 },
    { x: 692, y: 108, w: 128, h: 92 },
    { x: 828, y: 218, w: 128, h: 92 },
    { x: 692, y: 218, w: 128, h: 92 },
    { x: 760, y: 328, w: 128, h: 92 },
  ],
};

function shardPoints(x, y, w, h, skew, side) {
  if (side === 'left') {
    return [
      { x: x + skew, y },
      { x: x + w + skew * 0.35, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  }
  return [
    { x: x - skew, y },
    { x: x - w - skew * 0.35, y },
    { x: x - w, y: y + h },
    { x, y: y + h },
  ];
}

/** Full-bleed background + minimal overlays. */
export function drawCharSelectBackground(scene) {
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050308).setDepth(-100);

  if (scene.textures.exists('ui-mha-title')) {
    coverImage(scene, 'ui-mha-title', -99, 1);
  }

  const g = scene.add.graphics().setDepth(-98);
  g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.08, 0.08, 0.18, 0.22);
  g.fillRect(0, GAME_HEIGHT - 100, GAME_WIDTH, 100);

  g.lineStyle(3, 0xffffff, 0.55);
  g.lineBetween(GAME_WIDTH / 2, 48, GAME_WIDTH / 2, GAME_HEIGHT - 80);
}

export function drawCharSelectTitle(scene) {
  comicTitle(scene, GAME_WIDTH / 2, 34, 'SELECT FIGHTER', {
    size: 36,
    color: UI.goldText,
    depth: 14,
  });
}

/** Single selectable shard panel. */
export function createShardSlot(scene, slot, side, accent, depth = 8) {
  const skew = side === 'left' ? 22 : -22;
  const anchorX = slot.x;
  const anchorY = slot.y - slot.h / 2;

  const container = scene.add.container(anchorX, anchorY).setDepth(depth);
  const g = scene.add.graphics();
  const pts = shardPoints(0, 0, slot.w, slot.h, skew, side);

  g.fillStyle(0x08060e, 0.94);
  g.fillPoints(pts, true);
  g.lineStyle(3, 0xffffff, 0.88);
  g.strokePoints(pts, true);
  g.lineStyle(1, accent, 0.55);
  g.strokePoints(
    pts.map((p, i) => (i <= 1 ? { x: p.x, y: p.y + 3 } : p)),
    true,
  );

  const selGlow = scene.add.graphics();
  container.add([g, selGlow]);
  container.setData('slotW', slot.w);
  container.setData('slotH', slot.h);
  container.setData('skew', skew);
  container.setData('side', side);
  container.setData('selGlow', selGlow);
  container.setData('accent', accent);

  return container;
}

/** Compact grid cell for 2×2 roster layout. */
export function createGridSlot(scene, slot, side, accent, depth = 8) {
  const anchorX = slot.x;
  const anchorY = slot.y - slot.h / 2;
  const container = scene.add.container(anchorX, anchorY).setDepth(depth);

  const bg = scene.add.rectangle(slot.w / 2, slot.h / 2, slot.w, slot.h, 0x08060e, 0.94);
  bg.setStrokeStyle(2, 0xffffff, 0.85);
  const accentLine = scene.add.rectangle(
    side === 'left' ? 3 : slot.w - 3,
    slot.h / 2,
    4,
    slot.h - 8,
    accent,
    0.75,
  );
  const selGlow = scene.add.rectangle(slot.w / 2, slot.h / 2, slot.w + 6, slot.h + 6, accent, 0);
  selGlow.setStrokeStyle(0, accent, 0);

  container.add([bg, accentLine, selGlow]);
  container.setData('slotW', slot.w);
  container.setData('slotH', slot.h);
  container.setData('side', side);
  container.setData('selGlow', selGlow);
  container.setData('accent', accent);
  container.setData('isGrid', true);

  return container;
}

export function setShardSelected(shard, selected, confirmed) {
  const glow = shard.getData('selGlow');
  const accent = shard.getData('accent');
  const isGrid = shard.getData('isGrid');

  if (isGrid) {
    if (selected) {
      const color = confirmed ? UI.ok : accent;
      glow.setStrokeStyle(confirmed ? 4 : 3, color, 1);
      glow.setFillStyle(color, 0.08);
    } else {
      glow.setStrokeStyle(0, accent, 0);
      glow.setFillStyle(accent, 0);
    }
    shard.setScale(1);
    return;
  }

  const skew = shard.getData('skew');
  const side = shard.getData('side');
  const w = shard.getData('slotW');
  const h = shard.getData('slotH');
  const pts = shardPoints(0, 0, w, h, skew, side);

  glow.clear();
  if (selected) {
    const color = confirmed ? UI.ok : accent;
    glow.lineStyle(confirmed ? 5 : 4, color, 1);
    glow.strokePoints(pts, true);
    glow.fillStyle(color, 0.08);
    glow.fillPoints(pts, true);
  }
  shard.setScale(1);
}

/** Static center glow between the two preview standees. */
export function drawCenterClashGlow(scene, x, y, p1Accent, p2Accent) {
  const g = scene.add.graphics().setDepth(3);
  g.fillStyle(p1Accent, 0.18);
  g.fillCircle(x - 55, y - 60, 100);
  g.fillStyle(p2Accent, 0.18);
  g.fillCircle(x + 55, y - 60, 100);
  g.fillStyle(0xffffff, 0.1);
  g.fillCircle(x, y - 60, 36);
  return g;
}

export function factionHeader(scene, x, y, text, accent, align = 'center') {
  return scene.add.text(x, y, text, {
    fontFamily: UI.font,
    fontSize: '15px',
    color: rgba(accent),
    fontStyle: 'italic',
    stroke: '#000000',
    strokeThickness: 5,
    letterSpacing: 4,
  }).setOrigin(align === 'left' ? 0 : align === 'right' ? 1 : 0.5, 0.5).setDepth(12);
}

export function pickShardIndices(rosterLen, side) {
  const slots = SHARD_SLOTS[side];
  const max = slots.length;
  if (rosterLen >= max) return [...Array(max).keys()];
  if (rosterLen === 1) return [Math.floor(max / 2)];
  if (rosterLen === 2) return side === 'left' ? [0, 2] : [0, 3];
  if (rosterLen === 3) return side === 'left' ? [0, 1, 2] : [0, 1, 3];
  return [...Array(rosterLen).keys()];
}

/** Layout mode + slot list for a roster size. */
export function getRosterLayout(rosterLen, side) {
  if (rosterLen >= 5) {
    return { mode: 'grid', slots: GRID_SLOTS_5[side], pageSize: 5 };
  }
  if (rosterLen >= 4) {
    return { mode: 'grid', slots: GRID_SLOTS[side], pageSize: SLOTS_PER_PAGE };
  }
  return {
    mode: 'wedge',
    slots: SHARD_SLOTS[side],
    indices: pickShardIndices(rosterLen, side),
    pageSize: rosterLen,
  };
}

/** Scroll offset so the selected fighter stays on the current page. */
export function clampScrollOffset(rosterLen, selectedIndex, scrollOffset) {
  if (rosterLen <= SLOTS_PER_PAGE) return 0;
  const maxScroll = rosterLen - SLOTS_PER_PAGE;
  let offset = Phaser.Math.Clamp(scrollOffset, 0, maxScroll);
  if (selectedIndex < offset) offset = selectedIndex;
  if (selectedIndex >= offset + SLOTS_PER_PAGE) offset = selectedIndex - SLOTS_PER_PAGE + 1;
  return offset;
}

export function drawScrollHint(scene, x, y, direction, visible) {
  const key = `scroll-${direction}-${x}`;
  let hint = scene._scrollHints?.[key];
  if (!visible) {
    hint?.destroy();
    if (scene._scrollHints) delete scene._scrollHints[key];
    return;
  }
  if (!hint) {
    if (!scene._scrollHints) scene._scrollHints = {};
    hint = label(scene, x, y, direction === 'up' ? '▲' : '▼', {
      fontSize: '14px',
      color: UI.goldText,
      depth: 14,
    });
    scene._scrollHints[key] = hint;
  }
  hint.setPosition(x, y);
  hint.setVisible(true);
}
