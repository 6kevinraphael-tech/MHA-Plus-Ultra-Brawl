import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../data/characters.js';
import { comicTitle, UI } from './uiTheme.js';
import { SFX } from './audio.js';

const THEMES = {
  'deku-dark': {
    flash: [0, 255, 255],
    flash2: [80, 220, 255],
    overlay: 0x001820,
    accentText: '#00e5ff',
    sub: 'ONE FOR ALL — 100%',
  },
  'shigaraki-afo': {
    flash: [180, 80, 255],
    flash2: [255, 120, 80],
    overlay: 0x180018,
    accentText: '#e056fd',
    sub: 'ALL FOR ONE',
  },
  'dabi-cremation': {
    flash: [56, 189, 248],
    flash2: [14, 165, 233],
    overlay: 0x020818,
    accentText: '#38bdf8',
    sub: 'CREMATION',
  },
};

function fitSplash(scene, key, maxH = 340) {
  if (!scene.textures.exists(key)) return null;
  const img = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, key).setDepth(UI.overlayDepth + 8);
  const targetScale = maxH / img.height;
  img.setScale(targetScale * 0.15).setAlpha(0);
  img.setData('targetScale', targetScale);
  return img;
}

function releaseFight(scene) {
  scene._awakenCineActive = false;
  scene.tweens.timeScale = 1;
  scene.physics.world.timeScale = 1;
  if (!scene.roundOver && !scene.matchOver) {
    scene.physics.resume();
    scene.fightStarted = true;
  }
}

/** Shorter awaken cutscene — no tendrils, minimal objects. */
export function playAwakenCinematic(scene, fighter, payload = {}) {
  if (scene._awakenCineActive) return;
  scene._awakenCineActive = true;

  const label = payload.label ?? 'AWAKENED';
  const transformKey = payload.transformKey;
  const theme = THEMES[payload.theme] ?? THEMES['shigaraki-afo'];
  const cam = scene.cameras.main;

  scene.fightStarted = false;
  scene.physics.pause();

  const overlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, theme.overlay, 0.72)
    .setDepth(UI.overlayDepth + 1);

  SFX.special();
  cam.flash(120, theme.flash[0], theme.flash[1], theme.flash[2], false);
  scene.time.delayedCall(100, () => cam.flash(160, theme.flash2[0], theme.flash2[1], theme.flash2[2], false));

  const prevZoom = cam.zoom;
  cam.zoomTo(1.1, 300, 'Quad.easeOut');

  const splash = transformKey ? fitSplash(scene, transformKey, 360) : null;
  if (splash) {
    const targetScale = splash.getData('targetScale') * 1.05;
    scene.tweens.add({
      targets: splash,
      scale: targetScale,
      alpha: 1,
      duration: 280,
      ease: 'Back.easeOut',
    });
    scene.tweens.add({
      targets: splash,
      alpha: 0,
      delay: 650,
      duration: 200,
      onComplete: () => splash.destroy(),
    });
  }

  const title = comicTitle(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 130, label, {
    size: 34,
    color: theme.accentText,
    depth: UI.overlayDepth + 10,
    accent: '#000000',
  }).setAlpha(0);

  const sub = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 168, theme.sub, {
    fontFamily: UI.font,
    fontSize: '12px',
    color: theme.accentText,
    letterSpacing: 4,
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(UI.overlayDepth + 10).setAlpha(0);

  scene.tweens.add({ targets: [title, sub], alpha: 1, duration: 200, delay: 200 });
  cam.shake(300, 0.01);

  scene.time.delayedCall(850, () => {
    scene.tweens.add({
      targets: [title, sub, overlay],
      alpha: 0,
      duration: 200,
      onComplete: () => {
        title.destroy();
        sub.destroy();
        overlay.destroy();
      },
    });
    cam.zoomTo(prevZoom, 280, 'Quad.easeInOut');
  });

  scene.time.delayedCall(1100, () => {
    releaseFight(scene);
    fighter.body.setAlpha(1);
    cam.flash(80, 255, 255, 255, false);
  });
}

export function cleanupAwakenCinematic(scene) {
  if (scene._awakenCineActive) {
    releaseFight(scene);
  }
}
