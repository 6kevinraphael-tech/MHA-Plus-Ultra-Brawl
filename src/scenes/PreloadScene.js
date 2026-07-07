import Phaser from 'phaser';
import { resetSceneTransition } from '../utils/sceneTransition.js';

/** Legacy scene — boot now goes straight to MenuScene. Redirect if reached. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  create() {
    resetSceneTransition(this);
    try {
      if (this.load.isLoading()) this.load.reset();
    } catch {
      /* ignore */
    }
    this.registry.set('menuAssetsReady', true);
    this.scene.start('MenuScene');
  }
}

export { allAssetsLoaded } from '../utils/assetFinalize.js';
