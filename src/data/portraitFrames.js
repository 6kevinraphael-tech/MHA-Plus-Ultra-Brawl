import { ALL_CHARACTERS } from './characters.js';
import { getPortraitCrop } from './portraits.js';

/** Bake each roster cell into a named sub-frame on the sheet texture. */
export function registerPortraitFrames(scene) {
  for (const char of ALL_CHARACTERS) {
    if (!scene.textures.exists(char.roster)) continue;

    const tex = scene.textures.get(char.roster);
    const crop = getPortraitCrop(char, tex);
    if (!crop) continue;

    const frameKey = `${char.id}-portrait`;
    if (tex.has(frameKey)) tex.remove(frameKey);
    tex.add(frameKey, 0, crop.cropX, crop.cropY, crop.cropW, crop.cropH);
  }
}

export function getPortraitFrameKey(characterId) {
  return `${characterId}-portrait`;
}
