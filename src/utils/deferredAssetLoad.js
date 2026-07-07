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

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

let loading = false;

/** Load textures via Image() — does NOT use Phaser's loader (won't freeze the menu). */
export async function loadAssetsInBackground(scene) {
  if (scene.registry.get('allAssetsReady')) return;
  if (loading) return;

  const pending = missingAssets(scene, ALL_ASSETS);
  if (pending.length === 0) {
    finishBackgroundLoad(scene);
    return;
  }

  loading = true;
  const failed = [];

  for (const [key, url] of pending) {
    if (scene.registry.get('allAssetsReady')) break;
    if (scene.textures.exists(key)) continue;
    try {
      const img = await loadImage(url);
      if (!scene.textures.exists(key)) {
        scene.textures.addImage(key, img);
        applySmoothFilter(scene, key);
      }
    } catch (err) {
      console.warn('[backgroundLoad]', key, err);
      failed.push(key);
    }
    // Yield so the menu stays responsive.
    await new Promise((r) => setTimeout(r, 0));
  }

  loading = false;
  finishBackgroundLoad(scene);
  if (failed.length) {
    console.warn('[backgroundLoad] missing:', failed.join(', '));
  }
}

function finishBackgroundLoad(scene) {
  quickFinalizeTextures(scene);
  scene.registry.set('allAssetsReady', true);
  scene.registry.set('assetsFinalized', true);
  scene.registry.set('assetsReady', true);
  scene.registry.set('menuAssetsReady', true);
  scene.events.emit('deferred-assets-ready');
  scene.game.events.emit('deferred-assets-ready');
}

export function ensureDeferredAssets(scene) {
  loadAssetsInBackground(scene).catch((err) => {
    console.error('[backgroundLoad] fatal:', err);
    finishBackgroundLoad(scene);
  });
}

export function isAllAssetsReady(scene) {
  return scene.registry.get('allAssetsReady') === true;
}
