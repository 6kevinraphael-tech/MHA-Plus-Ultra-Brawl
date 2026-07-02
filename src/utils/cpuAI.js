/**
 * CPU controller — outputs fight control objects (keyboard-style movement).
 * Per-character profiles shape how each fighter plays.
 */
import { NEUTRAL } from './fightControls.js';

const DIFFICULTY = {
  easy: {
    decisionMs: 245,
    aggression: 0.62,
    blockChance: 0.32,
    jumpChance: 0.10,
    specialBias: 0.48,
    approachRange: 78,
    reaction: 0.38,
  },
  normal: {
    decisionMs: 165,
    aggression: 0.78,
    blockChance: 0.52,
    jumpChance: 0.14,
    specialBias: 0.68,
    approachRange: 76,
    reaction: 0.52,
  },
  hard: {
    decisionMs: 98,
    aggression: 0.91,
    blockChance: 0.70,
    jumpChance: 0.17,
    specialBias: 0.84,
    approachRange: 74,
    reaction: 0.64,
  },
};

/** Character-specific AI tendencies layered on difficulty. */
const CPU_PROFILES = {
  stain: { aggressionMult: 1.35, blockMult: 0.55, approachMult: 0.72, specialMult: 0.7, rush: true },
  bakugo: { aggressionMult: 1.25, blockMult: 0.65, approachMult: 0.88, specialMult: 0.85, rush: true },
  deku: { aggressionMult: 1.05, blockMult: 0.9, approachMult: 0.95, specialMult: 0.75, rush: false },
  allmight: { aggressionMult: 0.85, blockMult: 1.2, approachMult: 0.82, specialMult: 0.55, rush: false },
  todoroki: { aggressionMult: 0.95, blockMult: 1.0, approachMult: 1.05, specialMult: 0.9, rush: false },
  uraraka: { aggressionMult: 0.9, blockMult: 1.05, approachMult: 0.9, specialMult: 1.1, rush: false },
  shigaraki: { aggressionMult: 1.1, blockMult: 0.75, approachMult: 0.92, specialMult: 0.8, rush: false },
  allforone: { aggressionMult: 0.6, blockMult: 1.15, approachMult: 1.45, specialMult: 1.0, rush: false, zoner: true },
  dabi: { aggressionMult: 0.62, blockMult: 1.05, approachMult: 1.4, specialMult: 1.05, rush: false, zoner: true },
  twice: { aggressionMult: 0.75, blockMult: 0.95, approachMult: 1.0, specialMult: 1.35, rush: false, cloneSpam: true },
};

export class CpuController {
  constructor(difficulty = 'normal', characterId = null) {
    this.cfg = DIFFICULTY[difficulty] ?? DIFFICULTY.normal;
    this.profile = CPU_PROFILES[characterId] ?? {};
    this.nextDecision = 0;
    this.held = { ...NEUTRAL };
    this.pulse = { ...NEUTRAL };
  }

  reset() {
    this.nextDecision = 0;
    this.held = { ...NEUTRAL };
    this.pulse = { ...NEUTRAL };
  }

  getConfig(self) {
    const p = this.profile;
    const cfg = this.cfg;
    const rush = p.rush || (self.config.preferredRange != null && self.config.preferredRange < 80);
    return {
      decisionMs: cfg.decisionMs,
      aggression: Math.min(0.96, cfg.aggression * (p.aggressionMult ?? 1)),
      blockChance: Math.min(0.88, cfg.blockChance * (p.blockMult ?? 1)),
      jumpChance: cfg.jumpChance,
      specialBias: Math.min(0.95, cfg.specialBias * (p.specialMult ?? 1)),
      approachRange: (self.config.preferredRange ?? cfg.approachRange) * (p.approachMult ?? 1),
      reaction: cfg.reaction ?? 0.5,
      zoner: p.zoner ?? false,
      cloneSpam: p.cloneSpam ?? false,
      rush,
    };
  }

  /** Blend held movement with one-frame attack inputs. */
  emit() {
    return { ...this.held, ...this.pulse };
  }

  tryPunish(opp, dist, cfg, toward) {
    if (!opp.isHit || dist > cfg.approachRange + 28) return false;

    this.held = { ...NEUTRAL };
    if (dist > 40) this.held[toward] = true;

    const pressure = cfg.aggression * 0.55 + 0.25;
    if (Math.random() < pressure) {
      if (Math.random() < 0.32) this.pulse.heavy = true;
      else this.pulse.light = true;
      if (Math.random() < cfg.aggression * 0.22) this.pulse.dash = true;
    }
    return true;
  }

  update(time, self, opp) {
    this.pulse = { ...NEUTRAL };

    if (!opp || self.isDead || opp.isDead) {
      return { ...this.held, ...this.pulse, left: false, right: false };
    }

    const dx = opp.body.x - self.body.x;
    const dist = Math.abs(dx);
    const toward = dx > 0 ? 'right' : 'left';
    const away = dx > 0 ? 'left' : 'right';
    const cfg = this.getConfig(self);

    if (this.tryPunish(opp, dist, cfg, toward)) {
      return this.emit();
    }

    if (opp.isAttacking && dist < 115 && Math.random() < cfg.blockChance * cfg.reaction) {
      this.held = { ...NEUTRAL, block: true };
    }

    if (time < this.nextDecision) {
      return this.emit();
    }
    this.nextDecision = time + cfg.decisionMs * (0.62 + Math.random() * 0.52);

    this.held = { ...NEUTRAL };

    if (cfg.zoner && dist < cfg.approachRange - 20 && Math.random() < 0.65) {
      this.held[away] = true;
      if (self.isSpecialReady?.() && self.power >= self.config.specialCost && Math.random() < cfg.specialBias * 0.6) {
        this.pulse.special = true;
      } else if (Math.random() < 0.35) {
        this.pulse.heavy = true;
      }
      return this.emit();
    }

    if (dist <= cfg.approachRange + 12) {
      if (opp.isAttacking && Math.random() < cfg.blockChance) {
        this.held.block = true;
        return this.emit();
      }

      if (self.isSpecialReady?.() && self.power >= self.config.specialCost) {
        let specialChance = cfg.specialBias * (cfg.rush ? 0.58 : 0.52);
        if (cfg.cloneSpam && self.config.id === 'twice') {
          const clones = self.scene.getTwiceClones?.(self) ?? [];
          const max = self.config.cloneMax ?? 5;
          if (clones.length < max) specialChance = Math.min(0.95, 0.48 + (max - clones.length) * 0.12);
        }
        if (Math.random() < specialChance) this.pulse.special = true;
      } else if (dist < cfg.approachRange - 28 && !cfg.rush && !cfg.zoner && Math.random() < 0.42) {
        this.held[away] = true;
      } else if (!self.onGround && Math.random() < 0.38) {
        this.pulse.aerial = true;
      } else if (Math.random() < cfg.aggression * 0.32) {
        this.pulse.launcher = true;
      } else if (Math.random() < cfg.aggression * (cfg.rush ? 0.32 : 0.20)) {
        this.pulse.dash = true;
      } else if (Math.random() < cfg.aggression) {
        if (Math.random() < 0.40) this.pulse.heavy = true;
        else this.pulse.light = true;
      } else if (Math.random() < 0.15) {
        this.held[away] = true;
      }
      return this.emit();
    }

    if (cfg.rush || Math.random() < cfg.aggression) {
      this.held[toward] = true;
      if (dist > 220 && Math.random() < cfg.jumpChance * (cfg.rush ? 1.55 : 1.1)) this.pulse.jump = true;
      if (dist > 120 && Math.random() < (cfg.rush ? 0.32 : 0.16)) this.pulse.dash = true;
    } else if (Math.random() < 0.22) {
      this.held[away] = true;
    } else {
      this.held[toward] = true;
    }

    return this.emit();
  }
}
