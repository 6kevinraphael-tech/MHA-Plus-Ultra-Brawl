import Phaser from 'phaser';
import { applySmoothFilter, makeSheetTransparent, solidifyCharacterImageAlpha } from '../data/spriteSheets.js';
import { registerPortraitFrames } from '../data/portraitFrames.js';
import { registerBattleFrames } from '../data/battleFrames.js';
import {
  comicTitle,
  drawBackdrop,
  drawHalftoneOverlay,
  drawMhaLoadingBar,
  label,
  setMhaLoadingBar,
  UI,
} from '../utils/uiTheme.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../data/characters.js';
import { CHARACTER_IMAGE_ASSETS } from '../data/characterImages.js';
import { UI_ASSETS } from '../data/uiAssets.js';
import { resetSceneTransition } from '../utils/sceneTransition.js';

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

const CORE_ASSETS = [...UI_ASSETS, ...ROSTER_ASSETS, ...SPRITE_ASSETS, ...BG_ASSETS, ...CHARACTER_IMAGE_ASSETS];

const FILTER_KEYS = [...UI_ASSETS, ...ROSTER_ASSETS, ...BG_ASSETS, ...CHARACTER_IMAGE_ASSETS];
const MAX_LOAD_RETRIES = 3;
const LOAD_TIMEOUT_MS = 15000;
const FINALIZE_TIMEOUT_MS = 45000;
const IMAGES_PER_FRAME = 1;

function missingAssets(scene) {
  return CORE_ASSETS.filter(([key]) => !scene.textures.exists(key));
}

function allAssetsLoaded(scene) {
  return missingAssets(scene).length === 0;
}

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  init(data) {
    this._finished = false;
    this._retryCount = data?.retryCount ?? 0;
    this._loadBar = null;
    this._loadTimeout = null;
    this._finalizeTimeout = null;
    this._statusLabel = null;
  }

  preload() {
    this.cameras.main.setBackgroundColor('#06080f');
    this.showLoadingUi();

    this.load.on('progress', (value) => {
      if (this._loadBar) setMhaLoadingBar(this._loadBar, value * 0.55);
    });
    this.load.on('loaderror', (file) => {
      console.error('Failed to load asset:', file.key, file.url);
    });

    for (const [key, url] of CORE_ASSETS) {
      if (!this.textures.exists(key)) {
        this.load.image(key, url);
      }
    }

    if (this.load.totalToLoad > 0) {
      this.startLoadTimeout();
    }
  }

  create() {
    this.cameras.main.setAlpha(1);
    this.clearLoadTimeout();

    if (this.registry.get('assetsReady') && this.registry.get('assetsFinalized') && allAssetsLoaded(this)) {
      this.finishAndGoToMenu();
      return;
    }

    this.handleLoadResult();
  }

  showLoadingUi() {
    if (this._loadBar) return;

    drawBackdrop(this, UI.mhaRed);
    drawHalftoneOverlay(this, 5, 0.04, 36);

    comicTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, 'LOADING', {
      size: 36, color: UI.goldText, depth: 10,
    });
    this._statusLabel = label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12, 'PLUS ULTRA', {
      fontSize: '11px', color: UI.textMuted, letterSpacing: 6, depth: 10,
    });

    this._loadBar = drawMhaLoadingBar(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 28, 400, 10);
    setMhaLoadingBar(this._loadBar, 0);
  }

  handleLoadResult() {
    if (this._finished) return;

    const missing = missingAssets(this);
    if (missing.length > 0 && this._retryCount < MAX_LOAD_RETRIES) {
      this._retryCount += 1;
      console.warn(`Preload retry ${this._retryCount}/${MAX_LOAD_RETRIES}:`, missing.map(([k]) => k));
      this.time.delayedCall(300, () => {
        if (this._finished || !this.scene.isActive('PreloadScene')) return;
        this.scene.restart({ retryCount: this._retryCount });
      });
      return;
    }

    if (missing.length > 0) {
      console.error('Starting with missing assets:', missing.map(([k, u]) => `${k} → ${u}`));
    }

    this.finishAndGoToMenu();
  }

  finishAndGoToMenu() {
    if (this._finished) return;
    this._finished = true;
    this.clearLoadTimeout();

    if (this.registry.get('assetsFinalized')) {
      this.registry.set('assetsReady', true);
      this.registry.set('preloadRetryCount', 0);
      this.goToMenu();
      return;
    }

    this._statusLabel?.setText('PROCESSING FIGHTERS');
    this.startFinalizeTimeout();
    this.finalizeAssetsBatched(() => {
      this.clearFinalizeTimeout();
      this.registry.set('assetsFinalized', true);
      this.registry.set('assetsReady', true);
      this.registry.set('preloadRetryCount', 0);
      this.goToMenu();
    });
  }

  finalizeAssetsBatched(onComplete) {
    for (const [key] of FILTER_KEYS) {
      if (this.textures.exists(key)) {
        try {
          applySmoothFilter(this, key);
        } catch (err) {
          console.warn('[PreloadScene] filter failed:', key, err);
        }
      }
    }

    const imageKeys = CHARACTER_IMAGE_ASSETS
      .map(([key]) => key)
      .filter((key) => this.textures.exists(key));

    let index = 0;

    const step = () => {
      if (!this.scene.isActive('PreloadScene')) return;

      let batch = 0;
      while (batch < IMAGES_PER_FRAME && index < imageKeys.length) {
        const key = imageKeys[index];
        index += 1;
        batch += 1;
        try {
          solidifyCharacterImageAlpha(this, key);
        } catch (err) {
          console.warn('[PreloadScene] alpha bake failed:', key, err);
        }
      }

      const progress = 0.55 + (imageKeys.length > 0 ? (index / imageKeys.length) * 0.45 : 0.45);
      if (this._loadBar) setMhaLoadingBar(this._loadBar, progress);

      if (index < imageKeys.length) {
        this.time.delayedCall(0, step);
        return;
      }

      for (const [key] of SPRITE_ASSETS) {
        if (this.textures.exists(key)) {
          try {
            makeSheetTransparent(this, key);
          } catch (err) {
            console.warn('[PreloadScene] transparency bake failed:', key, err);
          }
        }
      }

      try {
        registerPortraitFrames(this);
        registerBattleFrames(this);
      } catch (err) {
        console.warn('[PreloadScene] frame registration failed:', err);
      }

      if (this._loadBar) setMhaLoadingBar(this._loadBar, 1);
      onComplete();
    };

    step();
  }

  goToMenu() {
    resetSceneTransition(this);
    // Defer — Phaser ignores scene.start() when called synchronously from create().
    // Don't gate on isActive(); the scene isn't marked active until create() returns.
    this.time.delayedCall(0, () => {
      this.scene.start('MenuScene');
    });
  }

  startLoadTimeout() {
    this.clearLoadTimeout();
    this._loadTimeout = this.time.delayedCall(LOAD_TIMEOUT_MS, () => {
      if (this._finished || !this.scene.isActive('PreloadScene')) return;
      console.warn('[PreloadScene] load timeout — continuing to menu');
      this.finishAndGoToMenu();
    });
  }

  startFinalizeTimeout() {
    this.clearFinalizeTimeout();
    this._finalizeTimeout = this.time.delayedCall(FINALIZE_TIMEOUT_MS, () => {
      if (!this.scene.isActive('PreloadScene')) return;
      console.warn('[PreloadScene] finalize timeout — continuing to menu');
      this.clearFinalizeTimeout();
      this.registry.set('assetsFinalized', true);
      this.registry.set('assetsReady', true);
      this.goToMenu();
    });
  }

  clearLoadTimeout() {
    this._loadTimeout?.remove();
    this._loadTimeout = null;
  }

  clearFinalizeTimeout() {
    this._finalizeTimeout?.remove();
    this._finalizeTimeout = null;
  }

  shutdown() {
    this.clearLoadTimeout();
    this.clearFinalizeTimeout();
    this.load.off('progress');
    this.load.off('loaderror');
    this._loadBar = null;
    this._statusLabel = null;
  }
}

export { allAssetsLoaded };
