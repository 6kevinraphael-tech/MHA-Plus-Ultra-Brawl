import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../data/characters.js';
import { UI, coverImage, comicTitle, rgba, label } from './uiTheme.js';

/** Wedge slot positions — MHOJ radial layout (≤3 fighters). */
export const SHARD_SLOTS = {
  left: [
    { x: 58, y: 168, w: 140, h: 80 },
    { x: 36, y: 248, w: 160, h: 84 },
    { x: 58, y: 324, w: 140, h: 72 },
  ],
  right: [
    { x: 754, y: 168, w: 140, h: 80 },
    { x: 756, y: 248, w: 160, h: 84 },
    { x: 754, y: 324, w: 140, h: 72 },
  ],
};

/** 2×2 grid — kept in the side columns, clear of center standees. */
export const GRID_SLOTS = {
  left: [
    { x: 22, y: 172, w: 106, h: 74 },
    { x: 134, y: 172, w: 106, h: 74 },
    { x: 22, y: 260, w: 106, h: 74 },
    { x: 134, y: 260, w: 106, h: 74 },
  ],
  right: [
    { x: 718, y: 172, w: 106, h: 74 },
    { x: 830, y: 172, w: 106, h: 74 },
    { x: 718, y: 260, w: 106, h: 74 },
    { x: 830, y: 260, w: 106, h: 74 },
  ],
};

export const SLOTS_PER_PAGE = 4;

/** 3+2 grid — five fighters in the left/right gutters. */
export const GRID_SLOTS_5 = {
  left: [
    { x: 22, y: 172, w: 106, h: 74 },
    { x: 134, y: 172, w: 106, h: 74 },
    { x: 22, y: 244, w: 106, h: 74 },
    { x: 134, y: 244, w: 106, h: 74 },
    { x: 78, y: 316, w: 106, h: 74 },
  ],
  right: [
    { x: 718, y: 172, w: 106, h: 74 },
    { x: 830, y: 172, w: 106, h: 74 },
    { x: 718, y: 244, w: 106, h: 74 },
    { x: 830, y: 244, w: 106, h: 74 },
    { x: 774, y: 316, w: 106, h: 74 },
  ],
};

/** Layout depth layers — standees always render above roster tiles. */
export const CHAR_SELECT_DEPTH = {
  bg: -100,
  bgOverlay: -98,
  rosterColumn: 4,
  centerGlow: 18,
  rosterShard: 14,
  standeeBackdrop: 36,
  standee: 42,
  vsBadge: 44,
  infoPanel: 46,
  factionBanner: 48,
  title: 50,
  footerBar: 51,
  footer: 53,
};

/** Shared coordinates — keep all select-screen UI inside these bounds. */
export const CHAR_SELECT_LAYOUT = {
  titleY: 34,
  bannerY: 76,
  bannerH: 40,
  columnTop: 122,
  columnH: 272,
  columnW: 248,
  columnPadX: 8,
  stageX: 264,
  stageY: 90,
  stageW: 432,
  stageH: 346,
  stageFloorY: 434,
  standeeH: 280,
  standeeX: { p1: 362, p2: GAME_WIDTH - 362 },
  infoPanelY: 390,
  infoPanelH: 40,
  footerTop: 444,
  hintY: 462,
  confirmY: 496,
  backX: 62,
  ctrlY: 518,
  rosterScrollY: { up: 136, down: 368 },
  rosterScrollX: { left: 132, right: GAME_WIDTH - 132 },
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
  const { footerTop, stageY, columnTop } = CHAR_SELECT_LAYOUT;
  g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.08, 0.08, 0.18, 0.22);
  g.fillRect(0, footerTop, GAME_WIDTH, GAME_HEIGHT - footerTop);

  g.lineStyle(2, 0xffffff, 0.22);
  g.lineBetween(GAME_WIDTH / 2, stageY, GAME_WIDTH / 2, footerTop);

  drawRosterColumnPanels(scene);
  drawFooterBar(scene);
}

/** Dedicated bottom bar — keeps CONFIRM / hints off the stage and roster. */
export function drawFooterBar(scene) {
  const { footerTop } = CHAR_SELECT_LAYOUT;
  const g = scene.add.graphics().setDepth(CHAR_SELECT_DEPTH.footerBar);
  g.fillStyle(0x04030a, 0.94);
  g.fillRect(0, footerTop, GAME_WIDTH, GAME_HEIGHT - footerTop);
  g.lineStyle(2, UI.gold, 0.35);
  g.lineBetween(0, footerTop, GAME_WIDTH, footerTop);
}

/** Side gutters + center stage so tiles never sit under the big previews. */
export function drawRosterColumnPanels(scene) {
  const d = CHAR_SELECT_DEPTH.rosterColumn;
  const { columnPadX, columnTop, columnW, columnH, stageX, stageY, stageW, stageH } = CHAR_SELECT_LAYOUT;

  const left = scene.add.graphics().setDepth(d);
  left.fillStyle(0x06040c, 0.82);
  left.fillRoundedRect(columnPadX, columnTop, columnW, columnH, 6);
  left.lineStyle(2, 0xffffff, 0.12);
  left.strokeRoundedRect(columnPadX, columnTop, columnW, columnH, 6);

  const right = scene.add.graphics().setDepth(d);
  right.fillStyle(0x06040c, 0.82);
  right.fillRoundedRect(GAME_WIDTH - columnPadX - columnW, columnTop, columnW, columnH, 6);
  right.lineStyle(2, 0xffffff, 0.12);
  right.strokeRoundedRect(GAME_WIDTH - columnPadX - columnW, columnTop, columnW, columnH, 6);

  const stage = scene.add.graphics().setDepth(d + 1);
  stage.fillStyle(0x0a0814, 0.45);
  stage.fillRoundedRect(stageX, stageY, stageW, stageH, 8);
  stage.lineStyle(2, 0xffffff, 0.08);
  stage.strokeRoundedRect(stageX, stageY, stageW, stageH, 8);
}

export function drawCharSelectTitle(scene) {
  comicTitle(scene, GAME_WIDTH / 2, 34, 'SELECT FIGHTER', {
    size: 36,
    color: UI.goldText,
    depth: CHAR_SELECT_DEPTH.title,
  });
}

/** Single selectable shard panel. */
export function createShardSlot(scene, slot, side, accent, depth = CHAR_SELECT_DEPTH.rosterShard) {
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
export function createGridSlot(scene, slot, side, accent, depth = CHAR_SELECT_DEPTH.rosterShard) {
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
  const g = scene.add.graphics().setDepth(CHAR_SELECT_DEPTH.centerGlow);
  g.fillStyle(p1Accent, 0.14);
  g.fillCircle(x - 72, y - 40, 88);
  g.fillStyle(p2Accent, 0.14);
  g.fillCircle(x + 72, y - 40, 88);
  g.fillStyle(0xffffff, 0.06);
  g.fillCircle(x, y - 40, 28);
  return g;
}

/** Faction label strip — above roster column, separate from the grid. */
export function drawFactionBanner(scene, side, text, accent, playerLabel) {
  const isLeft = side === 'left';
  const { bannerY, bannerH, rosterScrollX } = CHAR_SELECT_LAYOUT;
  const cx = isLeft ? rosterScrollX.left : rosterScrollX.right;
  const d = CHAR_SELECT_DEPTH.factionBanner;
  const g = scene.add.graphics().setDepth(d);
  const w = 212;
  const h = bannerH;
  const x = cx - w / 2;
  const y = bannerY;

  g.fillStyle(accent, 0.12);
  g.fillRoundedRect(x, y, w, h, 4);
  g.lineStyle(2, accent, 0.45);
  g.strokeRoundedRect(x, y, w, h, 4);
  g.lineStyle(2, accent, 0.75);
  g.lineBetween(x + 10, y + 6, x + w - 10, y + 6);

  const title = factionHeader(scene, cx, y + 15, text, accent, 'center');
  title.setDepth(d + 1);
  const sub = label(scene, cx, y + 30, playerLabel, {
    fontSize: '8px',
    color: UI.textDim,
    letterSpacing: 2,
    depth: d + 1,
  });
  return { g, title, sub };
}

export function factionHeader(scene, x, y, text, accent, align = 'center') {
  return scene.add.text(x, y, text, {
    fontFamily: UI.font,
    fontSize: '14px',
    color: rgba(accent),
    fontStyle: 'italic',
    stroke: '#000000',
    strokeThickness: 5,
    letterSpacing: 3,
  }).setOrigin(align === 'left' ? 0 : align === 'right' ? 1 : 0.5, 0.5);
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
