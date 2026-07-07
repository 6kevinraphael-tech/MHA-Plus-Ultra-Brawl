import Phaser from 'phaser';
import { resetSceneTransition } from '../utils/sceneTransition.js';

/** Legacy redirect — boot goes straight to MenuScene. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  create() {
    resetSceneTransition(this);
    this.registry.set('menuAssetsReady', true);
    this.scene.start('MenuScene');
  }
}

export { allAssetsLoaded } from '../utils/assetFinalize.js';
