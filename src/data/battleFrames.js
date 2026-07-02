import Phaser from 'phaser';
import {
  getAllBattleFrameRegistrations,
  getBattleFrameKey,
} from './characterSprites.js';

/** Bake each battle animation frame into a named sub-frame on the sprite sheet texture. */
export function registerBattleFrames(scene) {
  const sheets = new Set();

  for (const entry of getAllBattleFrameRegistrations()) {
    if (!scene.textures.exists(entry.sheet)) continue;

    sheets.add(entry.sheet);
    const tex = scene.textures.get(entry.sheet);
    const frameKey = getBattleFrameKey(entry.characterId, entry.animName, entry.index);
    const { x, y, w, h } = entry.frame;

    if (tex.has(frameKey)) tex.remove(frameKey);
    tex.add(frameKey, 0, x, y, w, h);
  }

  for (const sheet of sheets) {
    applyBattlePixelFilter(scene, sheet);
  }
}

export function applyBattlePixelFilter(scene, sheetKey) {
  const tex = scene.textures.get(sheetKey);
  if (tex) tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
}
