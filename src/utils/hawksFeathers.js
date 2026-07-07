import { UI } from './uiTheme.js';

const FEATHER_DEPTH = 86;
const ORBIT_RADIUS = 56;

export function getHawkFeatherMax(config) {
  return config?.hawkFeatherMax ?? 12;
}

export function getHawkFeatherDamage(config) {
  return config?.hawkFeatherDamage ?? 6;
}

export function calcHawksBurstDamage(attackerConfig, featherCount) {
  const base = attackerConfig?.specialDamage ?? 8;
  if (!featherCount || featherCount <= 0) return base;
  return featherCount * getHawkFeatherDamage(attackerConfig);
}

/** Orbits feather sprites in a ring around a fighter. */
export class HawkFeatherRing {
  constructor(scene, featherKey = 'img-hawks-feather') {
    this.scene = scene;
    this.featherKey = featherKey;
    this.entries = new Map();
    this.spin = 0;
  }

  ensureEntry(fighter) {
    if (!this.entries.has(fighter)) {
      this.entries.set(fighter, { sprites: [], burstTween: null });
    }
    return this.entries.get(fighter);
  }

  addFeather(fighter, maxCount) {
    if (!fighter || fighter.isDead) return;
    fighter.hawkFeatherCount = Math.min(maxCount, (fighter.hawkFeatherCount ?? 0) + 1);
    this.rebuild(fighter);
  }

  rebuild(fighter) {
    const entry = this.ensureEntry(fighter);
    for (const spr of entry.sprites) spr.destroy();
    entry.sprites = [];

    const count = fighter.hawkFeatherCount ?? 0;
    if (count <= 0 || !this.scene.textures.exists(this.featherKey)) return;

    for (let i = 0; i < count; i += 1) {
      const spr = this.scene.add.image(0, 0, this.featherKey).setDepth(FEATHER_DEPTH);
      spr.setDisplaySize(22, 34);
      spr.setOrigin(0.5, 0.5);
      entry.sprites.push(spr);
    }
    this.layout(fighter);
  }

  layout(fighter) {
    const entry = this.entries.get(fighter);
    if (!entry) return;
    const count = entry.sprites.length;
    if (!count || !fighter.body) return;

    const cx = fighter.body.x;
    const cy = fighter.body.y - 72;
    const step = (Math.PI * 2) / count;

    entry.sprites.forEach((spr, i) => {
      const angle = this.spin + i * step;
      spr.x = cx + Math.cos(angle) * ORBIT_RADIUS;
      spr.y = cy + Math.sin(angle) * ORBIT_RADIUS * 0.55;
      spr.angle = Phaser.Math.RadToDeg(angle) + 90;
    });
  }

  update() {
    this.spin += 0.018;
    for (const fighter of this.entries.keys()) {
      if (fighter.isDead || (fighter.hawkFeatherCount ?? 0) <= 0) {
        this.clear(fighter);
        continue;
      }
      this.layout(fighter);
    }
  }

  burst(fighter, onComplete) {
    const entry = this.entries.get(fighter);
    if (!entry || entry.sprites.length === 0) {
      onComplete?.();
      return;
    }

    const cx = fighter.body?.x ?? 0;
    const cy = (fighter.body?.y ?? 0) - 72;
    const sprites = [...entry.sprites];
    entry.sprites = [];
    fighter.hawkFeatherCount = 0;

    let done = 0;
    const finishOne = () => {
      done += 1;
      if (done >= sprites.length) onComplete?.();
    };

    sprites.forEach((spr, i) => {
      this.scene.tweens.add({
        targets: spr,
        x: cx,
        y: cy,
        scaleX: 1.35,
        scaleY: 1.35,
        alpha: 0.95,
        duration: 220 + i * 18,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          const flash = this.scene.add.circle(cx, cy, 10, 0xe74c3c, 0.7).setDepth(UI.fxDepth);
          this.scene.tweens.add({
            targets: flash,
            scale: 2.2,
            alpha: 0,
            duration: 180,
            onComplete: () => {
              flash.destroy();
              spr.destroy();
              finishOne();
            },
          });
        },
      });
    });
  }

  clear(fighter) {
    const entry = this.entries.get(fighter);
    if (!entry) return;
    for (const spr of entry.sprites) spr.destroy();
    entry.sprites = [];
    if (fighter) fighter.hawkFeatherCount = 0;
  }

  destroy() {
    for (const fighter of [...this.entries.keys()]) this.clear(fighter);
    this.entries.clear();
  }
}
