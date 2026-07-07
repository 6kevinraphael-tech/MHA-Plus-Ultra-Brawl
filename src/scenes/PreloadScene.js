import Phaser from 'phaser';
import { applySmoothFilter } from '../data/spriteSheets.js';
import {
  allAssetsLoaded,
  BOOT_ASSETS,
  missingAssets,
} from '../utils/assetFinalize.js';
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
import { resetSceneTransition } from '../utils/sceneTransition.js';

const MAX_LOAD_RETRIES = 2;
const LOAD_TIMEOUT_MS = 8000;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  init(data) {
    this._finished = false;
    this._retryCount = data?.retryCount ?? 0;
    this._loadBar = null;
    this._loadTimeout = null;
    this._wallTimeout = null;
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

    for (const [key, url] of BOOT_ASSETS) {
      if (!this.textures.exists(key)) {
        this.load.image(key, url);
      }
    }

    this.startLoadTimeout();
  }

  create() {
    this.cameras.main.setAlpha(1);
    this.clearLoadTimeout();
    if (this._loadBar) setMhaLoadingBar(this._loadBar, 1);

    if (this.registry.get('menuAssetsReady')) {
      this.goToMenu();
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

    const missing = missingAssets(this, BOOT_ASSETS);
    if (missing.length > 0 && this._retryCount < MAX_LOAD_RETRIES) {
      this._retryCount += 1;
      console.warn(`Preload retry ${this._retryCount}/${MAX_LOAD_RETRIES}:`, missing.map(([k]) => k));
      this.time.delayedCall(200, () => {
        if (this._finished || !this.scene.isActive('PreloadScene')) return;
        this.scene.restart({ retryCount: this._retryCount });
      });
      return;
    }

    if (missing.length > 0) {
      console.error('Starting with missing menu assets:', missing.map(([k, u]) => `${k} → ${u}`));
    }

    this.finishAndGoToMenu();
  }

  finishAndGoToMenu() {
    if (this._finished) return;
    this._finished = true;
    this.clearLoadTimeout();

    for (const [key] of BOOT_ASSETS) {
      if (this.textures.exists(key)) {
        try {
          applySmoothFilter(this, key);
        } catch (err) {
          console.warn('[PreloadScene] filter failed:', key, err);
        }
      }
    }

    this.registry.set('menuAssetsReady', true);
    this.goToMenu();
  }

  goToMenu() {
    resetSceneTransition(this);

    const launchMenu = () => {
      this.clearMenuFallback();
      if (!this.scene.get('MenuScene')) return;
      this.scene.start('MenuScene');
    };

    this.time.delayedCall(16, launchMenu);
    this._menuFallbackTimer = window.setTimeout(launchMenu, 120);
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
      console.warn('[PreloadScene] load timeout — opening menu');
      this.finishAndGoToMenu();
    });
    this._wallTimeout = window.setTimeout(() => {
      if (this._finished || !this.scene.isActive('PreloadScene')) return;
      console.warn('[PreloadScene] wall-clock timeout — opening menu');
      this.finishAndGoToMenu();
    }, LOAD_TIMEOUT_MS + 500);
  }

  clearLoadTimeout() {
    this._loadTimeout?.remove();
    this._loadTimeout = null;
    if (this._wallTimeout != null) {
      window.clearTimeout(this._wallTimeout);
      this._wallTimeout = null;
    }
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
