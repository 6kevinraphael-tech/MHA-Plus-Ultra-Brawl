import { applySmoothFilter, makeSheetTransparent } from '../data/spriteSheets.js';
import { registerPortraitFrames } from '../data/portraitFrames.js';
import { registerBattleFrames } from '../data/battleFrames.js';
import { CHARACTER_IMAGE_ASSETS } from '../data/characterImages.js';
import { UI_ASSETS } from '../data/uiAssets.js';

const SPRITE_ASSETS = [];

const BG_ASSETS = [
  ['bg-ua-entrance', '/assets/backgrounds/ua-entrance.png'],
  ['bg-ua-campus', '/assets/backgrounds/ua-campus.png'],
  ['bg-city-streets', '/assets/backgrounds/city-streets.png'],
  ['bg-dojo', '/assets/backgrounds/dojo.png'],
  ['bg-ground-beta', '/assets/backgrounds/ground-beta.png'],
  ['bg-forest-camp', '/assets/backgrounds/forest-camp.png'],
];

const ROSTER_ASSETS = [
  ['mha-roster', '/assets/mha-roster.png'],
];

export const BOOT_ASSETS = [...UI_ASSETS];

export const DEFERRED_ASSETS = [
  ...ROSTER_ASSETS,
  ...SPRITE_ASSETS,
  ...BG_ASSETS,
  ...CHARACTER_IMAGE_ASSETS,
];

export const ALL_ASSETS = [...BOOT_ASSETS, ...DEFERRED_ASSETS];

const FILTER_KEYS = [...UI_ASSETS, ...ROSTER_ASSETS, ...BG_ASSETS, ...CHARACTER_IMAGE_ASSETS];

export function missingAssets(scene, assets = ALL_ASSETS) {
  return assets.filter(([key]) => !scene.textures.exists(key));
}

export function allAssetsLoaded(scene) {
  return missingAssets(scene, ALL_ASSETS).length === 0;
}

/** Fast texture setup only — never block the menu on per-pixel image baking. */
export function quickFinalizeTextures(scene) {
  for (const [key] of FILTER_KEYS) {
    if (scene.textures.exists(key)) {
      try {
        applySmoothFilter(scene, key);
      } catch (err) {
        console.warn('[assetFinalize] filter failed:', key, err);
      }
    }
  }

  for (const [key] of SPRITE_ASSETS) {
    if (scene.textures.exists(key)) {
      try {
        makeSheetTransparent(scene, key);
      } catch (err) {
        console.warn('[assetFinalize] transparency bake failed:', key, err);
      }
    }
  }

  try {
    registerPortraitFrames(scene);
    registerBattleFrames(scene);
  } catch (err) {
    console.warn('[assetFinalize] frame registration failed:', err);
  }
}
