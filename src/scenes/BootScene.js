import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    const cached = this.registry.get('menuAssetsReady') === true;
    this.time.delayedCall(0, () => {
      this.scene.start(cached ? 'MenuScene' : 'PreloadScene');
    });
  }
}
