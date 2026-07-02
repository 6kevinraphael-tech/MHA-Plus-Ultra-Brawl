import { applySmoothFilter } from '../data/spriteSheets.js';
import { getAssetsForCharacter, getAssetsForCharacters } from '../data/characterImages.js';

export function isCharacterLoaded(scene, characterId) {
  const assets = getAssetsForCharacter(characterId);
  if (assets.length === 0) return true;
  return assets.every(([key]) => scene.textures.exists(key));
}

export function areCharactersLoaded(scene, characterIds) {
  return characterIds.every((id) => isCharacterLoaded(scene, id));
}

function applyFilters(scene, assets) {
  for (const [key] of assets) {
    if (scene.textures.exists(key)) applySmoothFilter(scene, key);
  }
}

/** Load PNG pose art for one or more fighters. Resolves when textures are ready. */
export function loadCharacters(scene, characterIds) {
  const assets = getAssetsForCharacters(characterIds);
  const pending = assets.filter(([key]) => !scene.textures.exists(key));

  if (pending.length === 0) {
    applyFilters(scene, assets);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const loader = scene.load;

    const finish = () => {
      loader.off('complete', finish);
      loader.off('loaderror', onError);
      applyFilters(scene, assets);
      loader.reset();
      resolve();
    };

    const onError = (file) => {
      console.error('Failed to load character asset:', file?.key, file?.src ?? file?.url);
    };

    if (loader.isLoading()) {
      loader.once('complete', () => loadCharacters(scene, characterIds).then(resolve));
      return;
    }

    loader.reset();
    loader.once('complete', finish);
    loader.on('loaderror', onError);

    for (const [key, url] of pending) {
      loader.image(key, url);
    }

    loader.start();
  });
}
