import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_Y } from '../data/characters.js';
import { getArenaById, pickRandomArena } from '../data/backgrounds.js';
import { applySmoothFilter } from '../data/spriteSheets.js';
import { label, UI } from './uiTheme.js';

export function drawArena(scene, arena) {
  const def = arena?.imageKey ? arena : getArenaById(arena?.id ?? 'ua-entrance');

  if (scene.textures.exists(def.imageKey)) {
    applySmoothFilter(scene, def.imageKey);
    const bg = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, def.imageKey);
    bg.setDepth(-30);

    const scaleX = GAME_WIDTH / bg.width;
    const scaleY = GAME_HEIGHT / bg.height;
    bg.setScale(Math.max(scaleX, scaleY));

    if (def.parallaxTint) {
      const tint = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, def.parallaxTint, 0.12)
        .setDepth(-29);
      scene.tweens.add({
        targets: tint,
        alpha: { from: 0.08, to: 0.16 },
        duration: 3200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  } else {
    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1030)
      .setDepth(-30);
  }

  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020408, 0.38).setDepth(-28);
  scene.add.rectangle(GAME_WIDTH / 2, GROUND_Y + 28, GAME_WIDTH, 80, 0x020408, 0.5).setDepth(-27);

  const floorGlow = scene.add.graphics().setDepth(-26);
  floorGlow.lineStyle(2, UI.accent, 0.35);
  floorGlow.lineBetween(40, GROUND_Y, GAME_WIDTH - 40, GROUND_Y);
  floorGlow.lineStyle(1, UI.mhaBlue, 0.15);
  floorGlow.lineBetween(0, GROUND_Y + 1, GAME_WIDTH, GROUND_Y + 1);

  spawnArenaParticles(scene, def);

  scene.locationLabel = label(scene, 20, GAME_HEIGHT - 58, def.name, {
    fontSize: '10px',
    color: UI.textMuted,
    letterSpacing: 2,
    originX: 0,
    originY: 0.5,
  }).setDepth(UI.hudDepth);

  scene.showLabel = label(scene, 20, GAME_HEIGHT - 44, def.show, {
    fontSize: '9px',
    color: UI.textDim,
    letterSpacing: 1,
    originX: 0,
    originY: 0.5,
  }).setDepth(UI.hudDepth);

  scene.arenaDef = def;
  return def;
}

function spawnArenaParticles(scene, arena) {
  const cfg = arena.particles;
  if (!cfg) return;

  const rate = cfg.rate ?? 2000;
  scene.arenaParticleTimer = scene.time.addEvent({
    delay: rate,
    loop: true,
    callback: () => {
      if (scene.matchOver || scene.paused) return;
      spawnParticle(scene, cfg);
    },
  });
}

function spawnParticle(scene, cfg) {
  const x = Math.random() * GAME_WIDTH;
  const y = cfg.type === 'dust' ? GROUND_Y - 8 : -10;
  const size = cfg.type === 'embers' ? 3 + Math.random() * 4 : 4 + Math.random() * 5;
  const color = Math.random() < 0.5 ? cfg.color : (cfg.accent ?? cfg.color);

  const p = scene.add.circle(x, y, size, color, 0.55).setDepth(-20);

  const driftX = (Math.random() - 0.5) * 40;
  const driftY = cfg.type === 'leaves' ? 60 + Math.random() * 80
    : cfg.type === 'embers' ? 40 + Math.random() * 70
      : 20 + Math.random() * 30;

  scene.tweens.add({
    targets: p,
    x: x + driftX,
    y: y + driftY,
    alpha: 0,
    scale: cfg.type === 'embers' ? 0.2 : 0.6,
    angle: cfg.type === 'leaves' ? 90 + Math.random() * 180 : 0,
    duration: 2400 + Math.random() * 1600,
    ease: 'Sine.easeIn',
    onComplete: () => p.destroy(),
  });
}

export function getRandomArena() {
  return pickRandomArena();
}
