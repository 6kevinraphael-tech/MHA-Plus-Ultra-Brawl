import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    // Skip PreloadScene entirely — Phaser can block scene.start() while a loader is active.
    this.registry.set('menuAssetsReady', true);
    this.time.delayedCall(0, () => {
      this.scene.start('MenuScene');
    });
  }
}
