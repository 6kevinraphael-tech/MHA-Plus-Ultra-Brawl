import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.registry.set('menuAssetsReady', true);
    const openMenu = () => this.scene.start('MenuScene');
    this.time.delayedCall(16, openMenu);
    window.setTimeout(openMenu, 120);
  }
}
