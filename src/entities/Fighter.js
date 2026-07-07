import { GROUND_Y, GRAVITY } from '../data/characters.js';
import { getActiveForm, getAwakenBuff, getAwakenCinematicPayload, getImageDef } from '../data/characterImages.js';
import {
  createCharacterSpriteInContainer,
  getCharacterAnimFrameCount,
  getCharacterAnimMs,
  hasImageSprites,
  updateCharacterSprite,
} from '../utils/spriteFrames.js';
import { SFX } from '../utils/audio.js';

const ATTACK_RANGE = 72;
const FX_DEPTH = 90;
const ATTACK_COOLDOWN = 280;
const COMBO_WINDOW_MS = 650;
const HITSTUN_MS = 320;
const BLOODCURDLE_STUN_MS = 500;
const TODOROKI_FREEZE_MS = 1100;
const TODOROKI_BURN_TICK_MS = 400;
const TODOROKI_BURN_TICKS = 4;
const TODOROKI_BURN_DAMAGE = 3;
const KNOCKBACK = 180;
const MOVE_DEADZONE = 24;

export class Fighter {
  constructor(scene, x, config, playerIndex) {
    this.scene = scene;
    this.config = config;
    this.playerIndex = playerIndex;
    this.facing = playerIndex === 1 ? 1 : -1;
    this.opponent = null;

    this.maxHp = config.hp;
    this.hp = config.hp;
    this.power = config.powerStart ?? 50;
    this.maxPower = 100;

    this.isAttacking = false;
    this.isBlocking = false;
    this.isHit = false;
    this.isDead = false;
    this.onGround = false;
    this.lastAttackTime = 0;
    this.comboCount = 0;
    this.comboDisplay = 0;
    this.comboChain = 0;
    this.lastComboHit = 0;
    this.lastDashTime = -999;
    this.isDashing = false;

    this.currentAnim = 'idle';
    this.animFrame = 0;
    this.lastAnimTick = 0;
    this.attackAnimTimers = [];
    this.wasOnGround = true;
    this.spawnX = x;
    this.lastAfterimage = 0;
    this.usesImageArt = hasImageSprites(config.id);
    this.baseSpriteY = 0;
    this.activeForm = getActiveForm(config.id, 1) ?? 'base';
    this.awakenTriggered = false;
    this.superAwakenActive = false;
    this.superAwakenTimer = null;
    this.zeroGravity = null;
    this.slowUntil = 0;
    this.freezeUntil = 0;
    this.burnUntil = 0;
    this.burnTimers = [];
    this.todorokiElement = 'fire';

    this.body = scene.add.container(x, GROUND_Y);

    this.shadow = scene.add.ellipse(0, 2, 50, 12, 0x000000, 0.42);
    this.aura = scene.add.ellipse(0, -55, 70, 90, config.auraColor, this.usesImageArt ? 0 : 0.12);
    this.sprite = createCharacterSpriteInContainer(scene, this.body, 0, 0, config, 'idle', 0, this.activeForm);
    if (!this.sprite) {
      console.error('Missing sprite frames for', config.id);
      this.sprite = scene.add.rectangle(0, -60, 40, 80, config.color);
      this.body.add(this.sprite);
    }
    this.sprite.setOrigin(0.5, 1);
    this.syncDisplayBaseline();
    this.body.bringToTop(this.sprite);
    this.glowRing = scene.add.ellipse(0, -58, 64, 108, config.auraColor, 0);
    this.glowRing.setStrokeStyle(1, config.auraColor, 0);
    if (this.usesImageArt) this.glowRing.setVisible(false);

    this.body.add([this.shadow, this.aura, this.glowRing]);

    scene.physics.add.existing(this.body);
    const physicsBody = this.body.body;
    physicsBody.setSize(60, 120);
    physicsBody.setOffset(-30, -120);
    physicsBody.setCollideWorldBounds(true);
    physicsBody.setBounce(0);
    physicsBody.setGravityY(GRAVITY);
    physicsBody.setMaxVelocity(600, 900);

    this.hitbox = scene.add.rectangle(x, GROUND_Y - 50, ATTACK_RANGE, 60, 0xffffff, 0);
    scene.physics.add.existing(this.hitbox);
    this.hitbox.body.setAllowGravity(false);
    this.hitbox.body.setImmovable(true);
    this.hitbox.visible = false;
  }

  setOpponent(opponent) {
    this.opponent = opponent;
  }

  clearAttackAnimTimers() {
    for (const timer of this.attackAnimTimers) timer.remove();
    this.attackAnimTimers = [];
  }

  /** Punch-scale on light attacks without breaking displaySize-based image sprites. */
  playAttackPunch(scaleXMult, scaleYMult, duration) {
    if (this.usesImageArt) {
      const w = this.sprite.displayWidth;
      const h = this.sprite.displayHeight;
      this.scene.tweens.add({
        targets: this.sprite,
        displayWidth: w * scaleXMult,
        displayHeight: h * scaleYMult,
        duration,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
      return;
    }

    this.sprite.setScale(this.facing, 1);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.facing * scaleXMult,
      scaleY: scaleYMult,
      duration,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
  }

  finishAttackMotion() {
    this.scene.tweens.killTweensOf(this.sprite);
    this.isAttacking = false;
    this.inAttackStartup = false;
    this.isDashing = false;
    this.currentAttack = null;
    this.clearAttackAnimTimers();
    this.currentAnim = 'idle';
    this.animFrame = 0;
    this.lastAnimTick = this.scene.time.now;

    if (this.usesImageArt) {
      this.sprite.x = 0;
      this.setAnim('idle', 0);
      this.sprite.y = this.baseSpriteY;
      return;
    }

    if (this.config.id === 'dabi' || this.config.id === 'deku' || this.config.id === 'allmight') {
      this.scene.tweens.add({
        targets: this.sprite,
        x: 0,
        scaleX: this.facing,
        scaleY: 1,
        duration: 85,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.setAnim('idle', 0);
          this.sprite.x = 0;
          this.sprite.y = this.baseSpriteY;
        },
      });
      return;
    }

    this.setAnim('idle', 0);
    this.sprite.x = 0;
    this.sprite.y = this.baseSpriteY;
  }

  /** Lock expected on-screen size from character data (prevents clamping to zero). */
  syncDisplayBaseline() {
    const def = getImageDef(this.config.id);
    if (def) {
      this.baseDisplayH = def.displayH ?? 168;
      this.baseDisplayW = def.displayW ?? Math.round(this.baseDisplayH * 0.72);
    } else {
      this.baseDisplayW = this.sprite.displayWidth || 80;
      this.baseDisplayH = this.sprite.displayHeight || 168;
    }
  }

  setAnim(animName, frameIndex = 0) {
    this.currentAnim = animName;
    this.animFrame = frameIndex;
    this.scene.tweens.killTweensOf(this.sprite);
    updateCharacterSprite(this.sprite, this.config, animName, frameIndex, this.activeForm ?? 'base');
    this.sprite.setOrigin(0.5, 1);
    this.clampSpriteSize();
    this.body.bringToTop(this.sprite);
  }

  /** Keep pose swaps from jumping in size when PNG canvases differ. */
  clampSpriteSize() {
    if (!this.usesImageArt || !this.sprite?.frame) return;

    const maxW = this.baseDisplayW * 1.08;
    const maxH = this.baseDisplayH * 1.08;
    let w = this.sprite.displayWidth;
    let h = this.sprite.displayHeight;

    if (w < 1 || h < 1) {
      this.sprite.setDisplaySize(this.baseDisplayW, this.baseDisplayH);
      return;
    }

    if (w > maxW || h > maxH) {
      const ratio = Math.min(maxW / w, maxH / h);
      this.sprite.setDisplaySize(w * ratio, h * ratio);
    }
  }

  getAwakenBuffs() {
    if (this.activeForm !== 'awakened') return null;
    return getAwakenBuff(this.config.id, 'awakened');
  }

  getStatMult(key) {
    return this.getAwakenBuffs()?.[key] ?? 1;
  }

  updateAwakenForm() {
    const newForm = getActiveForm(this.config.id, this.hp / this.maxHp);
    if (newForm == null) return;

    const prevForm = this.activeForm ?? 'base';
    this.activeForm = newForm;

    if (newForm === 'awakened' && prevForm !== 'awakened') {
      this.awakenTriggered = true;
      const payload = getAwakenCinematicPayload(this.config.id);
      this.scene.events.emit('fighter-awaken', this, payload);
      this.setAnim(this.currentAnim, this.animFrame);
      this.syncDisplayBaseline();
    }
  }

  activateSuperAwaken() {
    const def = getImageDef(this.config.id);
    if (!def?.forms || !def.awakenOnSuper) return;

    this.superAwakenActive = true;
    this.activeForm = 'awakened';
    const healRatio = def.awakenHealRatio ?? 0.25;
    this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * healRatio));

    const payload = getAwakenCinematicPayload(this.config.id);
    this.scene.events.emit('fighter-awaken', this, payload);
    this.setAnim('idle', 0);
    this.syncDisplayBaseline();

    this.superAwakenTimer?.remove();
    const duration = def.awakenDurationMs ?? 5000;
    this.superAwakenTimer = this.scene.time.delayedCall(duration, () => this.revertSuperAwaken());
  }

  revertSuperAwaken() {
    if (!getImageDef(this.config.id)?.awakenOnSuper) return;
    this.superAwakenActive = false;
    this.superAwakenTimer = null;
    this.activeForm = 'base';
    this.setAnim(this.isHit ? 'hit' : 'idle', 0);
    this.syncDisplayBaseline();
  }

  performOverhaulSuper(time) {
    if (this.superAwakenActive) return;

    this.isAttacking = true;
    this.inAttackStartup = true;
    this.lastAttackTime = time;
    this.clearAttackAnimTimers();
    this.scene.tweens.killTweensOf(this.sprite);
    this.power -= this.config.specialCost;
    this.currentAttack = { type: 'special', damage: 0, range: 0, hit: true, launch: false, knockBoost: 1 };

    SFX.special();
    this.scene.events.emit('fighter-special', this);
    this.setAnim('special', 0);

    this.scene.time.delayedCall(120, () => this.activateSuperAwaken());

    this.attackAnimTimers.push(this.scene.time.delayedCall(520, () => {
      this.finishAttackMotion();
    }));
  }

  update(time, controls, canAct = true) {
    if (this.isDead) return;

    this.updateAwakenForm();

    const body = this.body.body;
    if (this.comboChain > 0 && time - this.lastComboHit > COMBO_WINDOW_MS) {
      this.comboChain = 0;
    }

    this.onGround = body.blocked.down || body.touching.down;

    if (this.onGround && !this.wasOnGround && body.velocity.y >= -10) {
      SFX.land();
      this.scene.events.emit('fighter-land', this);
    }
    this.wasOnGround = this.onGround;

    if (this.updateZeroGravity(time)) {
      this.syncHitbox();
      this.updateVisuals();
      return;
    }

    this.maybeAfterimage(time, body);
    this.faceOpponent();

    if (!canAct) {
      body.setVelocityX(0);
      this.syncHitbox();
      this.updateAnimation(time);
      this.updateVisuals();
      return;
    }

    if (this.isHit) {
      this.syncHitbox();
      this.updateAnimation(time);
      this.updateVisuals();
      return;
    }

    this.isBlocking = controls.block && this.onGround && !this.isAttacking && !this.isDashing;

    this.applyMovement(body, controls);

    if (controls.jump && this.onGround && !this.isAttacking && !this.isBlocking) {
      body.setVelocityY(-this.config.jumpForce * this.getStatMult('jumpMult'));
      SFX.jump();
    }

    this.processAttacks(controls, time);

    this.regenPower();
    this.updateAnimation(time);
    this.syncHitbox();
    this.updateVisuals();
  }

  resolveLoopAnim(time) {
    if (this.isAttacking || this.isHit || this.isDead) return null;

    const body = this.body.body;
    const moving = this.onGround && Math.abs(body.velocity.x) > 20 && !this.isBlocking;
    if (moving) return 'walk';
    if (!this.onGround) return 'idle';
    return 'idle';
  }

  updateAnimation(time) {
    if (this.isAttacking) return;

    const anim = this.resolveLoopAnim(time) ?? 'idle';
    const frameMs = getCharacterAnimMs(this.config, anim);
    const frameCount = getCharacterAnimFrameCount(this.config, anim);

    if (anim !== this.currentAnim) {
      this.currentAnim = anim;
      this.animFrame = 0;
      this.lastAnimTick = time;
      this.setAnim(anim, 0);
      return;
    }

    if (frameCount <= 1) return;

    if (time - this.lastAnimTick > frameMs) {
      this.lastAnimTick = time;
      this.animFrame = (this.animFrame + 1) % frameCount;
      this.setAnim(anim, this.animFrame);
    }
  }

  maybeAfterimage(time, body) {
    if (Math.abs(body.velocity.x) < 220 || !this.onGround) return;
    if (time - this.lastAfterimage < 70) return;
    if (!this.sprite.texture || !this.sprite.frame) return;
    this.lastAfterimage = time;

    const ghost = this.scene.add.image(this.body.x, this.body.y, this.sprite.texture.key, this.sprite.frame.name);
    ghost.setOrigin(0.5, 1);
    ghost.setDisplaySize(this.sprite.displayWidth, this.sprite.displayHeight);
    ghost.setFlipX(this.facing === -1);
    ghost.setTint(this.config.auraColor);
    ghost.setAlpha(0.4);
    ghost.setDepth(this.body.depth - 1);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 220,
      onComplete: () => ghost.destroy(),
    });
  }

  applyMovement(body, controls) {
    if (this.isAttacking || this.isBlocking) {
      if (this.isBlocking) body.setVelocityX(0);
      return;
    }
    if (this.isDashing) return;

    if (this.freezeUntil && this.scene.time.now < this.freezeUntil) {
      body.setVelocityX(0);
      return;
    }

    const moveSpeed = this.config.speed * this.getStatMult('speedMult');
    const slowMult = this.slowUntil && this.scene.time.now < this.slowUntil ? 0.52 : 1;

    if (controls.moveTargetX != null) {
      const dx = controls.moveTargetX - this.body.x;
      if (Math.abs(dx) > MOVE_DEADZONE) {
        body.setVelocityX(Math.sign(dx) * moveSpeed * slowMult);
        this.facing = dx > 0 ? 1 : -1;
      } else {
        body.setVelocityX(0);
      }
      return;
    }

    body.setVelocityX((controls.left ? -moveSpeed : controls.right ? moveSpeed : 0) * slowMult);
    if (body.velocity.x !== 0) {
      this.facing = body.velocity.x > 0 ? 1 : -1;
    }
  }

  processAttacks(controls, time) {
    if (this.isBlocking || this.isAttacking) return;

    if (!this.onGround && (controls.aerial || controls.light) && this.canAttack(time, 'aerial')) {
      this.performAttack('aerial', time);
      return;
    }

    if (controls.dash && this.canAttack(time, 'dash')) {
      this.performAttack('dash', time);
      return;
    }

    if (controls.special && this.canAttack(time, 'special') && this.power >= this.config.specialCost) {
      this.performAttack('special', time);
      return;
    }

    if (controls.launcher && this.canAttack(time, 'launcher')) {
      this.performAttack('launcher', time);
      return;
    }

    if (controls.heavy && this.canAttack(time, 'heavy')) {
      this.performAttack('heavy', time);
      return;
    }

    if (controls.light && this.canAttack(time, 'light')) {
      this.performAttack('light', time);
    }
  }

  faceOpponent() {
    if (!this.opponent || this.isAttacking || this.isHit || this.isDashing) return;
    if (Math.abs(this.body.body.velocity.x) > 20) return;
    this.facing = this.opponent.body.x >= this.body.x ? 1 : -1;
  }

  resetForRound() {
    this.hp = this.maxHp;
    this.power = this.config.powerStart ?? 50;
    this.isAttacking = false;
    this.isBlocking = false;
    this.isHit = false;
    this.isDead = false;
    this.comboCount = 0;
    this.comboDisplay = 0;
    this.comboChain = 0;
    this.lastComboHit = 0;
    this.lastDashTime = -999;
    this.isDashing = false;
    this.currentAttack = null;
    this.clearAttackAnimTimers();
    this.clearZeroGravity();
    this.clearBurnTimers();
    this.slowUntil = 0;
    this.freezeUntil = 0;
    this.burnUntil = 0;
    this.todorokiElement = 'fire';

    this.body.setAlpha(1);
    this.body.setAngle(0);
    this.body.x = this.spawnX;
    this.body.y = GROUND_Y;

    const body = this.body.body;
    body.setVelocity(0, 0);
    body.setAllowGravity(true);

    this.sprite.clearTint();
    this.sprite.x = 0;
    this.sprite.y = 0;
    this.baseSpriteY = 0;
    this.glowRing.setStrokeStyle(1, this.config.auraColor, 0);
    this.activeForm = getActiveForm(this.config.id, 1) ?? 'base';
    this.awakenTriggered = false;
    this.superAwakenActive = false;
    this.superAwakenTimer?.remove();
    this.superAwakenTimer = null;
    this.currentAnim = 'idle';
    this.animFrame = 0;
    this.syncDisplayBaseline();
    this.setAnim('idle', 0);
    this.body.bringToTop(this.sprite);
  }

  canAttack(time, type = 'light') {
    if (this.isAttacking) return false;

    if (type === 'dash') {
      return this.onGround && !this.isDashing && time - this.lastDashTime > 720;
    }

    if (type === 'aerial') {
      return !this.onGround && time - this.lastAttackTime > 180;
    }

    if (!this.onGround) return false;

    let cd = ATTACK_COOLDOWN;
    if (type === 'light' && this.comboChain > 0 && time - this.lastComboHit < COMBO_WINDOW_MS) {
      cd = 150;
    }
    if (type === 'launcher') cd = 340;
    if (type === 'heavy') cd = 320;
    if (type === 'special' && this.config.id === 'twice') {
      const clones = this.scene.getTwiceClones?.(this) ?? [];
      if (clones.length >= (this.config.cloneMax ?? 5)) return false;
    }
    if (type === 'special' && this.config.awakenOnSuper && this.superAwakenActive) return false;

    const cdMult = this.config.attackCooldownMult ?? 1;
    return time - this.lastAttackTime > Math.round(cd * cdMult);
  }

  applyAttackRange(type, range) {
    const bonus = this.config.rangeBonus;
    if (!bonus) return range;
    const key = ['light', 'heavy', 'special', 'aerial', 'launcher', 'dash'].includes(type) ? type : 'light';
    return range + (bonus[key] ?? 0);
  }

  isPlantedAttacker() {
    return this.config.id === 'allforone' || this.config.id === 'dabi';
  }

  getAttackLunge(type) {
    if (this.isPlantedAttacker()) {
      return type === 'special' ? 3 : type === 'heavy' ? 6 : 5;
    }
    if (this.config.id === 'stain') {
      return type === 'special' ? 22 : type === 'heavy' ? 16 : 12;
    }
    if (type === 'special') return this.usesImageArt ? 18 : 14;
    if (type === 'heavy') return this.usesImageArt ? 14 : 12;
    return this.usesImageArt ? 10 : 10;
  }

  performAttack(type, time) {
    this.isAttacking = true;
    this.inAttackStartup = true;
    this.lastAttackTime = time;
    this.clearAttackAnimTimers();
    this.scene.tweens.killTweensOf(this.sprite);

    let damage = this.config.lightDamage;
    let duration = this.config.id === 'dabi' ? 190 : 220;
    let range = ATTACK_RANGE;
    let animName = 'attack';
    let launch = false;
    let knockBoost = 1;
    let element = null;

    if (type === 'heavy') {
      damage = this.config.heavyDamage;
      duration = this.config.id === 'dabi' ? 300 : 340;
      range = ATTACK_RANGE + 14;
      animName = 'heavy';
      if (this.comboChain >= 2) {
        damage += 4 + this.comboChain;
        knockBoost = 1.35;
        this.comboDisplay = this.comboChain + 1;
        this.comboChain = 0;
      }
    } else if (type === 'launcher') {
      damage = Math.round(this.config.lightDamage * 1.15);
      duration = 300;
      range = ATTACK_RANGE + 4;
      animName = 'attack';
      launch = true;
      knockBoost = 0.85;
    } else if (type === 'aerial') {
      damage = Math.round(this.config.lightDamage * 0.95);
      duration = 200;
      range = ATTACK_RANGE + 6;
      animName = 'attack';
    } else if (type === 'dash') {
      damage = 9;
      duration = 240;
      range = 105;
      animName = 'attack';
      this.isDashing = true;
      this.lastDashTime = time;
      const burst = this.config.speed * this.getStatMult('speedMult') * 2.4;
      this.body.body.setVelocityX(this.facing * burst);
      SFX.whiff();
    } else if (type === 'special') {
      if (this.config.awakenOnSuper) {
        this.performOverhaulSuper(time);
        return;
      }
      damage = this.config.id === 'twice' ? 0 : this.config.specialDamage;
      duration = (this.config.id === 'allforone' || this.config.id === 'dabi') ? 520 : this.config.id === 'twice' ? 420 : 480;
      range = this.config.id === 'twice' ? ATTACK_RANGE : ATTACK_RANGE + 30;
      animName = 'special';
      if (this.config.id === 'todoroki') {
        const isFire = this.todorokiElement === 'fire';
        element = isFire ? 'fire' : 'ice';
        this.todorokiElement = isFire ? 'ice' : 'fire';
      }
      this.power -= this.config.specialCost;
      this.playSpecialEffect(element);
    }

    range = this.applyAttackRange(type, range);

    if (type === 'special') {
      SFX.special();
      this.scene.events.emit('fighter-special', this);
    } else if (type !== 'dash') {
      SFX.whiff();
    }

    if (type === 'light') {
      if (this.comboChain > 0 && time - this.lastComboHit < COMBO_WINDOW_MS) {
        damage += Math.min(3, this.comboChain);
      }
      if (this.config.id === 'deku') {
        this.comboCount += 1;
        if (this.comboCount >= 3) {
          damage += 3;
          this.comboCount = 0;
          this.comboDisplay = 3;
        }
      }
    }

    if (this.config.id === 'todoroki' && (type === 'light' || type === 'heavy')) {
      const isFire = this.todorokiElement === 'fire';
      if (isFire) damage += 2;
      element = isFire ? 'fire' : 'ice';
      this.todorokiElement = isFire ? 'ice' : 'fire';
    }

    damage = Math.round(damage * this.getStatMult('damageMult'));

    this.currentAttack = { type, damage, range, hit: false, launch, knockBoost, element };

    if (type !== 'dash') {
      this.body.body.setVelocityX(0);
    }

    const durationMult = this.config.attackDurationMult ?? 1;
    duration = Math.round(duration * durationMult);

    const frameCount = Math.max(1, getCharacterAnimFrameCount(this.config, animName));
    const frameMs = Math.max(50, Math.floor(duration / frameCount));
    this.setAnim(animName, 0);

    if (this.config.id === 'allforone' && (type === 'light' || type === 'heavy')) {
      this.scene.time.delayedCall(70, () => {
        if (this.isAttacking) this.spawnAfoBeam(type === 'heavy');
      });
    }

    if (this.config.id === 'dabi' && (type === 'light' || type === 'heavy')) {
      this.scene.time.delayedCall(type === 'light' ? 42 : 55, () => {
        if (this.isAttacking) this.spawnDabiFire(type === 'heavy', false);
      });
    }

    if (this.config.id === 'stain' && (type === 'light' || type === 'heavy')) {
      this.scene.time.delayedCall(50, () => {
        if (this.isAttacking) this.spawnStainSlash(type === 'heavy', false);
      });
    }

    if (this.config.id === 'bakugo' && (type === 'light' || type === 'heavy')) {
      this.scene.time.delayedCall(55, () => {
        if (this.isAttacking) this.spawnBakugoBlast(type === 'heavy', false);
      });
    }

    if (this.config.id === 'todoroki' && (type === 'light' || type === 'heavy')) {
      const elem = element;
      this.scene.time.delayedCall(50, () => {
        if (this.isAttacking) this.spawnTodorokiElement(elem, type === 'heavy');
      });
    }

    for (let i = 1; i < frameCount; i += 1) {
      const timer = this.scene.time.delayedCall(frameMs * i, () => {
        if (this.isAttacking) this.setAnim(animName, i);
      });
      this.attackAnimTimers.push(timer);
    }

    this.scene.time.delayedCall(Math.floor(duration * 0.38), () => {
      this.inAttackStartup = false;
    });

    const lunge = this.getAttackLunge(type);
    if (this.config.id === 'dabi' && type === 'light') {
      this.playAttackPunch(1.05, 0.96, Math.floor(duration * 0.24));
    } else if (this.config.id === 'deku' && type === 'light') {
      this.playAttackPunch(1.04, 0.94, Math.floor(duration * 0.22));
    } else if (this.config.id === 'allmight' && type === 'light') {
      this.playAttackPunch(1.03, 0.96, Math.floor(duration * 0.26));
    } else if (lunge > 0) {
      this.scene.tweens.add({
        targets: this.sprite,
        x: this.facing * lunge,
        duration: Math.floor(duration * 0.45),
        yoyo: true,
        ease: this.isPlantedAttacker() ? 'Sine.easeInOut' : 'Quad.easeOut',
      });
    }

    const endTimer = this.scene.time.delayedCall(duration, () => {
      this.finishAttackMotion();
    });
    this.attackAnimTimers.push(endTimer);
  }

  playSpecialEffect(strikeElement = null) {
    if (this.config.id === 'allforone') {
      this.spawnAfoBeam(true);
      return;
    }

    if (this.config.id === 'dabi') {
      this.spawnDabiFire(true, true);
      return;
    }

    if (this.config.id === 'stain') {
      this.spawnStainSlash(true, true);
      return;
    }

    if (this.config.id === 'bakugo') {
      this.spawnBakugoBlast(true, true);
      return;
    }

    if (this.config.id === 'twice') {
      this.spawnTwiceDuplicateVfx();
      this.scene.spawnTwiceClone?.(this);
      return;
    }

    if (this.config.id === 'uraraka') {
      this.spawnUrarakaZeroGravityVfx();
      return;
    }

    if (this.config.id === 'todoroki') {
      this.spawnTodorokiDualBlast(strikeElement === 'ice' ? 'ice' : 'fire');
      return;
    }

    const fx = this.scene.add.circle(this.body.x + this.facing * 60, this.body.y - 50, 8, this.config.auraColor, 0.9);
    this.scene.tweens.add({
      targets: fx,
      scaleX: 6,
      scaleY: 6,
      alpha: 0,
      duration: 400,
      onComplete: () => fx.destroy(),
    });

    if (this.config.id === 'gojo') {
      const ring = this.scene.add.circle(this.body.x, this.body.y - 50, 20, 0xcc88ff, 0.5);
      this.scene.tweens.add({
        targets: ring,
        scale: 4,
        alpha: 0,
        duration: 500,
        onComplete: () => ring.destroy(),
      });
    }

    if (this.config.id === 'allmight') {
      const burst = this.scene.add.text(this.body.x, this.body.y - 90, 'SMASH!', {
        fontSize: '22px',
        color: '#3498db',
        fontStyle: 'bold',
        stroke: '#ffffff',
        strokeThickness: 2,
      }).setOrigin(0.5);
      this.scene.tweens.add({
        targets: burst,
        y: burst.y - 30,
        alpha: 0,
        duration: 500,
        onComplete: () => burst.destroy(),
      });
    }

    if (this.config.id === 'sukuna') {
      for (let i = 0; i < 3; i += 1) {
        const slash = this.scene.add.rectangle(
          this.body.x + this.facing * (20 + i * 28),
          this.body.y - 50 - i * 8,
          40,
          4,
          0xff3366,
          0.8,
        ).setAngle(-35 * this.facing);
        this.scene.tweens.add({
          targets: slash,
          alpha: 0,
          scaleX: 1.8,
          duration: 280 + i * 60,
          onComplete: () => slash.destroy(),
        });
      }
    }
  }

  /** All For One — purple quirk beam VFX. */
  spawnAfoBeam(isHeavy) {
    const y = this.body.y - 56;
    const startX = this.body.x + this.facing * 42;
    const length = isHeavy ? 200 : 120;
    const height = isHeavy ? 22 : 12;
    const expandMs = isHeavy ? 160 : 100;

    const glow = this.scene.add.rectangle(startX, y, 6, height * 2, 0x7b2cbf, 0.4).setDepth(FX_DEPTH - 1);
    const core = this.scene.add.rectangle(startX, y, 6, height, 0xffffff, 0.95).setDepth(FX_DEPTH);
    const inner = this.scene.add.rectangle(startX, y, 6, height * 0.5, 0xe8d4ff, 0.9).setDepth(FX_DEPTH);

    const state = { w: 6 };
    const layout = () => {
      const cx = startX + this.facing * state.w * 0.5;
      glow.setSize(state.w, height * 2.2);
      glow.x = cx;
      core.setSize(state.w, height);
      core.x = cx;
      inner.setSize(state.w * 0.88, height * 0.45);
      inner.x = cx;
    };
    layout();

    this.scene.tweens.add({
      targets: state,
      w: length,
      duration: expandMs,
      ease: 'Quad.easeOut',
      onUpdate: layout,
      onComplete: () => {
        this.scene.tweens.add({
          targets: [glow, core, inner],
          alpha: 0,
          duration: isHeavy ? 280 : 200,
          onComplete: () => {
            glow.destroy();
            core.destroy();
            inner.destroy();
          },
        });
      },
    });

    if (isHeavy) {
      for (let i = 0; i < 3; i += 1) {
        const spark = this.scene.add.rectangle(
          startX + this.facing * (30 + i * 48),
          y - 8 + (i % 2) * 10,
          18,
          3,
          0xff2244,
          0.8,
        ).setDepth(FX_DEPTH).setAngle(-14 * this.facing);
        this.scene.tweens.add({
          targets: spark,
          alpha: 0,
          duration: 320,
          onComplete: () => spark.destroy(),
        });
      }
    }
  }

  /** Dabi — blue cremation flame VFX. */
  spawnDabiFire(isHeavy, isSpecial) {
    const y = this.body.y - 54;
    const startX = this.body.x + this.facing * 44;
    const length = isSpecial ? 220 : isHeavy ? 168 : 108;
    const radius = isSpecial ? 16 : isHeavy ? 12 : 8;
    const expandMs = isSpecial ? 180 : isHeavy ? 140 : 75;

    const glow = this.scene.add.circle(startX, y, radius, 0x0ea5e9, 0.35).setDepth(FX_DEPTH - 1);
    const core = this.scene.add.circle(startX, y, radius * 0.72, 0x7dd3fc, 0.92).setDepth(FX_DEPTH);
    const hot = this.scene.add.circle(startX, y, radius * 0.38, 0xffffff, 0.95).setDepth(FX_DEPTH);

    const state = { dist: 0, scale: 1 };
    const layout = () => {
      const cx = startX + this.facing * state.dist * 0.5;
      const r = radius * state.scale;
      glow.setPosition(cx, y);
      glow.setRadius(r * 1.35);
      core.setPosition(cx, y);
      core.setRadius(r);
      hot.setPosition(cx, y);
      hot.setRadius(r * 0.45);
    };
    layout();

    this.scene.tweens.add({
      targets: state,
      dist: length,
      scale: isSpecial ? 1.55 : isHeavy ? 1.28 : 1.1,
      duration: expandMs,
      ease: 'Quad.easeOut',
      onUpdate: layout,
      onComplete: () => {
        this.scene.tweens.add({
          targets: [glow, core, hot],
          alpha: 0,
          duration: isSpecial ? 320 : 220,
          onComplete: () => {
            glow.destroy();
            core.destroy();
            hot.destroy();
          },
        });
      },
    });

    const emberCount = isSpecial ? 5 : isHeavy ? 3 : 2;
    for (let i = 0; i < emberCount; i += 1) {
      const ember = this.scene.add.circle(
        startX + this.facing * (18 + i * 34),
        y - 6 + (i % 2) * 12,
        isSpecial ? 5 : 4,
        i % 2 ? 0x38bdf8 : 0xbae6fd,
        0.85,
      ).setDepth(FX_DEPTH);
      this.scene.tweens.add({
        targets: ember,
        x: ember.x + this.facing * 24,
        y: ember.y - 10 - i * 4,
        alpha: 0,
        scale: 0.2,
        duration: 260 + i * 40,
        onComplete: () => ember.destroy(),
      });
    }
  }

  /** Bakugo — orange explosion VFX. */
  spawnBakugoBlast(isHeavy, isSpecial) {
    const y = this.body.y - 52;
    const startX = this.body.x + this.facing * 40;
    const radius = isSpecial ? 28 : isHeavy ? 18 : 11;
    const expandMs = isSpecial ? 200 : isHeavy ? 130 : 85;

    const glow = this.scene.add.circle(startX, y, radius, 0xff6600, 0.38).setDepth(FX_DEPTH - 1);
    const core = this.scene.add.circle(startX, y, radius * 0.78, 0xffaa00, 0.92).setDepth(FX_DEPTH);
    const hot = this.scene.add.circle(startX, y, radius * 0.42, 0xffffcc, 0.95).setDepth(FX_DEPTH);

    const state = { scale: 0.35 };
    const layout = () => {
      const r = radius * state.scale;
      glow.setRadius(r * 1.4);
      core.setRadius(r);
      hot.setRadius(r * 0.45);
    };
    layout();

    this.scene.tweens.add({
      targets: state,
      scale: isSpecial ? 2.4 : isHeavy ? 1.65 : 1.25,
      duration: expandMs,
      ease: 'Quad.easeOut',
      onUpdate: layout,
      onComplete: () => {
        this.scene.tweens.add({
          targets: [glow, core, hot],
          alpha: 0,
          duration: isSpecial ? 340 : 240,
          onComplete: () => {
            glow.destroy();
            core.destroy();
            hot.destroy();
          },
        });
      },
    });

    const sparkCount = isSpecial ? 6 : isHeavy ? 4 : 2;
    for (let i = 0; i < sparkCount; i += 1) {
      const angle = (-40 + i * (80 / Math.max(1, sparkCount - 1))) * (Math.PI / 180);
      const dist = isSpecial ? 72 + i * 14 : isHeavy ? 48 + i * 10 : 28 + i * 8;
      const spark = this.scene.add.rectangle(
        startX + Math.cos(angle) * this.facing * dist * 0.3,
        y + Math.sin(angle) * dist * 0.25 - 4,
        isSpecial ? 22 : 14,
        3,
        i % 2 ? 0xff4400 : 0xffcc00,
        0.88,
      ).setDepth(FX_DEPTH).setAngle((angle * 180) / Math.PI);
      this.scene.tweens.add({
        targets: spark,
        x: spark.x + this.facing * (isSpecial ? 38 : 22),
        y: spark.y - (isSpecial ? 18 : 10),
        alpha: 0,
        scaleX: 1.6,
        duration: 280 + i * 35,
        onComplete: () => spark.destroy(),
      });
    }

    if (isSpecial) {
      const shock = this.scene.add.circle(startX + this.facing * 52, y, 12, 0xff8800, 0.25).setDepth(FX_DEPTH - 2);
      this.scene.tweens.add({
        targets: shock,
        scale: 4.5,
        alpha: 0,
        duration: 480,
        onComplete: () => shock.destroy(),
      });
    }
  }

  /** Todoroki — alternating fire / ice hit VFX. */
  spawnTodorokiElement(element, isHeavy) {
    const isFire = element === 'fire';
    const y = this.body.y - 52;
    const startX = this.body.x + this.facing * 38;
    const radius = isHeavy ? 14 : 9;
    const colors = isFire
      ? { glow: 0xff6600, core: 0xffaa44, hot: 0xffffcc }
      : { glow: 0x60a5fa, core: 0xbae6fd, hot: 0xffffff };

    const glow = this.scene.add.circle(startX, y, radius, colors.glow, 0.34).setDepth(FX_DEPTH - 1);
    const core = this.scene.add.circle(startX, y, radius * 0.76, colors.core, 0.9).setDepth(FX_DEPTH);
    const hot = this.scene.add.circle(startX, y, radius * 0.4, colors.hot, 0.92).setDepth(FX_DEPTH);

    this.scene.tweens.add({
      targets: [glow, core, hot],
      x: startX + this.facing * (isHeavy ? 34 : 22),
      scale: isHeavy ? 1.45 : 1.2,
      alpha: 0,
      duration: isHeavy ? 240 : 190,
      onComplete: () => {
        glow.destroy();
        core.destroy();
        hot.destroy();
      },
    });
  }

  /** Todoroki — Heaven-Piercing Ice Fire special. */
  spawnTodorokiDualBlast(element = 'fire') {
    const isFire = element === 'fire';
    const y = this.body.y - 54;
    const startX = this.body.x + this.facing * 42;
    const length = 190;

    const primary = this.scene.add.circle(
      startX,
      y,
      12,
      isFire ? 0xff6600 : 0x60a5fa,
      0.5,
    ).setDepth(FX_DEPTH - 1);
    const secondary = this.scene.add.circle(
      startX,
      y + (isFire ? 6 : -6),
      8,
      isFire ? 0xffcc44 : 0xbae6fd,
      0.38,
    ).setDepth(FX_DEPTH - 1);
    const core = this.scene.add.circle(startX, y, 8, 0xffffff, 0.88).setDepth(FX_DEPTH);

    const state = { dist: 0 };
    const layout = () => {
      const cx = startX + this.facing * state.dist * 0.55;
      primary.setPosition(cx, y);
      secondary.setPosition(cx, y + (isFire ? 6 : -6));
      core.setPosition(cx, y);
    };
    layout();

    this.scene.tweens.add({
      targets: state,
      dist: length,
      duration: 220,
      ease: 'Quad.easeOut',
      onUpdate: layout,
      onComplete: () => {
        this.scene.tweens.add({
          targets: [primary, secondary, core],
          alpha: 0,
          scale: 1.35,
          duration: 260,
          onComplete: () => {
            primary.destroy();
            secondary.destroy();
            core.destroy();
          },
        });
      },
    });

    const shardCount = isFire ? 5 : 6;
    for (let i = 0; i < shardCount; i += 1) {
      const shard = this.scene.add.circle(
        startX + this.facing * (16 + i * 28),
        y - 8 + (i % 2) * 14,
        isFire ? 5 : 4,
        isFire ? 0xff8800 : 0x93c5fd,
        0.82,
      ).setDepth(FX_DEPTH);
      this.scene.tweens.add({
        targets: shard,
        x: shard.x + this.facing * 30,
        y: shard.y + (isFire ? -12 : 6),
        alpha: 0,
        scale: 0.2,
        duration: 300 + i * 35,
        onComplete: () => shard.destroy(),
      });
    }
  }

  clearBurnTimers() {
    for (const timer of this.burnTimers) timer.remove();
    this.burnTimers = [];
  }

  applyChipDamage(amount, attacker) {
    if (this.isDead || amount <= 0) return 0;

    let finalDamage = Math.round(amount * this.getStatMult('damageTakenMult'));
    if (this.isBlocking) finalDamage = Math.round(finalDamage * (1 - this.config.blockReduction));

    this.hp = Math.max(0, this.hp - finalDamage);
    this.updateAwakenForm();

    if (finalDamage > 0) {
      SFX.hitLight();
    }

    if (this.hp <= 0) {
      this.isDead = true;
      this.body.body.setVelocity(0, 0);
      this.body.body.setAllowGravity(false);
      const knockDir = attacker?.body?.x < this.body.x ? 1 : -1;
      this.scene.tweens.add({
        targets: this.body,
        alpha: 0.4,
        angle: knockDir * 90,
        y: GROUND_Y,
        duration: 600,
      });
    }

    return finalDamage;
  }

  applyTodorokiFreeze(duration = TODOROKI_FREEZE_MS) {
    const until = this.scene.time.now + duration;
    this.freezeUntil = until;
    this.slowUntil = until;
    this.isHit = true;
    this.body.body.setVelocity(0, 0);
    this.sprite.setTint(0x88ccff);
    this.scene.time.delayedCall(duration, () => {
      if (this.isDead) return;
      this.freezeUntil = 0;
      this.isHit = false;
      if (!this.isBlocking) this.sprite.clearTint();
    });
  }

  applyTodorokiBurn(attacker) {
    this.clearBurnTimers();
    const tickDamage = Math.round(TODOROKI_BURN_DAMAGE * (attacker?.getStatMult?.('damageMult') ?? 1));
    this.burnUntil = this.scene.time.now + TODOROKI_BURN_TICKS * TODOROKI_BURN_TICK_MS;
    this.sprite.setTint(0xff8844);

    for (let i = 1; i <= TODOROKI_BURN_TICKS; i += 1) {
      const timer = this.scene.time.delayedCall(TODOROKI_BURN_TICK_MS * i, () => {
        if (this.isDead) return;
        this.applyChipDamage(tickDamage, attacker);
        this.sprite.setTint(0xff6622);
        this.scene.time.delayedCall(70, () => {
          if (!this.isDead && this.burnUntil > this.scene.time.now) {
            this.sprite.setTint(0xff8844);
          } else if (!this.isBlocking) {
            this.sprite.clearTint();
          }
        });
      });
      this.burnTimers.push(timer);
    }

    const endTimer = this.scene.time.delayedCall(TODOROKI_BURN_TICKS * TODOROKI_BURN_TICK_MS + 80, () => {
      this.burnUntil = 0;
      if (!this.isDead && !this.isBlocking) this.sprite.clearTint();
    });
    this.burnTimers.push(endTimer);
  }

  clearZeroGravity() {
    if (!this.zeroGravity) return;
    this.scene.tweens.killTweensOf(this.body);
    this.zeroGravity = null;
    this.isHit = false;
    if (this.body?.body) {
      this.body.body.setAllowGravity(true);
      this.body.body.setVelocity(0, 0);
    }
    this.body.y = GROUND_Y;
    this.sprite?.clearTint?.();
  }

  /** Uraraka — lift foe, hold 2s, slam for damage. */
  applyZeroGravity(attacker, dropDamage) {
    if (this.zeroGravity || this.isDead) return;

    this.zeroGravity = {
      attacker,
      dropDamage,
      phase: 'rise',
    };
    this.isHit = true;
    this.body.body.setVelocity(0, 0);
    this.body.body.setAllowGravity(false);

    const floatY = GROUND_Y - 128;
    this.sprite.setTint(0xf1a7c1);
    this.scene.events.emit('fighter-zero-gravity', { attacker, defender: this });

    this.scene.tweens.add({
      targets: this.body,
      y: floatY,
      duration: 420,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (!this.zeroGravity) return;
        this.zeroGravity.phase = 'hold';
        this.zeroGravity.holdUntil = this.scene.time.now + 2000;
      },
    });
  }

  updateZeroGravity(time) {
    if (!this.zeroGravity || this.isDead) return false;

    const zg = this.zeroGravity;
    if (zg.phase === 'hold' && time >= zg.holdUntil) {
      zg.phase = 'drop';
      this.scene.tweens.add({
        targets: this.body,
        y: GROUND_Y,
        duration: 300,
        ease: 'Quad.easeIn',
        onComplete: () => this.finishZeroGravityDrop(),
      });
    }

    this.body.body.setVelocity(0, 0);
    return true;
  }

  finishZeroGravityDrop() {
    if (!this.zeroGravity) return;

    const { attacker, dropDamage } = this.zeroGravity;
    this.zeroGravity = null;
    this.isHit = false;
    this.body.y = GROUND_Y;
    this.body.body.setAllowGravity(true);
    this.body.body.setVelocity(0, 0);
    this.sprite.clearTint();

    if (this.isDead) return;

    let finalDamage = dropDamage;
    finalDamage *= this.getStatMult('damageTakenMult');
    finalDamage = Math.round(finalDamage);
    if (finalDamage <= 0) return;

    this.hp = Math.max(0, this.hp - finalDamage);
    this.updateAwakenForm();

    SFX.hitHeavy();
    this.sprite.setTint(0xff4444);
    this.scene.time.delayedCall(140, () => this.sprite.clearTint());
    this.scene.events.emit('fighter-zero-gravity-drop', { attacker, defender: this, damage: finalDamage });
    this.scene.events.emit('fighter-hit', { attacker, defender: this, damage: finalDamage });

    if (this.hp <= 0) {
      this.isDead = true;
      this.body.body.setAllowGravity(false);
      const knockDir = attacker.body.x < this.body.x ? 1 : -1;
      this.scene.tweens.add({
        targets: this.body,
        alpha: 0.4,
        angle: knockDir * 90,
        y: GROUND_Y,
        duration: 600,
      });
    }
  }

  /** Uraraka — pink zero-gravity touch VFX. */
  spawnUrarakaZeroGravityVfx() {
    const x = this.body.x + this.facing * 52;
    const y = this.body.y - 54;
    const glow = this.scene.add.circle(x, y, 14, 0xf1a7c1, 0.45).setDepth(FX_DEPTH - 1);
    const core = this.scene.add.circle(x, y, 8, 0xffffff, 0.9).setDepth(FX_DEPTH);
    this.scene.tweens.add({
      targets: [glow, core],
      scale: 2.2,
      alpha: 0,
      duration: 420,
      onComplete: () => {
        glow.destroy();
        core.destroy();
      },
    });
    for (let i = 0; i < 4; i += 1) {
      const spark = this.scene.add.circle(
        x + (i - 1.5) * 10,
        y - 8 + i * 4,
        3,
        0xffb6c1,
        0.85,
      ).setDepth(FX_DEPTH);
      this.scene.tweens.add({
        targets: spark,
        y: spark.y - 22 - i * 6,
        alpha: 0,
        duration: 360 + i * 40,
        onComplete: () => spark.destroy(),
      });
    }
  }

  /** Twice — duplicate spawn VFX. */
  spawnTwiceDuplicateVfx() {
    const x = this.body.x;
    const y = this.body.y - 58;
    const texKey = this.sprite?.texture?.key;
    if (texKey) {
      for (let i = 0; i < 3; i += 1) {
        const ghost = this.scene.add.image(x + (i - 1) * 28, y, texKey);
        ghost.setOrigin(0.5, 1);
        ghost.setDisplaySize(this.sprite.displayWidth * 0.55, this.sprite.displayHeight * 0.55);
        ghost.setFlipX(this.facing === -1);
        ghost.setAlpha(0.55);
        ghost.setTint(this.config.auraColor);
        ghost.setDepth(FX_DEPTH - 2);
        this.scene.tweens.add({
          targets: ghost,
          x: x + this.facing * (40 + i * 18),
          alpha: 0,
          duration: 320 + i * 40,
          onComplete: () => ghost.destroy(),
        });
      }
    }
    const ring = this.scene.add.circle(x, y, 20, this.config.auraColor, 0.35).setDepth(FX_DEPTH - 1);
    this.scene.tweens.add({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      duration: 380,
      onComplete: () => ring.destroy(),
    });
  }

  /** Stain — crimson blade slash VFX. */
  spawnStainSlash(isHeavy, isSpecial) {
    const baseX = this.body.x + this.facing * 36;
    const baseY = this.body.y - 52;
    const count = isSpecial ? 5 : isHeavy ? 3 : 2;
    const reach = isSpecial ? 88 : isHeavy ? 62 : 44;

    for (let i = 0; i < count; i += 1) {
      const arc = this.scene.add.arc(
        baseX + this.facing * (12 + i * 18),
        baseY - i * 6,
        reach * (0.55 + i * 0.08),
        -70 * this.facing,
        40 * this.facing,
        false,
        0xdc2626,
        isSpecial ? 0.72 : 0.58,
      ).setDepth(FX_DEPTH).setAngle(-28 * this.facing + i * 14);
      this.scene.tweens.add({
        targets: arc,
        scaleX: 1.35 + i * 0.12,
        scaleY: 1.2,
        alpha: 0,
        x: arc.x + this.facing * (isSpecial ? 36 : 22),
        duration: isSpecial ? 340 : 220 + i * 40,
        onComplete: () => arc.destroy(),
      });
    }

    if (isSpecial) {
      const ring = this.scene.add.circle(baseX, baseY, 14, 0x7f1d1d, 0.35).setDepth(FX_DEPTH - 1);
      this.scene.tweens.add({
        targets: ring,
        scale: 3.2,
        alpha: 0,
        duration: 420,
        onComplete: () => ring.destroy(),
      });
    }
  }

  syncHitbox() {
    if (!this.isAttacking || !this.currentAttack) {
      this.hitbox.body.setSize(0, 0);
      return;
    }

    const range = this.currentAttack.range;
    this.hitbox.x = this.body.x + this.facing * (range / 2);
    this.hitbox.y = this.body.y - 50;
    this.hitbox.body.setSize(range, 60);
  }

  updateVisuals() {
    const time = this.scene.time.now;
    this.sprite.setFlipX(this.facing === -1);

    const pulse = 0.1 + Math.sin(time / 200) * 0.04;
    const specialReady = this.power >= this.config.specialCost;

    if (this.usesImageArt) {
      // subtle idle breathing — feet stay planted (origin 0.5, 1)
      if (!this.isAttacking && !this.isHit && this.onGround) {
        this.baseSpriteY = Math.sin(time / 340) * 2.5;
        this.sprite.y = this.baseSpriteY;
      }
      // ground shadow scales with character width
      const footW = Math.max(36, this.sprite.displayWidth * 0.38);
      this.shadow.width = footW;
      this.shadow.height = 10;
      this.shadow.setAlpha(this.onGround ? 0.38 : 0.18);
      this.shadow.scaleX = this.onGround ? 1 : 0.55;
      if (this.isBlocking) {
        this.sprite.setTint(0xccddee);
      } else if (this.zeroGravity) {
        this.sprite.setTint(0xf1a7c1);
      } else if (this.activeForm === 'awakened') {
        const tint = this.config.id === 'deku' ? 0x88eeff
          : this.config.id === 'overhaul' ? 0xcc88ff
            : 0xddbbff;
        this.sprite.setTint(tint);
      } else {
        this.sprite.clearTint();
      }
      return;
    }

    this.aura.setAlpha(this.isBlocking ? 0.22 : specialReady ? pulse + 0.14 : pulse);

    if (this.isBlocking) {
      this.sprite.setTint(0x8899aa);
      this.glowRing.setStrokeStyle(1, 0xffffff, 0.45);
    } else if (specialReady) {
      this.sprite.clearTint();
      this.glowRing.setStrokeStyle(2, this.config.auraColor, 0.55 + pulse);
    } else {
      this.sprite.clearTint();
      this.glowRing.setStrokeStyle(1, this.config.auraColor, 0);
    }

    this.shadow.scaleX = this.onGround ? 1 : 0.6;
  }

  regenPower() {
    let regenRate = 12;
    if (this.config.powerRegenMult) regenRate *= this.config.powerRegenMult;
    if (this.config.id === 'megumi') regenRate = 18;
    this.power = Math.min(this.maxPower, this.power + (regenRate * this.scene.game.loop.delta) / 1000);
  }

  takeDamage(amount, attacker) {
    if (this.isDead) return 0;

    const zeroGravityHit = attacker?.config?.id === 'uraraka'
      && attacker.currentAttack?.type === 'special'
      && !this.isBlocking;

    if (zeroGravityHit) {
      if (!this.zeroGravity) {
        const dropDamage = Math.round(
          (attacker.config.specialDamage ?? 28)
            * (attacker.config.zeroGravityMult ?? 1)
            * attacker.getStatMult('damageMult'),
        );
        this.applyZeroGravity(attacker, dropDamage);
      }
      return 1;
    }

    let finalDamage = amount;
    const counterHit = this.inAttackStartup && this.isAttacking;

    if (this.config.id === 'gojo') {
      finalDamage *= 0.8;
    }

    let blockReduction = this.config.blockReduction;
    if (this.isBlocking && attacker?.config?.guardBreakHeavy && attacker.currentAttack?.type === 'heavy') {
      blockReduction *= 0.45;
    }

    if (this.isBlocking) {
      finalDamage *= 1 - blockReduction;
      const chip = Math.max(1, Math.round(amount * (attacker?.config?.chipRate ?? 0.12)));
      finalDamage += chip;
    }

    if (counterHit) {
      const counterMult = attacker?.config?.counterBonus ?? 1.25;
      finalDamage = Math.round(finalDamage * counterMult);
    }

    finalDamage *= this.getStatMult('damageTakenMult');
    finalDamage = Math.round(finalDamage);
    this.hp = Math.max(0, this.hp - finalDamage);
    this.updateAwakenForm();

    const knockDir = attacker.body.x < this.body.x ? 1 : -1;
    const kbMult = attacker.currentAttack?.knockBoost ?? 1;

    if (counterHit && finalDamage > 0) {
      this.scene.events.emit('fighter-counter', { attacker, defender: this, damage: finalDamage });
    }

    if (this.isBlocking) {
      SFX.block();
    } else if (finalDamage >= 18) {
      SFX.hitHeavy();
    } else if (finalDamage > 0) {
      SFX.hitLight();
    }

    if (attacker?.currentAttack?.type === 'special' && finalDamage > 0 && !this.isBlocking) {
      SFX.specialHit(attacker.config.id);
    }

    if (finalDamage > 0) {
      this.isHit = true;
      this.comboCount = 0;
      this.comboChain = 0;

      const bloodcurdle = attacker?.config?.id === 'stain'
        && attacker.currentAttack?.type === 'special'
        && !this.isBlocking;
      const todorokiSpecial = attacker?.config?.id === 'todoroki'
        && attacker.currentAttack?.type === 'special'
        && !this.isBlocking;
      const hitstun = bloodcurdle ? BLOODCURDLE_STUN_MS : HITSTUN_MS;
      const skipHitstunTimer = todorokiSpecial && attacker.currentAttack?.element === 'ice';

      if (bloodcurdle) {
        this.body.body.setVelocity(0, 0);
        this.scene.events.emit('fighter-bloodcurdle', { attacker, defender: this });
      } else if (todorokiSpecial) {
        this.body.body.setVelocity(0, 0);
        if (attacker.currentAttack.element === 'ice') {
          this.applyTodorokiFreeze();
          this.scene.events.emit('fighter-todoroki-freeze', { attacker, defender: this });
        } else {
          this.applyTodorokiBurn(attacker);
          this.scene.events.emit('fighter-todoroki-burn', { attacker, defender: this });
        }
      } else if (
        attacker?.config?.id === 'todoroki'
        && attacker.currentAttack?.element === 'ice'
        && !this.isBlocking
      ) {
        this.slowUntil = this.scene.time.now + 420;
        this.body.body.setVelocityX(this.body.body.velocity.x * 0.35);
        this.body.body.setVelocityY(-80);
      } else if (!attacker?.config?.noKnockback) {
        this.body.body.setVelocityX(knockDir * KNOCKBACK * kbMult);
        if (attacker.currentAttack?.launch && !this.isBlocking) {
          this.body.body.setVelocityY(-360);
        } else {
          this.body.body.setVelocityY(-120);
        }
      } else {
        this.body.body.setVelocity(0, 0);
      }

      this.sprite.setTint(
        bloodcurdle ? 0x991b1b
          : todorokiSpecial && attacker.currentAttack?.element === 'fire' ? 0xff8844
            : attacker?.config?.id === 'todoroki' && attacker.currentAttack?.element === 'ice' ? 0x88ccff
              : 0xff4444,
      );
      this.scene.time.delayedCall(120, () => {
        if (!this.isBlocking && !this.burnUntil && !this.freezeUntil) this.sprite.clearTint();
      });

      if (!skipHitstunTimer) {
        this.scene.time.delayedCall(hitstun, () => {
          this.isHit = false;
        });
      }

      this.scene.events.emit('fighter-hit', { attacker, defender: this, damage: finalDamage });
    }

    if (this.hp <= 0) {
      this.isDead = true;
      this.body.body.setVelocity(0, 0);
      this.body.body.setAllowGravity(false);
      this.scene.tweens.add({
        targets: this.body,
        alpha: 0.4,
        angle: knockDir * 90,
        y: GROUND_Y,
        duration: 600,
      });
    }

    return finalDamage;
  }

  getAttackDamage() {
    if (!this.currentAttack || this.currentAttack.hit) return 0;
    return this.currentAttack.damage;
  }

  markAttackHit() {
    if (!this.currentAttack) return;
    this.currentAttack.hit = true;

    const now = this.scene.time.now;
    if (this.currentAttack.type === 'light') {
      this.comboChain = Math.min(5, this.comboChain + 1);
      this.lastComboHit = now;
      if (this.comboChain >= 3) this.comboDisplay = this.comboChain;
    } else if (this.currentAttack.type === 'heavy' && this.comboChain >= 2) {
      // comboDisplay set in performAttack for finishers
    } else if (!['light', 'heavy'].includes(this.currentAttack.type)) {
      this.comboChain = 0;
    }

    this.power = Math.min(this.maxPower, this.power + 5);
  }

  isSpecialReady() {
    return this.power >= this.config.specialCost;
  }

  destroy() {
    this.clearAttackAnimTimers();
    this.clearZeroGravity();
    this.clearBurnTimers();
    this.superAwakenTimer?.remove();
    this.superAwakenTimer = null;
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.killTweensOf(this.body);
    if (this.hitbox?.active) this.hitbox.destroy();
    if (this.body?.active) this.body.destroy();
  }
}
