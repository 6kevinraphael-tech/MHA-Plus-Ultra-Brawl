import Phaser from 'phaser';
import { applySmoothFilter, makeSheetTransparent } from '../data/spriteSheets.js';
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

function missingAssets(scene) {
  return CORE_ASSETS.filter(([key]) => !scene.textures.exists(key));
}

function allAssetsLoaded(scene) {
  return missingAssets(scene).length === 0;
}

/** Fast texture setup only — never block the menu on per-pixel image baking. */
export function quickFinalizeTextures(scene) {
  for (const [key] of FILTER_KEYS) {
    if (scene.textures.exists(key)) {
      try {
        applySmoothFilter(scene, key);
      } catch (err) {
        console.warn('[PreloadScene] filter failed:', key, err);
      }
    }
  }

  for (const [key] of SPRITE_ASSETS) {
    if (scene.textures.exists(key)) {
      try {
        makeSheetTransparent(scene, key);
      } catch (err) {
        console.warn('[PreloadScene] transparency bake failed:', key, err);
      }
    }
  }

  try {
    registerPortraitFrames(scene);
    registerBattleFrames(scene);
  } catch (err) {
    console.warn('[PreloadScene] frame registration failed:', err);
  }
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
    this._menuFallbackTimer = null;
  }

  preload() {
    this.cameras.main.setBackgroundColor('#06080f');
    this.showLoadingUi();

    this.load.on('progress', (value) => {
      if (this._loadBar) setMhaLoadingBar(this._loadBar, value);
    });
    this.load.on('complete', () => {
      if (this._loadBar) setMhaLoadingBar(this._loadBar, 1);
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
    if (this._loadBar) setMhaLoadingBar(this._loadBar, 1);

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
    label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12, 'PLUS ULTRA', {
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

    if (!this.registry.get('assetsFinalized')) {
      quickFinalizeTextures(this);
      this.registry.set('assetsFinalized', true);
    }

    this.registry.set('assetsReady', true);
    this.registry.set('preloadRetryCount', 0);
    this.goToMenu();
  }

  goToMenu() {
    resetSceneTransition(this);

    const launchMenu = () => {
      if (!this.scene.isActive('PreloadScene')) return;
      this.clearMenuFallback();
      this.scene.start('MenuScene');
    };

    // Defer past create() — Phaser can ignore scene.start() in the same frame.
    this.time.delayedCall(50, launchMenu);

    // Browser timer fallback in case the scene clock is delayed.
    this._menuFallbackTimer = window.setTimeout(() => {
      if (this.scene?.isActive?.('PreloadScene')) {
        console.warn('[PreloadScene] fallback menu transition');
        launchMenu();
      }
    }, 400);
  }

  clearMenuFallback() {
    if (this._menuFallbackTimer != null) {
      window.clearTimeout(this._menuFallbackTimer);
      this._menuFallbackTimer = null;
    }
  }

  startLoadTimeout() {
    this.clearLoadTimeout();
    this._loadTimeout = this.time.delayedCall(LOAD_TIMEOUT_MS, () => {
      if (this._finished || !this.scene.isActive('PreloadScene')) return;
      console.warn('[PreloadScene] load timeout — continuing to menu');
      this.finishAndGoToMenu();
    });
  }

  clearLoadTimeout() {
    this._loadTimeout?.remove();
    this._loadTimeout = null;
  }

  shutdown() {
    this.clearLoadTimeout();
    this.clearMenuFallback();
    this.load.off('progress');
    this.load.off('complete');
    this.load.off('loaderror');
    this._loadBar = null;
  }
}

export { allAssetsLoaded };
