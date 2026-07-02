import Phaser from 'phaser';
import { GAME_WIDTH } from '../data/characters.js';

const NEUTRAL = {
  moveTargetX: null,
  left: false,
  right: false,
  jump: false,
  light: false,
  heavy: false,
  special: false,
  launcher: false,
  aerial: false,
  dash: false,
  block: false,
};

/** P1 — mouse move + mouse/keyboard attacks. */
export class MouseFightInput {
  constructor(scene) {
    this.scene = scene;
    this.keys = scene.input.keyboard.addKeys({
      jump: 'SPACE',
      special: 'S',
      launcher: 'E',
      dash: 'Q',
      block: 'SHIFT',
    });

    this._light = false;
    this._heavy = false;

    scene.input.mouse?.disableContextMenu();

    this._onPointerDown = (pointer) => {
      if (pointer.button === 0) this._light = true;
      if (pointer.button === 2) this._heavy = true;
    };
    scene.input.on('pointerdown', this._onPointerDown);
  }

  destroy() {
    if (this._onPointerDown) {
      this.scene.input.off('pointerdown', this._onPointerDown);
      this._onPointerDown = null;
    }
  }

  poll(pointer) {
    const p = pointer ?? this.scene.input.activePointer;
    const moveTargetX = Phaser.Math.Clamp(p.worldX, 40, GAME_WIDTH - 40);

    return {
      moveTargetX,
      left: false,
      right: false,
      jump: Phaser.Input.Keyboard.JustDown(this.keys.jump),
      light: this._light,
      heavy: this._heavy,
      special: Phaser.Input.Keyboard.JustDown(this.keys.special),
      launcher: Phaser.Input.Keyboard.JustDown(this.keys.launcher),
      aerial: this._light,
      dash: Phaser.Input.Keyboard.JustDown(this.keys.dash),
      block: this.keys.block.isDown,
    };
  }

  consumeFrame() {
    this._light = false;
    this._heavy = false;
  }
}

/** P2 — keyboard (2P mode). */
export class KeyboardFightInput {
  constructor(scene, prefix = 'p2') {
    this.k = scene.input.keyboard.addKeys({
      left: 'LEFT',
      right: 'RIGHT',
      jump: 'UP',
      light: 'K',
      heavy: 'L',
      special: 'SEMICOLON',
      launcher: 'I',
      dash: 'O',
      block: 'DOWN',
    });
  }

  poll() {
    return {
      moveTargetX: null,
      left: this.k.left.isDown,
      right: this.k.right.isDown,
      jump: Phaser.Input.Keyboard.JustDown(this.k.jump),
      light: Phaser.Input.Keyboard.JustDown(this.k.light),
      heavy: Phaser.Input.Keyboard.JustDown(this.k.heavy),
      special: Phaser.Input.Keyboard.JustDown(this.k.special),
      launcher: Phaser.Input.Keyboard.JustDown(this.k.launcher),
      aerial: Phaser.Input.Keyboard.JustDown(this.k.light),
      dash: Phaser.Input.Keyboard.JustDown(this.k.dash),
      block: this.k.block.isDown,
    };
  }

  consumeFrame() {}
}

/** Receives the remote player's latest control frame (host uses for P2). */
export class NetworkFightInput {
  constructor() {
    this.remote = { ...NEUTRAL };
  }

  setRemote(controls) {
    this.remote = { ...NEUTRAL, ...controls };
  }

  poll() {
    return this.remote;
  }

  consumeFrame() {
    this.remote = {
      ...this.remote,
      jump: false,
      light: false,
      heavy: false,
      special: false,
      launcher: false,
      aerial: false,
      dash: false,
    };
  }
}

export { NEUTRAL };
