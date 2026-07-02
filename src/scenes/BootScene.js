import Phaser from 'phaser';
import { allAssetsLoaded } from './PreloadScene.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    const cached = this.registry.get('assetsReady') && allAssetsLoaded(this);
    this.time.delayedCall(0, () => {
      this.scene.start(cached ? 'MenuScene' : 'PreloadScene');
    });
  }
}
