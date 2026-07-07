import {
  DEFERRED_ASSETS,
  missingAssets,
  quickFinalizeTextures,
} from './assetFinalize.js';

let activeLoaderScene = null;
let loadTimeoutId = null;

function markReady(scene) {
  quickFinalizeTextures(scene);
  scene.registry.set('allAssetsReady', true);
  scene.registry.set('assetsFinalized', true);
  scene.registry.set('assetsReady', true);
}

function clearLoadTimeout() {
  if (loadTimeoutId != null) {
    window.clearTimeout(loadTimeoutId);
    loadTimeoutId = null;
  }
}

export function isAllAssetsReady(scene) {
  return scene.registry.get('allAssetsReady') === true;
}

/** Load fighters, backgrounds, and roster in the background after the menu is visible. */
export function ensureDeferredAssets(scene) {
  if (isAllAssetsReady(scene)) return;

  const missing = missingAssets(scene, DEFERRED_ASSETS);
  if (missing.length === 0) {
    markReady(scene);
    return;
  }

  if (activeLoaderScene === scene && scene.load.isLoading()) return;

  activeLoaderScene = scene;
  scene.load.reset();
  scene.load.off('complete');
  scene.load.off('loaderror');

  for (const [key, url] of missing) {
    if (!scene.textures.exists(key)) {
      scene.load.image(key, url);
    }
  }

  if (scene.load.totalToLoad === 0) {
    markReady(scene);
    activeLoaderScene = null;
    return;
  }

  scene.load.once('loaderror', (file) => {
    console.error('[deferredAssets] failed:', file.key, file.url);
  });

  scene.load.once('complete', () => {
    clearLoadTimeout();
    activeLoaderScene = null;
    if (!scene.scene?.isActive?.(scene.scene.key)) return;
    markReady(scene);
  });

  clearLoadTimeout();
  loadTimeoutId = window.setTimeout(() => {
    loadTimeoutId = null;
    activeLoaderScene = null;
    if (isAllAssetsReady(scene)) return;
    console.warn('[deferredAssets] timeout — continuing with loaded textures');
    if (scene.load.isLoading()) scene.load.reset();
    markReady(scene);
  }, 20000);

  scene.load.start();
}
