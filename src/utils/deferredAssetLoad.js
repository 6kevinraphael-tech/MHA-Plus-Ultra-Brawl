import {
  DEFERRED_ASSETS,
  BOOT_ASSETS,
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
  scene.registry.set('menuAssetsReady', true);
  scene.events.emit('deferred-assets-ready');
  scene.game.events.emit('deferred-assets-ready');
}

function clearLoadTimeout() {
  if (loadTimeoutId != null) {
    window.clearTimeout(loadTimeoutId);
    loadTimeoutId = null;
  }
}

function stopLoader(scene) {
  try {
    if (scene.load.isLoading()) scene.load.reset();
  } catch {
    /* ignore */
  }
}

export function isAllAssetsReady(scene) {
  return scene.registry.get('allAssetsReady') === true;
}

/** Load game art in the background — must NOT run during scene create(). */
export function ensureDeferredAssets(scene) {
  if (isAllAssetsReady(scene)) return;

  const begin = () => startDeferredLoad(scene);

  if (scene.time) {
    scene.time.delayedCall(0, begin);
  } else {
    window.setTimeout(begin, 0);
  }
}

function startDeferredLoad(scene) {
  if (isAllAssetsReady(scene)) return;

  const allMissing = [
    ...missingAssets(scene, BOOT_ASSETS),
    ...missingAssets(scene, DEFERRED_ASSETS),
  ];
  if (allMissing.length === 0) {
    markReady(scene);
    return;
  }

  if (activeLoaderScene === scene && scene.load.isLoading()) return;

  activeLoaderScene = scene;
  stopLoader(scene);
  scene.load.off('complete');
  scene.load.off('loaderror');

  const seen = new Set();
  for (const [key, url] of [...BOOT_ASSETS, ...DEFERRED_ASSETS]) {
    if (seen.has(key) || scene.textures.exists(key)) continue;
    seen.add(key);
    scene.load.image(key, url);
  }

  if (scene.load.totalToLoad === 0) {
    activeLoaderScene = null;
    markReady(scene);
    return;
  }

  scene.load.once('loaderror', (file) => {
    console.error('[deferredAssets] failed:', file.key, file.url);
  });

  scene.load.once('complete', () => {
    clearLoadTimeout();
    activeLoaderScene = null;
    markReady(scene);
  });

  clearLoadTimeout();
  loadTimeoutId = window.setTimeout(() => {
    loadTimeoutId = null;
    activeLoaderScene = null;
    if (isAllAssetsReady(scene)) return;
    console.warn('[deferredAssets] timeout — continuing with loaded textures');
    stopLoader(scene);
    markReady(scene);
  }, 25000);

  scene.load.start();
}
