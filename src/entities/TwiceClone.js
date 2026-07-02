import Phaser from 'phaser';
import { GROUND_Y, GRAVITY, GAME_WIDTH } from '../data/characters.js';
import { createCharacterSpriteInContainer } from '../utils/spriteFrames.js';
import { SFX } from '../utils/audio.js';

const ATTACK_RANGE = 54;
const ATTACK_COOLDOWN = 880;
const MOVE_SPEED = 200;
const SPREAD = [-88, -44, 0, 44, 88];

export class TwiceClone {
  constructor(scene, owner, opponent, slotIndex) {
    this.scene = scene;
    this.owner = owner;
    this.opponent = opponent;
    this.slotIndex = slotIndex;
    this.config = owner.config;

    this.maxHp = this.config.cloneHp ?? 18;
    this.hp = this.maxHp;
    this.dead = false;
    this.facing = owner.facing;
    this.lastAttackTime = -999;
    this.isAttacking = false;
    this.currentAttack = null;

    const offsetX = SPREAD[slotIndex] ?? (slotIndex - 2) * 44;
    const x = Phaser.Math.Clamp(owner.body.x + offsetX, 72, GAME_WIDTH - 72);

    this.body = scene.add.container(x, GROUND_Y);
    this.shadow = scene.add.ellipse(0, 2, 34, 8, 0x000000, 0.35);
    this.sprite = createCharacterSpriteInContainer(scene, this.body, 0, 0, owner.config, 'idle', 0);
    const bodyW = owner.sprite?.displayWidth ?? owner.baseDisplayW ?? 120;
    const bodyH = owner.sprite?.displayHeight ?? owner.baseDisplayH ?? 168;
    if (this.sprite) {
      this.sprite.setOrigin(0.5, 1);
      this.sprite.setScale(1);
      this.sprite.setDisplaySize(bodyW, bodyH);
      this.sprite.setAlpha(0.92);
      this.sprite.setTint(0xd8d8d8);
      this.barY = -bodyH - 10;
    } else {
      this.sprite = scene.add.rectangle(0, -48, 28, 56, this.config.color);
      this.body.add(this.sprite);
      this.barY = -112;
    }
    this.body.add([this.shadow, this.sprite]);
    this.body.setDepth((owner.body.depth ?? 10) - 1);

    this.hpBg = scene.add.rectangle(0, this.barY, 36, 5, 0x000000, 0.8);
    this.hpFill = scene.add.rectangle(-17, this.barY, 34, 3, this.config.auraColor, 1).setOrigin(0, 0.5);
    this.body.add([this.hpBg, this.hpFill]);

    scene.physics.add.existing(this.body);
    const pb = this.body.body;
    const hitW = Math.max(40, Math.round(bodyW * 0.55));
    const hitH = Math.max(80, Math.round(bodyH * 0.92));
    pb.setSize(hitW, hitH);
    pb.setOffset(-Math.round(hitW / 2), -Math.round(bodyH));
    pb.setCollideWorldBounds(true);
    pb.setGravityY(GRAVITY);
    pb.setMaxVelocity(380, 900);

    this.hitbox = scene.add.rectangle(x, GROUND_Y - 40, ATTACK_RANGE, 48, 0xffffff, 0);
    scene.physics.add.existing(this.hitbox);
    this.hitbox.body.setAllowGravity(false);
    this.hitbox.body.setImmovable(true);
    this.hitbox.visible = false;

    this.body.setAlpha(0);
    scene.tweens.add({ targets: this.body, alpha: 1, duration: 260, ease: 'Back.easeOut' });

    const puff = scene.add.circle(x, GROUND_Y - 58, 16, this.config.auraColor, 0.45).setDepth(89);
    scene.tweens.add({
      targets: puff,
      scale: 2.2,
      alpha: 0,
      duration: 300,
      onComplete: () => puff.destroy(),
    });
  }

  updateHpBar() {
    const ratio = this.hp / this.maxHp;
    this.hpFill.width = 34 * ratio;
    this.hpFill.setFillStyle(ratio > 0.35 ? this.config.auraColor : 0xff4444);
  }

  update(time, canAct) {
    if (this.dead) return;
    if (!canAct || this.owner.isDead) {
      this.destroy();
      return;
    }

    const pb = this.body.body;
    if (this.body.y > GROUND_Y) this.body.y = GROUND_Y;

    if (!this.isAttacking && this.opponent && !this.opponent.isDead) {
      const dx = this.opponent.body.x - this.body.x;
      this.facing = dx >= 0 ? 1 : -1;
      if (this.sprite?.setFlipX) this.sprite.setFlipX(this.facing === -1);

      const dist = Math.abs(dx);
      if (dist > 56) {
        pb.setVelocityX(this.facing * MOVE_SPEED);
      } else if (time - this.lastAttackTime > ATTACK_COOLDOWN) {
        pb.setVelocityX(0);
        this.performAttack(time);
      } else {
        pb.setVelocityX(0);
      }
    } else if (!this.isAttacking) {
      pb.setVelocityX(0);
    }

    this.syncHitbox();
    this.updateHpBar();
  }

  performAttack(time) {
    this.isAttacking = true;
    this.lastAttackTime = time;
    const min = this.config.cloneDamageMin ?? 3;
    const max = this.config.cloneDamageMax ?? 7;
    const damage = Phaser.Math.Between(min, max);
    this.currentAttack = { damage, range: ATTACK_RANGE, hit: false };

    if (this.sprite?.setTint) {
      this.sprite.setTint(0xffffff);
      this.scene.time.delayedCall(90, () => {
        if (!this.dead && this.sprite?.setTint) this.sprite.setTint(0xd8d8d8);
      });
    }
    SFX.whiff();

    this.scene.time.delayedCall(240, () => {
      this.isAttacking = false;
      this.currentAttack = null;
    });
  }

  syncHitbox() {
    if (!this.isAttacking || !this.currentAttack) {
      this.hitbox.body.setSize(0, 0);
      return;
    }
    const range = this.currentAttack.range;
    this.hitbox.x = this.body.x + this.facing * (range / 2);
    this.hitbox.y = this.body.y - 40;
    this.hitbox.body.setSize(range, 48);
  }

  getAttackDamage() {
    if (!this.currentAttack || this.currentAttack.hit) return 0;
    return this.currentAttack.damage;
  }

  markAttackHit() {
    if (this.currentAttack) this.currentAttack.hit = true;
  }

  takeDamage(amount, attacker) {
    if (this.dead) return 0;
    const finalDamage = Math.max(0, Math.round(amount));
    if (finalDamage <= 0) return 0;

    this.hp = Math.max(0, this.hp - finalDamage);
    this.updateHpBar();
    if (this.sprite?.setTint) {
      this.sprite.setTint(0xff6666);
      this.scene.time.delayedCall(100, () => {
        if (!this.dead && this.sprite?.setTint) this.sprite.setTint(0xd8d8d8);
      });
    }

    SFX.hitLight();
    this.scene.events.emit('fighter-hit', {
      attacker: attacker ?? this.owner,
      defender: { body: this.body, isBlocking: false },
      damage: finalDamage,
    });

    if (this.hp <= 0) this.fadeOut();
    return finalDamage;
  }

  fadeOut() {
    if (this.dead) return;
    this.dead = true;
    this.scene.tweens.add({
      targets: this.body,
      alpha: 0,
      duration: 260,
      onComplete: () => this.destroy(),
    });
  }

  destroy() {
    this.dead = true;
    if (this.hitbox?.active) this.hitbox.destroy();
    if (this.body?.active) this.body.destroy();
  }
}
