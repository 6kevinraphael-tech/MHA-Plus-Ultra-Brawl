import Phaser from 'phaser';
import { getCharacterById, GAME_WIDTH, GAME_HEIGHT, GROUND_Y } from '../data/characters.js';
import { Fighter } from '../entities/Fighter.js';
import { TwiceClone } from '../entities/TwiceClone.js';
import { drawArena } from '../utils/arenaRenderer.js';
import { getArenaById } from '../data/backgrounds.js';
import { getArcadeDifficulty } from '../data/arcade.js';
import { getCampaignDifficulty, getOpponentConfig } from '../data/campaign.js';
import {
  unlockCharacter,
  unlockStage,
  setCampaignProgress,
  loadProgress,
} from '../utils/unlockProgress.js';
import { getWinQuote } from '../data/winQuotes.js';
import { CpuController } from '../utils/cpuAI.js';
import { MouseFightInput, KeyboardFightInput, NetworkFightInput } from '../utils/fightControls.js';
import { SFX, stopGameMusic } from '../utils/audio.js';
import {
  addAngledPortrait,
  comicTitle,
  createAngledMeter,
  drawGlassPanel,
  factionPalette,
  label,
  setAngledMeter,
  superCutIn,
  UI,
} from '../utils/uiTheme.js';
import { playAwakenCinematic, cleanupAwakenCinematic } from '../utils/awakenCinematic.js';
import { createPortraitImage } from '../utils/spriteFrames.js';
import { resetSceneTransition, safeSceneStart, ensureSceneVisible, beginScene, transitionTo } from '../utils/sceneTransition.js';
import { ensureGameMusic } from '../utils/audio.js';
import { createClickButton, createButtonRow } from '../utils/uiButtons.js';
import {
  isOnlineHost,
  onOnlineEvent,
  sendOnline,
  leaveOnlineRoom,
} from '../utils/onlineSession.js';
import { applyBattleSnapshot, serializeBattleState } from '../utils/onlineFight.js';
import {
  HawkFeatherRing,
  calcHawksBurstDamage,
  getHawkFeatherMax,
} from '../utils/hawksFeathers.js';

const ROUNDS_TO_WIN = 2;

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  init(data) {
    beginScene(this);
    this.p1Config = getCharacterById(data.p1);
    this.p2Config = getCharacterById(data.p2);
    this.mode = data.mode ?? '2p';
    this.campaign = data.campaign ?? null;
    if (this.campaign?.node) {
      this.p2Config = getOpponentConfig(this.campaign.node);
    }
    this.onlineRole = data.onlineRole ?? null;
    this.isOnline = this.mode === 'online';
    this.isOnlineHost = this.isOnline && (this.onlineRole === 'host' || isOnlineHost());
    this.isOnlineGuest = this.isOnline && this.onlineRole === 'guest';
    this.difficulty = data.difficulty ?? 'normal';
    this.playerSide = data.playerSide ?? this.p1Config?.faction ?? 'hero';
    this.isCpu = this.mode === '1p' || this.mode === 'campaign';
    this.stageId = data.stageId ?? this.registry.get('stageId') ?? 'ua-entrance';
    this.arena = getArenaById(this.stageId);
    this.arcade = data.arcade ?? null;
    this._bossMods = this.p2Config?.bossMods ?? null;
    this.paused = false;
    this._p1SuperReady = false;
    this._p2SuperReady = false;
    this.p1Palette = factionPalette(this.p1Config?.faction ?? 'hero');
    this.p2Palette = factionPalette(this.p2Config?.faction ?? 'villain');
    this._awakenCineActive = false;
    this._hitStopUntil = null;
    this._slowMoUntil = null;

    this.roundOver = false;
    this.matchOver = false;
    this.fightStarted = false;
    this.currentRound = 1;
    this.p1Rounds = 0;
    this.p2Rounds = 0;
    this.winner = null;
  }

  create() {
    beginScene(this);
    this.cameras.main.setZoom(1);

    if (!this.p1Config || !this.p2Config) {
      safeSceneStart(this, 'CharacterSelectScene', {}, { fadeMs: 0 });
      return;
    }

    ensureGameMusic();
    this.buildFight();
  }

  buildFight() {
    if (!this.p1Config || !this.p2Config) return;

    this.tweens.timeScale = 1;
    this.physics.world.timeScale = 1;

    drawArena(this, this.arena);
    this.createGround();

    this.p1 = new Fighter(this, 200, this.p1Config, 1);
    this.p2 = new Fighter(this, GAME_WIDTH - 200, this.p2Config, 2);
    this.p1.setOpponent(this.p2);
    this.p2.setOpponent(this.p1);

    this.cpu = this.isCpu
      ? new CpuController(
        this.campaign
          ? getCampaignDifficulty(this.difficulty, this.campaign.stageIndex ?? 0)
          : this.arcade
            ? getArcadeDifficulty(this.difficulty, this.arcade.stageIndex ?? 0)
            : this.difficulty,
        this.p2Config.id,
      )
      : null;

    this.physics.add.collider(this.p1.body, this.ground);
    this.physics.add.collider(this.p2.body, this.ground);

    this.createHud();
    this.createControlsHelp();
    this.setupInput();
    this.createMoveCursor();
    this.setupCombatEvents();

    this.roundTimer = 99;

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!this.fightStarted || this.roundOver || this.matchOver) return;
        this.roundTimer = Math.max(0, this.roundTimer - 1);
        this.timerText.setText(String(this.roundTimer).padStart(2, '0'));
        this.timerText.setColor(this.roundTimer <= 10 ? '#ff6b6b' : UI.accentText);
        if (this.roundTimer === 0) this.resolveRoundEnd('time');
      },
    });

    this.physics.add.overlap(this.p1.hitbox, this.p2.body, () => this.resolveHit(this.p1, this.p2), null, this);
    this.physics.add.overlap(this.p2.hitbox, this.p1.body, () => this.resolveHit(this.p2, this.p1), null, this);

    this.p1Clones = [];
    this.p2Clones = [];
    this.hawkFeatherRing = new HawkFeatherRing(this);
    this.p1.hawkFeatherCount = 0;
    this.p2.hawkFeatherCount = 0;

    this.startRound();
    this.updatePauseButton();
    ensureSceneVisible(this);
    this.cameras.main.fadeIn(300);

    if (this.isOnlineHost) {
      this.time.delayedCall(400, () => {
        sendOnline('state', { state: serializeBattleState(this) });
      });
    }
    if (this.isOnlineGuest) {
      sendOnline('request_state', {});
    }
  }

  createGround() {
    this.ground = this.add.rectangle(GAME_WIDTH / 2, GROUND_Y + 15, GAME_WIDTH, 30, 0x000000, 0);
    this.physics.add.existing(this.ground, true);
  }

  setupInput() {
    if (this.isOnlineHost) {
      this.p1Input = new MouseFightInput(this);
      this.p2Input = new NetworkFightInput();
    } else if (this.isOnlineGuest) {
      this.p1Input = null;
      this.p2Input = new KeyboardFightInput(this);
    } else {
      this.p1Input = new MouseFightInput(this);
      this.p2Input = this.isCpu ? null : new KeyboardFightInput(this);
    }

    this._stateSendAccum = 0;
    this._onlineUnsubs = [];
    if (this.isOnlineHost) {
      this._onlineUnsubs.push(onOnlineEvent('relay:input', (msg) => {
        this.p2Input?.setRemote?.(msg.controls);
      }));
      this._onlineUnsubs.push(onOnlineEvent('relay:request_state', () => {
        sendOnline('state', { state: serializeBattleState(this) });
      }));
      this._onlineUnsubs.push(onOnlineEvent('peer_left', () => this.onPeerDisconnected()));
    }
    if (this.isOnlineGuest) {
      this._onlineUnsubs.push(onOnlineEvent('relay:state', (msg) => {
        if (msg.state) applyBattleSnapshot(this, msg.state);
      }));
      this._onlineUnsubs.push(onOnlineEvent('peer_left', () => this.onPeerDisconnected()));
    }

    this.pauseBtn = createClickButton(this, GAME_WIDTH - 52, 78, 'PAUSE', () => this.togglePause(), {
      width: 72, height: 28, fontSize: '10px', depth: UI.hudDepth + 2, sfx: 'move',
    });

    this._onVisibility = () => {
      if (document.hidden || this.matchOver) return;
      this.recoverPhysics();
    };
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  updatePauseButton() {
    this.pauseBtn?.setEnabled(this.fightStarted && !this.matchOver && !this.roundOver);
  }

  createMoveCursor() {
    this.moveCursor = this.add.circle(0, GROUND_Y - 6, 5, UI.gold, 0.85).setDepth(UI.fxDepth);
    this.moveCursor.setStrokeStyle(2, 0xffffff, 0.9);
    this.moveRing = this.add.ellipse(0, GROUND_Y - 2, 14, 5, 0x000000, 0.35).setDepth(UI.fxDepth - 1);
  }

  updateMoveCursor(x) {
    if (x == null || !this.moveCursor) {
      if (this.moveCursor) this.moveCursor.setVisible(false);
      if (this.moveRing) this.moveRing.setVisible(false);
      return;
    }
    if (!this.fightStarted || this.roundOver || this.matchOver) {
      this.moveCursor.setVisible(false);
      this.moveRing.setVisible(false);
      return;
    }
    this.moveCursor.setVisible(true);
    this.moveRing.setVisible(true);
    this.moveCursor.x = x;
    this.moveRing.x = x;
  }

  setupCombatEvents() {
    this.events.on('fighter-hit', ({ attacker, defender, damage }) => {
      const isSpecial = attacker.currentAttack?.type === 'special';
      const heavy = damage >= 22;
      this.cameras.main.shake(heavy ? 130 : 70, heavy ? 0.007 : 0.0035);
      this.hitStop(heavy ? 95 : 55);
      if (heavy) this.screenPunch();
      this.spawnHitSpark(defender.body.x, defender.body.y - 56, defender.isBlocking ? 0xffffff : attacker.config.auraColor, isSpecial || damage >= 18);

      if (isSpecial) this.cameras.main.flash(110, 255, 255, 255, false);

      if (attacker.comboDisplay > 0) {
        this.showComboText(attacker.body.x, attacker.body.y - 100, attacker.comboDisplay);
        attacker.comboDisplay = 0;
      }

      this.showDamageNumber(defender.body.x, defender.body.y - 80, damage, isSpecial);

      if (attacker.config.id === 'hawks' && damage > 0) {
        this.addHawkFeather(defender);
      }
    });

    this.events.on('fighter-counter', ({ attacker, defender, damage }) => {
      const tag = label(this, defender.body.x, defender.body.y - 110, 'COUNTER!', {
        fontSize: '14px', color: UI.goldText, fontStyle: 'italic', stroke: '#000', strokeThickness: 4,
      }).setDepth(UI.fxDepth);
      this.tweens.add({ targets: tag, y: tag.y - 24, alpha: 0, duration: 500, onComplete: () => tag.destroy() });
      this.spawnHitSpark(defender.body.x, defender.body.y - 56, UI.gold, true);
      this.hitStop(70);
    });

    this.events.on('fighter-land', (fighter) => {
      this.spawnDust(fighter.body.x, GROUND_Y);
    });

    this.events.on('fighter-special', (fighter) => {
      if (!this.fightStarted || this.roundOver || this.matchOver) return;
      const isP1 = fighter === this.p1;
      const palette = isP1 ? this.p1Palette : this.p2Palette;
      superCutIn(this, fighter.config, palette.main, isP1 ? 'left' : 'right');
      this.spawnSpeedlines(palette.soft);
      this.hitStop(360);
    });

    this.events.on('fighter-awaken', (fighter, payload) => {
      if (!this.fightStarted || this.roundOver || this.matchOver) return;
      playAwakenCinematic(this, fighter, payload ?? { label: 'AWAKENED' });
    });

    this.events.on('fighter-toga-transform', (fighter, payload) => {
      if (!this.fightStarted || this.roundOver || this.matchOver) return;
      this.showTogaTransformEffect(fighter, payload);
    });

    this.events.on('fighter-toga-revert', (fighter) => {
      this.updateTogaHudName(fighter);
    });

    this.events.on('fighter-bloodcurdle', ({ defender }) => {
      this.showBloodcurdleEffect(defender);
    });

    this.events.on('fighter-zero-gravity', ({ defender }) => {
      this.showZeroGravityEffect(defender);
    });

    this.events.on('fighter-todoroki-freeze', ({ defender }) => {
      this.showTodorokiFreezeEffect(defender);
    });

    this.events.on('fighter-todoroki-burn', ({ defender }) => {
      this.showTodorokiBurnEffect(defender);
    });

    this.events.on('fighter-zero-gravity-drop', ({ defender, damage }) => {
      this.cameras.main.shake(160, 0.008);
      this.spawnDust(defender.body.x, GROUND_Y);
    });

    this.events.on('fighter-endeavor-overheat', (fighter) => {
      this.showEndeavorOverheatEffect(fighter);
    });
  }

  showEndeavorOverheatEffect(fighter) {
    if (!fighter?.body) return;
    const x = fighter.body.x;
    const y = fighter.body.y - 72;

    this.cameras.main.flash(120, 80, 160, 255, false);
    this.cameras.main.shake(180, 0.006);

    const ring = this.add.circle(x, y, 20, 0x4488ff, 0.5).setDepth(UI.fxDepth);
    this.tweens.add({
      targets: ring,
      scale: 3,
      alpha: 0,
      duration: 560,
      onComplete: () => ring.destroy(),
    });

    const tag = comicTitle(this, x, y - 38, 'OVERHEAT', {
      size: 20,
      color: '#66aaff',
      depth: UI.fxDepth + 1,
    });
    this.tweens.add({
      targets: tag,
      y: tag.y - 28,
      alpha: 0,
      duration: 900,
      onComplete: () => tag.destroy(),
    });
  }

  showBloodcurdleEffect(defender) {
    if (!defender?.body) return;
    const x = defender.body.x;
    const y = defender.body.y - 72;

    this.cameras.main.flash(90, 180, 20, 20, false);

    const ring = this.add.circle(x, y, 18, 0x991b1b, 0.55).setDepth(UI.fxDepth);
    this.tweens.add({
      targets: ring,
      scale: 2.8,
      alpha: 0,
      duration: 520,
      onComplete: () => ring.destroy(),
    });

    const tag = comicTitle(this, x, y - 36, 'BLOODCURDLE', {
      size: 18,
      color: '#ff4444',
      depth: UI.fxDepth + 1,
    });
    this.tweens.add({
      targets: tag,
      y: y - 58,
      alpha: 0,
      duration: 620,
      onComplete: () => tag.destroy(),
    });

    const droplet = this.add.triangle(x - 14, y - 8, 0, 0, 8, 14, 16, 0, 0xdc2626, 0.9).setDepth(UI.fxDepth);
    const droplet2 = this.add.triangle(x + 12, y - 4, 0, 0, 8, 14, 16, 0, 0xdc2626, 0.9).setDepth(UI.fxDepth);
    this.tweens.add({
      targets: [droplet, droplet2],
      y: '+=18',
      alpha: 0,
      duration: 480,
      onComplete: () => {
        droplet.destroy();
        droplet2.destroy();
      },
    });
  }

  showTodorokiFreezeEffect(defender) {
    if (!defender?.body) return;
    const x = defender.body.x;
    const y = defender.body.y - 72;

    this.cameras.main.flash(90, 120, 200, 255, false);

    const ring = this.add.circle(x, y, 16, 0x60a5fa, 0.55).setDepth(UI.fxDepth);
    this.tweens.add({
      targets: ring,
      scale: 2.4,
      alpha: 0,
      duration: 520,
      onComplete: () => ring.destroy(),
    });

    const tag = comicTitle(this, x, y - 34, 'FROZEN', {
      size: 17,
      color: '#93c5fd',
      depth: UI.fxDepth + 1,
    });
    this.tweens.add({
      targets: tag,
      y: y - 56,
      alpha: 0,
      duration: 600,
      onComplete: () => tag.destroy(),
    });

    for (let i = 0; i < 4; i += 1) {
      const shard = this.add.triangle(
        x + (i - 1.5) * 16,
        y + 8,
        0, 0, 6, 12, 12, 0,
        0xbae6fd,
        0.85,
      ).setDepth(UI.fxDepth);
      this.tweens.add({
        targets: shard,
        y: y - 20 - i * 6,
        alpha: 0,
        duration: 480 + i * 40,
        onComplete: () => shard.destroy(),
      });
    }
  }

  showTodorokiBurnEffect(defender) {
    if (!defender?.body) return;
    const x = defender.body.x;
    const y = defender.body.y - 72;

    this.cameras.main.flash(90, 255, 120, 40, false);

    const ring = this.add.circle(x, y, 16, 0xff6600, 0.5).setDepth(UI.fxDepth);
    this.tweens.add({
      targets: ring,
      scale: 2.5,
      alpha: 0,
      duration: 540,
      onComplete: () => ring.destroy(),
    });

    const tag = comicTitle(this, x, y - 34, 'BURN', {
      size: 17,
      color: '#ff8844',
      depth: UI.fxDepth + 1,
    });
    this.tweens.add({
      targets: tag,
      y: y - 56,
      alpha: 0,
      duration: 620,
      onComplete: () => tag.destroy(),
    });

    for (let i = 0; i < 4; i += 1) {
      const ember = this.add.circle(x + (i - 1.5) * 14, y + 4, 5, 0xff8800, 0.9).setDepth(UI.fxDepth);
      this.tweens.add({
        targets: ember,
        y: y - 28 - i * 8,
        alpha: 0,
        scale: 0.2,
        duration: 460 + i * 50,
        onComplete: () => ember.destroy(),
      });
    }
  }

  showZeroGravityEffect(defender) {
    if (!defender?.body) return;
    const x = defender.body.x;
    const y = defender.body.y - 72;

    this.cameras.main.flash(100, 255, 180, 220, false);

    const ring = this.add.circle(x, y, 16, 0xf1a7c1, 0.5).setDepth(UI.fxDepth);
    this.tweens.add({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      duration: 560,
      onComplete: () => ring.destroy(),
    });

    const tag = comicTitle(this, x, y - 34, 'ZERO GRAVITY', {
      size: 17,
      color: '#ffb6c1',
      depth: UI.fxDepth + 1,
    });
    this.tweens.add({
      targets: tag,
      y: y - 56,
      alpha: 0,
      duration: 680,
      onComplete: () => tag.destroy(),
    });

    for (let i = 0; i < 5; i += 1) {
      const orb = this.add.circle(x + (i - 2) * 14, y + 6, 4, 0xffffff, 0.75).setDepth(UI.fxDepth);
      this.tweens.add({
        targets: orb,
        y: y - 40 - i * 8,
        alpha: 0,
        duration: 500 + i * 60,
        onComplete: () => orb.destroy(),
      });
    }
  }

  spawnSpeedlines(color) {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    for (let i = 0; i < 14; i += 1) {
      const ang = (Math.PI * 2 * i) / 14;
      const dist = 260 + Math.random() * 120;
      const line = this.add.rectangle(cx + Math.cos(ang) * 120, cy + Math.sin(ang) * 120, 60, 3, color, 0.5)
        .setDepth(UI.fxDepth - 2).setAngle(Phaser.Math.RadToDeg(ang));
      this.tweens.add({
        targets: line,
        x: cx + Math.cos(ang) * dist,
        y: cy + Math.sin(ang) * dist,
        alpha: 0,
        scaleX: 2.4,
        duration: 360,
        onComplete: () => line.destroy(),
      });
    }
  }

  screenPunch() {
    const cam = this.cameras.main;
    cam.zoomTo(1.045, 90, 'Quad.easeOut');
    this.time.delayedCall(110, () => cam.zoomTo(1, 160, 'Quad.easeOut'));
  }

  hitStop(ms) {
    if (this.roundOver || this.matchOver || this._awakenCineActive) return;
    const until = this.time.now + ms;
    this._hitStopUntil = Math.max(this._hitStopUntil ?? 0, until);
    this.physics.pause();
    if (this._hitStopTimer) return;
    this._hitStopTimer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (this._hitStopUntil && this.time.now < this._hitStopUntil) return;
        if (this._hitStopTimer) {
          this._hitStopTimer.remove();
          this._hitStopTimer = null;
        }
        this._hitStopUntil = null;
        this.recoverPhysics(true);
      },
    });
  }

  recoverPhysics(force = false) {
    if (this._awakenCineActive) return;
    if (!force && this._hitStopUntil && this.time.now < this._hitStopUntil) return;
    this._hitStopUntil = null;

    const inSlowMo = this._slowMoUntil && this.time.now < this._slowMoUntil;
    if (!inSlowMo) {
      if (this.physics.world.timeScale !== 1) this.physics.world.timeScale = 1;
      if (this.tweens.timeScale !== 1) this.tweens.timeScale = 1;
    }

    if (this.matchOver) return;
    if (this.physics.world.isPaused) this.physics.resume();
  }

  spawnHitSpark(x, y, color, big) {
    const count = big ? 10 : 6;
    const reach = big ? 46 : 28;

    const ring = this.add.circle(x, y, big ? 14 : 9, 0xffffff, 0)
      .setStrokeStyle(big ? 4 : 2.5, 0xffffff, 0.9).setDepth(UI.fxDepth);
    this.tweens.add({ targets: ring, scale: { from: 0.3, to: big ? 2.6 : 1.9 }, alpha: 0, duration: big ? 320 : 240, onComplete: () => ring.destroy() });

    const star = this.add.star(x, y, big ? 6 : 5, 3, big ? 16 : 10, 0xffffff)
      .setDepth(UI.fxDepth).setAlpha(0.95);
    this.tweens.add({ targets: star, scale: { from: 0.4, to: 1.6 }, alpha: 0, duration: 220, onComplete: () => star.destroy() });

    for (let i = 0; i < count; i += 1) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const p = this.add.rectangle(x, y, big ? 5 : 3, big ? 5 : 3, color).setDepth(UI.fxDepth);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(ang) * reach * (0.6 + Math.random() * 0.6),
        y: y + Math.sin(ang) * reach * (0.6 + Math.random() * 0.6),
        alpha: 0,
        duration: 280 + Math.random() * 120,
        onComplete: () => p.destroy(),
      });
    }
  }

  spawnDust(x, y) {
    for (let i = 0; i < 4; i += 1) {
      const dir = i < 2 ? -1 : 1;
      const puff = this.add.ellipse(x, y, 10, 6, 0xffffff, 0.35).setDepth(UI.fxDepth - 1);
      this.tweens.add({
        targets: puff,
        x: x + dir * (10 + Math.random() * 18),
        y: y - 4 - Math.random() * 6,
        scaleX: 2,
        scaleY: 1.6,
        alpha: 0,
        duration: 300,
        onComplete: () => puff.destroy(),
      });
    }
  }

  /* ---------- round flow ---------- */

  buildIntroPlate(startX, y, config, accent, fromLeft) {
    const con = this.add.container(startX, y).setDepth(UI.overlayDepth + 2);
    const w = 250;
    const h = 76;
    const bg = this.add.rectangle(0, 0, w, h, UI.bgDark, 0.96).setStrokeStyle(2, accent, 1);
    const strip = this.add.rectangle(fromLeft ? -w / 2 + 4 : w / 2 - 4, 0, 5, h - 10, accent, 1);
    const portraitX = fromLeft ? -w / 2 + 46 : w / 2 - 46;
    const portrait = createPortraitImage(this, portraitX, 0, config, 62, 62);
    const textX = fromLeft ? -w / 2 + 84 : w / 2 - 84;
    const originX = fromLeft ? 0 : 1;
    const name = label(this, textX, -10, config.name.toUpperCase(), {
      fontSize: '17px', color: UI.text, originX, fontStyle: 'italic 800', letterSpacing: 1,
    });
    const title = label(this, textX, 14, (config.title ?? '').toUpperCase(), {
      fontSize: '9px', color: UI.textMuted, originX, letterSpacing: 2,
    });
    con.add([bg, strip, portrait, name, title].filter(Boolean));
    return con;
  }

  startRound() {
    this.roundOver = false;
    this.fightStarted = false;
    this.updatePauseButton();
    this.roundTimer = 99;
    this.p1Ghost = 1;
    this.p2Ghost = 1;
    if (this.timerText) {
      this.timerText.setText('99');
      this.timerText.setColor(UI.accentText);
    }
    this.cpu?.reset();
    if (this.physics.world.isPaused) this.physics.resume();

    const midY = GAME_HEIGHT / 2 - 4;
    const p1Plate = this.buildIntroPlate(-280, midY, this.p1Config, this.p1Palette.main, true);
    const p2Plate = this.buildIntroPlate(GAME_WIDTH + 280, midY, this.p2Config, this.p2Palette.main, false);

    const roundTitle = this.campaign?.node?.boss === 'final'
      ? 'BOSS BATTLE'
      : this.campaign?.node?.boss === 'mini'
        ? 'RIVAL SHOWDOWN'
        : `ROUND ${this.currentRound}`;
    const roundLbl = comicTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 78, roundTitle, {
      size: 22, color: UI.goldText, depth: UI.overlayDepth + 3,
    }).setAlpha(0);
    const vs = comicTitle(this, GAME_WIDTH / 2, midY, 'VS', {
      size: 64, color: UI.goldText, depth: UI.overlayDepth + 3,
    }).setScale(0);
    SFX.roundStart();

    this.tweens.add({ targets: p1Plate, x: 250, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: p2Plate, x: GAME_WIDTH - 250, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: roundLbl, alpha: 1, duration: 260, delay: 120 });

    this.time.delayedCall(300, () => {
      this.tweens.add({ targets: vs, scale: { from: 1.8, to: 1 }, duration: 300, ease: 'Back.easeOut' });
      this.cameras.main.flash(120, 255, 255, 255, false);
    });

    if (this.campaign?.node?.intro && this.currentRound === 1) {
      const intro = label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 56, this.campaign.node.intro, {
        fontSize: '10px', color: UI.textMuted, align: 'center', wordWrap: { width: 480 },
        depth: UI.overlayDepth + 4, stroke: '#000', strokeThickness: 3,
      }).setAlpha(0);
      this.tweens.add({ targets: intro, alpha: 1, duration: 400, delay: 500 });
      this.time.delayedCall(2200, () => {
        this.tweens.add({ targets: intro, alpha: 0, duration: 300, onComplete: () => intro.destroy() });
      });
    }

    this.time.delayedCall(1050, () => {
      this.tweens.add({ targets: p1Plate, x: -300, duration: 280, ease: 'Back.easeIn', onComplete: () => p1Plate.destroy() });
      this.tweens.add({ targets: p2Plate, x: GAME_WIDTH + 300, duration: 280, ease: 'Back.easeIn', onComplete: () => p2Plate.destroy() });
      this.tweens.add({ targets: [vs, roundLbl], alpha: 0, duration: 200, onComplete: () => { vs.destroy(); roundLbl.destroy(); } });

      const fight = comicTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 4, 'FIGHT!', {
        size: 56, color: UI.goldText, depth: UI.overlayDepth + 3,
      }).setScale(0);
      SFX.fight();
      this.cameras.main.flash(140, 255, 240, 180, false);
      this.tweens.add({ targets: fight, scale: { from: 1.7, to: 1 }, duration: 260, ease: 'Back.easeOut' });
      this.tweens.add({
        targets: fight, alpha: 0, delay: 520, duration: 300,
        onComplete: () => fight.destroy(),
      });
      this.fightStarted = true;
      this.updatePauseButton();
    });
  }

  resolveRoundEnd(reason) {
    if (this.roundOver || this.matchOver) return;
    this.roundOver = true;

    let roundWinner;
    if (reason === 'time') {
      roundWinner = this.p1.hp > this.p2.hp ? 1 : this.p2.hp > this.p1.hp ? 2 : 0;
    } else {
      roundWinner = this.p1.isDead ? 2 : 1;
    }

    if (roundWinner === 1) this.p1Rounds += 1;
    else if (roundWinner === 2) this.p2Rounds += 1;
    this.updateRoundPips();

    const koCinematic = reason === 'ko';
    if (koCinematic) this.slowMo(650);
    else if (roundWinner !== 0) this.slowMo(280);

    const delay = koCinematic ? 900 : 500;
    this.time.delayedCall(delay, () => {
      const matchWon = this.p1Rounds >= ROUNDS_TO_WIN || this.p2Rounds >= ROUNDS_TO_WIN;
      if (matchWon) {
        this.endMatch(roundWinner);
      } else {
        this.showRoundBanner(roundWinner);
      }
    });
  }

  slowMo(ms) {
    this._slowMoUntil = this.time.now + ms;
    this.physics.world.timeScale = 2.6;
    this.tweens.timeScale = 0.5;
    SFX.ko();
    this.cameras.main.shake(220, 0.01);
    this.cameras.main.flash(160, 255, 255, 255, false);
    this.time.delayedCall(ms, () => {
      this._slowMoUntil = null;
      this.physics.world.timeScale = 1;
      this.tweens.timeScale = 1;
    });
  }

  showRoundBanner(roundWinner) {
    const name = roundWinner === 0 ? 'DRAW'
      : (roundWinner === 1 ? this.p1Config.name : this.p2Config.name).toUpperCase();
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020408, 0.5).setDepth(UI.overlayDepth);
    const txt = comicTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, roundWinner === 0 ? 'DRAW' : `${name} WINS THE ROUND`, {
      size: 26, color: UI.goldText, depth: UI.overlayDepth + 1,
    });
    this.time.delayedCall(1100, () => {
      overlay.destroy();
      txt.destroy();
      this.currentRound += 1;
      this.clearTwiceClones();
      this.hawkFeatherRing?.clear(this.p1);
      this.hawkFeatherRing?.clear(this.p2);
      this.p1.resetForRound();
      this.p2.resetForRound();
      this.startRound();
    });
  }

  /* ---------- HUD ---------- */

  createHud() {
    this.add.rectangle(GAME_WIDTH / 2, 44, GAME_WIDTH, 92, UI.bgDark, 0.72).setDepth(UI.hudDepth - 4);
    this.add.rectangle(GAME_WIDTH / 2, 88, GAME_WIDTH, 3, UI.gold, 0.35).setDepth(UI.hudDepth - 3);

    const portraitSize = 58;
    addAngledPortrait(this, 22, 18, portraitSize, this.p1Config, UI.gold, 'left');
    addAngledPortrait(this, GAME_WIDTH - 22, 18, portraitSize, this.p2Config, UI.gold, 'right');

    this.p1Name = label(this, 96, 18, this.p1Config.name.toUpperCase(), {
      fontSize: '14px', color: UI.text, originX: 0, fontFamily: UI.font, fontStyle: 'italic', letterSpacing: 1,
    }).setDepth(UI.hudDepth);
    const p2Suffix = this.isCpu ? '  [CPU]' : '';
    this.p2Name = label(this, GAME_WIDTH - 96, 18, this.p2Config.name.toUpperCase() + p2Suffix, {
      fontSize: '14px', color: UI.text, originX: 1, fontFamily: UI.font, fontStyle: 'italic', letterSpacing: 1,
    }).setDepth(UI.hudDepth);

    // ghost bars sit behind and drain slowly to show recently-lost "chip" damage
    this.p1HpGhost = createAngledMeter(this, 96, 34, 330, 16, { align: 'left', fill: 0xffd0d0, border: UI.gold, depth: UI.hudDepth - 1 });
    this.p2HpGhost = createAngledMeter(this, GAME_WIDTH - 96, 34, 330, 16, { align: 'right', fill: 0xffd0d0, border: UI.gold, depth: UI.hudDepth - 1 });
    this.p1HpBar = createAngledMeter(this, 96, 34, 330, 16, { align: 'left', fill: this.p1Palette.main, border: UI.gold, noTrack: true });
    this.p2HpBar = createAngledMeter(this, GAME_WIDTH - 96, 34, 330, 16, { align: 'right', fill: this.p2Palette.main, border: UI.gold, noTrack: true });
    this.p1Ghost = 1;
    this.p2Ghost = 1;
    this.p1PowerBar = createAngledMeter(this, 96, 54, 240, 7, { align: 'left', fill: this.p1Palette.soft, border: this.p1Palette.soft });
    this.p2PowerBar = createAngledMeter(this, GAME_WIDTH - 96, 54, 240, 7, { align: 'right', fill: this.p2Palette.soft, border: this.p2Palette.soft });

    this.p1PowerLabel = label(this, 96, 66, 'QUIRK OUTPUT', { fontSize: '8px', color: UI.textDim, letterSpacing: 1, originX: 0 }).setDepth(UI.hudDepth);
    this.p2PowerLabel = label(this, GAME_WIDTH - 96, 66, 'QUIRK OUTPUT', { fontSize: '8px', color: UI.textDim, letterSpacing: 1, originX: 1 }).setDepth(UI.hudDepth);

    this.p1HeatBar = null;
    this.p2HeatBar = null;
    if (this.p1Config.id === 'endeavor') {
      this.p1HeatBar = createAngledMeter(this, 96, 76, 240, 5, { align: 'left', fill: 0xff6600, border: 0xaa3300 });
      label(this, 96, 86, 'HEAT', { fontSize: '7px', color: UI.textDim, letterSpacing: 1, originX: 0 }).setDepth(UI.hudDepth);
    }
    if (this.p2Config.id === 'endeavor') {
      this.p2HeatBar = createAngledMeter(this, GAME_WIDTH - 96, 76, 240, 5, { align: 'right', fill: 0xff6600, border: 0xaa3300 });
      label(this, GAME_WIDTH - 96, 86, 'HEAT', { fontSize: '7px', color: UI.textDim, letterSpacing: 1, originX: 1 }).setDepth(UI.hudDepth);
    }

    this.timerText = comicTitle(this, GAME_WIDTH / 2, 40, '99', { size: 30, color: UI.accentText, depth: UI.hudDepth });

    this.createRoundPips();
  }

  createRoundPips() {
    this.p1Pips = [];
    this.p2Pips = [];
    for (let i = 0; i < ROUNDS_TO_WIN; i += 1) {
      const left = this.add.star(GAME_WIDTH / 2 - 40 - i * 20, 40, 5, 4, 9, UI.bgDark)
        .setStrokeStyle(1.5, UI.gold, 0.9).setDepth(UI.hudDepth);
      const right = this.add.star(GAME_WIDTH / 2 + 40 + i * 20, 40, 5, 4, 9, UI.bgDark)
        .setStrokeStyle(1.5, UI.gold, 0.9).setDepth(UI.hudDepth);
      this.p1Pips.push(left);
      this.p2Pips.push(right);
    }
  }

  updateRoundPips() {
    this.p1Pips.forEach((pip, i) => {
      const won = i < this.p1Rounds;
      pip.setFillStyle(won ? UI.gold : UI.bgDark);
      if (won && i === this.p1Rounds - 1) {
        this.tweens.add({ targets: pip, scale: 1.45, duration: 180, yoyo: true, ease: 'Back.easeOut' });
      }
    });
    this.p2Pips.forEach((pip, i) => {
      const won = i < this.p2Rounds;
      pip.setFillStyle(won ? UI.gold : UI.bgDark);
      if (won && i === this.p2Rounds - 1) {
        this.tweens.add({ targets: pip, scale: 1.45, duration: 180, yoyo: true, ease: 'Back.easeOut' });
      }
    });
  }

  createControlsHelp() {
    drawGlassPanel(this, GAME_WIDTH / 2, GAME_HEIGHT - 22, GAME_WIDTH - 24, 40, { depth: UI.hudDepth - 1, fillAlpha: 0.5 });
    label(this, GAME_WIDTH / 2, GAME_HEIGHT - 34, 'MOUSE move · LMB jab · RMB heavy · SPACE jump · S super · E uppercut · Q dash · SHIFT block', {
      fontSize: '8px', color: UI.textMuted, letterSpacing: 0.5,
    }).setDepth(UI.hudDepth);
    const p2Line = this.isOnlineGuest
      ? 'YOU ARE P2 · arrows move · K/L/I/O/; attacks · DOWN block'
      : this.isOnlineHost
        ? 'HOST · mouse controls P1 · friend controls P2'
        : this.isCpu
          ? 'Click PAUSE (top right) anytime'
          : 'P2 · arrows move · K/L/I/O/; attacks · DOWN block';
    label(this, GAME_WIDTH / 2, GAME_HEIGHT - 18, p2Line, { fontSize: '8px', color: UI.textDim, letterSpacing: 0.5 }).setDepth(UI.hudDepth);
  }

  onPeerDisconnected() {
    if (this.matchOver) return;
    this.matchOver = true;
    label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 'OPPONENT DISCONNECTED', {
      fontSize: '22px', color: UI.warn, depth: UI.overlayDepth + 5,
    });
    this.time.delayedCall(1800, () => {
      leaveOnlineRoom();
      transitionTo(this, 'MenuScene', {}, 120);
    });
  }

  getP1Controls() {
    if (!this.p1Input) {
      return { moveTargetX: null, left: false, right: false, jump: false, light: false, heavy: false, special: false, launcher: false, aerial: false, dash: false, block: false };
    }
    const c = this.p1Input.poll();
    this.p1Input.consumeFrame();
    return c;
  }

  getP2Controls() {
    if (this.isCpu) {
      return this.cpu.update(this.time.now, this.p2, this.p1);
    }
    const c = this.p2Input.poll();
    this.p2Input.consumeFrame();
    return c;
  }

  showTogaTransformEffect(fighter, payload) {
    if (!fighter?.body) return;
    const x = fighter.body.x;
    const y = fighter.body.y - 72;
    const asName = payload?.asName ?? 'RIVAL';

    this.cameras.main.flash(140, 255, 120, 180, false);
    const splash = this.add.circle(x, y, 24, 0xff6b9d, 0.55).setDepth(UI.fxDepth);
    this.tweens.add({
      targets: splash,
      scale: 4.5,
      alpha: 0,
      duration: 520,
      onComplete: () => splash.destroy(),
    });

    const tag = comicTitle(this, x, y - 48, `TRANSFORM → ${asName.split(' ').pop().toUpperCase()}`, {
      size: 20,
      color: '#ff6b9d',
      depth: UI.fxDepth + 2,
    });
    this.tweens.add({
      targets: tag,
      y: y - 72,
      alpha: 0,
      duration: 900,
      onComplete: () => tag.destroy(),
    });

    this.updateTogaHudName(fighter);
  }

  updateTogaHudName(fighter) {
    const isP1 = fighter === this.p1;
    const baseName = (isP1 ? this.p1Config : this.p2Config).name.toUpperCase();
    const labelRef = isP1 ? this.p1Name : this.p2Name;
    if (!labelRef) return;

    if (fighter.togaDisguiseActive) {
      labelRef.setText(`${baseName} → ${fighter.config.name.toUpperCase()}`);
    } else if (fighter.identityConfig?.id === 'toga') {
      labelRef.setText(baseName);
    }
  }

  addHawkFeather(defender) {
    if (!defender || defender.isDead) return;
    const hawks = this.p1.config.id === 'hawks' ? this.p1 : this.p2.config.id === 'hawks' ? this.p2 : null;
    if (!hawks) return;
    this.hawkFeatherRing?.addFeather(defender, getHawkFeatherMax(hawks.config));
  }

  resolveHawksFeatherBurst(attacker, defender) {
    if (!attacker || !defender || attacker.config.id !== 'hawks') return;

    const count = defender.hawkFeatherCount ?? 0;
    const damage = calcHawksBurstDamage(attacker.config, count);

    const cx = defender.body.x;
    const cy = defender.body.y - 72;
    this.cameras.main.flash(120, 255, 120, 80, false);
    this.cameras.main.shake(140, 0.008);

    const tag = comicTitle(this, cx, cy - 50, count > 0 ? `WING BEAT ×${count}` : 'WING BEAT', {
      size: count >= 8 ? 28 : 22,
      color: '#e74c3c',
      depth: UI.fxDepth + 2,
    });
    this.tweens.add({
      targets: tag,
      y: cy - 78,
      alpha: 0,
      duration: 700,
      onComplete: () => tag.destroy(),
    });

    this.hawkFeatherRing?.burst(defender, () => {
      if (damage > 0 && !defender.isDead) {
        defender.takeDamage(damage, attacker);
        this.showDamageNumber(cx, cy - 30, damage, true);
      }
    });
  }

  resolveHit(attacker, defender) {
    if (!this.fightStarted || this.roundOver || this.matchOver) return;
    if (!attacker.isAttacking || !attacker.currentAttack || attacker.currentAttack.hit) return;

    const damage = attacker.getAttackDamage();
    if (damage <= 0) return;

    attacker.markAttackHit();
    try {
      defender.takeDamage(damage, attacker);
      if (this._bossMods?.powerSteal && defender === this.p1 && attacker === this.p2) {
        const steal = this._bossMods.powerSteal;
        this.p1.power = Math.max(0, this.p1.power - steal);
        this.p2.power = Math.min(this.p2.maxPower, this.p2.power + steal);
      }
      if (this._bossMods?.decayChip && defender === this.p1 && attacker === this.p2) {
        defender.takeDamage(this._bossMods.decayChip, attacker);
      }
    } catch (err) {
      console.error('[resolveHit]', err);
    }
  }

  getTwiceClones(owner) {
    if (owner === this.p1) return this.p1Clones ?? [];
    if (owner === this.p2) return this.p2Clones ?? [];
    return [];
  }

  spawnTwiceClone(owner) {
    if (owner.config.id !== 'twice' || owner.isDead) return;
    const clones = this.getTwiceClones(owner);
    const max = owner.config.cloneMax ?? 5;
    if (clones.length >= max) return;

    const opponent = owner.opponent;
    if (!opponent) return;

    const clone = new TwiceClone(this, owner, opponent, clones.length);
    clones.push(clone);
    this.registerCloneCollisions(clone);
  }

  registerCloneCollisions(clone) {
    const opponent = clone.opponent;
    const owner = clone.owner;

    this.physics.add.overlap(clone.hitbox, opponent.body, () => {
      if (!this.fightStarted || this.roundOver || this.matchOver) return;
      if (!clone.isAttacking || !clone.currentAttack || clone.currentAttack.hit) return;
      if (opponent.isDead) return;
      const damage = clone.getAttackDamage();
      if (damage <= 0) return;
      const dealt = opponent.takeDamage(damage, owner);
      if (dealt > 0) clone.markAttackHit();
    });

    this.physics.add.overlap(opponent.hitbox, clone.body, () => {
      if (!this.fightStarted || this.roundOver || this.matchOver) return;
      if (!opponent.isAttacking || !opponent.currentAttack || opponent.currentAttack.hit) return;
      if (clone.dead) return;
      const damage = opponent.getAttackDamage();
      if (damage <= 0) return;
      const dealt = clone.takeDamage(damage, opponent);
      if (dealt > 0) opponent.markAttackHit();
    });
  }

  updateTwiceClones(time, canAct) {
    for (const clone of [...(this.p1Clones ?? []), ...(this.p2Clones ?? [])]) {
      clone.update(time, canAct);
    }
    this.p1Clones = (this.p1Clones ?? []).filter((c) => !c.dead);
    this.p2Clones = (this.p2Clones ?? []).filter((c) => !c.dead);
  }

  clearTwiceClones() {
    for (const clone of [...(this.p1Clones ?? []), ...(this.p2Clones ?? [])]) {
      clone.destroy();
    }
    this.p1Clones = [];
    this.p2Clones = [];
  }

  clearTwiceClonesFor(owner) {
    const list = this.getTwiceClones(owner);
    for (const clone of list) clone.destroy();
    if (owner === this.p1) this.p1Clones = [];
    else if (owner === this.p2) this.p2Clones = [];
  }

  showDamageNumber(x, y, damage, isSpecial = false) {
    const text = label(this, x, y, `−${damage}`, {
      fontSize: isSpecial ? '22px' : '17px',
      color: isSpecial ? UI.gold : '#ff6b6b',
      fontStyle: '600',
    }).setDepth(UI.fxDepth);
    this.tweens.add({ targets: text, y: y - 36, alpha: 0, duration: 550, onComplete: () => text.destroy() });
  }

  showComboText(x, y, hits) {
    const text = label(this, x, y, `${hits}× COMBO`, {
      fontSize: '14px', color: UI.gold, letterSpacing: 2, fontStyle: '600',
    }).setDepth(UI.fxDepth);
    this.tweens.add({ targets: text, y: y - 28, alpha: 0, duration: 700, onComplete: () => text.destroy() });
  }

  updateHud() {
    const t1 = this.p1.hp / this.p1.maxHp;
    const t2 = this.p2.hp / this.p2.maxHp;
    this.p1Ghost = this.p1Ghost > t1 ? Math.max(t1, this.p1Ghost - 0.013) : t1;
    this.p2Ghost = this.p2Ghost > t2 ? Math.max(t2, this.p2Ghost - 0.013) : t2;
    setAngledMeter(this.p1HpGhost, this.p1Ghost);
    setAngledMeter(this.p2HpGhost, this.p2Ghost);
    setAngledMeter(this.p1HpBar, t1, UI.warn, this.p1Palette.main);
    setAngledMeter(this.p2HpBar, t2, UI.warn, this.p2Palette.main);

    const p1Ready = this.p1.isSpecialReady();
    const p2Ready = this.p2.isSpecialReady();

    if (p1Ready && !this._p1SuperReady) {
      this._p1SuperReady = true;
      this.p1PowerLabel.setColor(UI.goldText);
      this.cameras.main.flash(80, 255, 220, 80, false);
    } else if (!p1Ready) {
      this._p1SuperReady = false;
    }
    if (p2Ready && !this._p2SuperReady) {
      this._p2SuperReady = true;
    } else if (!p2Ready) {
      this._p2SuperReady = false;
    }

    this.p1PowerBar.fill = p1Ready ? UI.gold : this.p1Palette.soft;
    this.p1PowerBar.border = p1Ready ? UI.gold : this.p1Palette.soft;
    this.p2PowerBar.fill = p2Ready ? UI.gold : this.p2Palette.soft;
    this.p2PowerBar.border = p2Ready ? UI.gold : this.p2Palette.soft;
    setAngledMeter(this.p1PowerBar, this.p1.power / this.p1.maxPower);
    setAngledMeter(this.p2PowerBar, this.p2.power / this.p2.maxPower);
    if (!p1Ready) this.p1PowerLabel.setColor(UI.textDim);
    if (!p2Ready) this.p2PowerLabel.setColor(UI.textDim);

    if (this.p1HeatBar && this.p1.config.id === 'endeavor') {
      const max = this.p1.getHeatMax();
      const ratio = max > 0 ? this.p1.heat / max : 0;
      const atMax = this.p1.heat >= max;
      this.p1HeatBar.fill = atMax ? 0xff2222 : 0xff6600;
      this.p1HeatBar.border = atMax ? 0xff4444 : 0xaa3300;
      setAngledMeter(this.p1HeatBar, ratio);
    }
    if (this.p2HeatBar && this.p2.config.id === 'endeavor') {
      const max = this.p2.getHeatMax();
      const ratio = max > 0 ? this.p2.heat / max : 0;
      const atMax = this.p2.heat >= max;
      this.p2HeatBar.fill = atMax ? 0xff2222 : 0xff6600;
      this.p2HeatBar.border = atMax ? 0xff4444 : 0xaa3300;
      setAngledMeter(this.p2HeatBar, ratio);
    }
  }

  endMatch(roundWinner) {
    this.matchOver = true;
    this._slowMoUntil = null;
    this.physics.world.timeScale = 1;
    this.tweens.timeScale = 1;
    this.physics.pause();
    this.updatePauseButton();

    const playerWon = roundWinner === 1;
    if (this.campaign) {
      if (playerWon) {
        this.handleCampaignVictory();
      } else {
        this.showCampaignGameOver();
      }
      return;
    }
    if (this.arcade) {
      if (playerWon) {
        const next = (this.arcade.stageIndex ?? 0) + 1;
        if (next >= this.arcade.ladder.length) {
          this.showArcadeComplete(roundWinner);
        } else {
          this.showStageClear(roundWinner, next);
        }
      } else {
        this.showArcadeGameOver();
      }
      return;
    }

    this.showStandardVictory(roundWinner);
  }

  showStandardVictory(roundWinner) {
    const winnerConfig = roundWinner === 1 ? this.p1Config : this.p2Config;
    const winnerName = winnerConfig.name;
    const quote = getWinQuote(winnerConfig.id);
    SFX.win();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020408, 0.74).setDepth(UI.overlayDepth);
    drawGlassPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10, 500, 200, { depth: UI.overlayDepth + 1, accent: UI.accent });

    label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 68, 'WINNER', { fontSize: '11px', color: UI.textMuted, letterSpacing: 6 }).setDepth(UI.overlayDepth + 2);
    comicTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, winnerName.toUpperCase(), { size: 30, color: UI.goldText, depth: UI.overlayDepth + 2 });
    label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 8, `"${quote}"`, {
      fontSize: '11px', color: UI.textMuted, align: 'center', wordWrap: { width: 420 },
    }).setDepth(UI.overlayDepth + 2);

    createButtonRow(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 62, [
      { label: 'REMATCH', onClick: () => this.restartMatch() },
      { label: 'CHANGE', onClick: () => transitionTo(this, 'CharacterSelectScene', {}, 120) },
      { label: 'MENU', onClick: () => { stopGameMusic(); transitionTo(this, 'MenuScene', {}, 120); } },
    ]);
  }

  restartMatch() {
    this.scene.restart({
      p1: this.p1Config.id,
      p2: this.p2Config.id,
      mode: this.mode,
      difficulty: this.difficulty,
      playerSide: this.playerSide,
      stageId: this.stageId,
      campaign: this.campaign,
    });
  }

  showStageClear(roundWinner, nextStage) {
    const oppName = getCharacterById(this.arcade.ladder[nextStage])?.name ?? 'Next foe';
    SFX.win();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020408, 0.72).setDepth(UI.overlayDepth);
    comicTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'STAGE CLEAR!', { size: 36, color: UI.goldText, depth: UI.overlayDepth + 1 });
    label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 4, `Next: ${oppName}`, { fontSize: '14px', color: UI.text }).setDepth(UI.overlayDepth + 2);

    createButtonRow(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 44, [
      {
        label: 'CONTINUE',
        onClick: () => {
          transitionTo(this, 'StageSelectScene', {
            p1: this.p1Config.id,
            p2: this.arcade.ladder[nextStage],
            mode: this.mode,
            difficulty: this.difficulty,
            playerSide: this.playerSide,
            arcade: { ladder: this.arcade.ladder, stageIndex: nextStage },
          }, 120);
        },
      },
    ]);
  }

  handleCampaignVictory() {
    const node = this.campaign.node;
    const side = this.campaign.side;
    const stageIndex = this.campaign.stageIndex ?? 0;
    const wasNew = unlockCharacter(node.unlock);
    if (node.unlockStage) unlockStage(node.unlockStage);

    const next = stageIndex + 1;
    const complete = next >= (this.campaign.totalStages ?? this.campaign.ladder?.length ?? 7);
    setCampaignProgress(side, complete ? next : next, complete);

    if (complete) {
      this.showCampaignComplete(wasNew, node);
    } else {
      this.showCampaignStageClear(wasNew, node, next);
    }
  }

  showCampaignStageClear(wasNew, node, nextStage) {
    const unlocked = getCharacterById(node.unlock);
    SFX.win();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020408, 0.74).setDepth(UI.overlayDepth);
    comicTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 52, 'STAGE CLEAR!', { size: 34, color: UI.goldText, depth: UI.overlayDepth + 1 });

    if (wasNew && unlocked) {
      comicTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 8, 'UNLOCKED!', { size: 20, color: UI.accentText, depth: UI.overlayDepth + 2 });
      label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 18, unlocked.name.toUpperCase(), {
        fontSize: '14px', color: UI.goldText, depth: UI.overlayDepth + 2,
      });
    } else {
      label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 8, 'Rival defeated!', { fontSize: '12px', color: UI.text }).setDepth(UI.overlayDepth + 2);
    }

    createButtonRow(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 58, [
      {
        label: 'CONTINUE',
        onClick: () => {
          transitionTo(this, 'CampaignScene', {
            playerSide: this.campaign.side,
            difficulty: this.difficulty,
          }, 120);
        },
      },
    ]);
  }

  showCampaignComplete(wasNew, node) {
    const progress = loadProgress();
    SFX.win();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020408, 0.8).setDepth(UI.overlayDepth);
    comicTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'CAMPAIGN COMPLETE!', { size: 32, color: UI.goldText, depth: UI.overlayDepth + 1 });
    label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 18, 'Plus Ultra! You conquered the path.', {
      fontSize: '12px', color: UI.text, depth: UI.overlayDepth + 2,
    });

    if (progress.secretUnlocked) {
      comicTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 16, 'PLUS ULTRA UNLOCKED', {
        size: 18, color: UI.accentText, depth: UI.overlayDepth + 2,
      });
      label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 42, 'All heroes & villains are now playable!', {
        fontSize: '10px', color: UI.textMuted, depth: UI.overlayDepth + 2,
      });
    } else {
      const other = this.campaign.side === 'hero' ? 'VILLAIN' : 'HERO';
      label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 24, `Complete the ${other} path to unlock everyone!`, {
        fontSize: '10px', color: UI.textMuted, depth: UI.overlayDepth + 2,
      });
    }

    createButtonRow(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 78, [
      {
        label: 'CAMPAIGN MAP',
        onClick: () => {
          transitionTo(this, 'CampaignScene', {
            playerSide: this.campaign.side,
            difficulty: this.difficulty,
          }, 120);
        },
      },
      {
        label: 'MAIN MENU',
        onClick: () => transitionTo(this, 'MenuScene', {}, 120),
      },
    ]);
  }

  showCampaignGameOver() {
    SFX.ko();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020408, 0.78).setDepth(UI.overlayDepth);
    comicTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, 'DEFEATED', { size: 36, color: '#ff6b6b', depth: UI.overlayDepth + 1 });
    label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 6, this.campaign?.node?.intro ?? 'Train harder and try again.', {
      fontSize: '10px', color: UI.textMuted, align: 'center', wordWrap: { width: 420 }, depth: UI.overlayDepth + 2,
    });

    createButtonRow(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 52, [
      {
        label: 'RETRY',
        onClick: () => {
          transitionTo(this, 'CharacterSelectScene', {
            mode: 'campaign',
            playerSide: this.campaign.side,
            campaignRun: this.campaign,
          }, 120);
        },
      },
      {
        label: 'MAP',
        onClick: () => {
          transitionTo(this, 'CampaignScene', {
            playerSide: this.campaign.side,
            difficulty: this.difficulty,
          }, 120);
        },
      },
      {
        label: 'MENU',
        onClick: () => transitionTo(this, 'MenuScene', {}, 120),
      },
    ]);
  }

  showArcadeComplete(roundWinner) {
    SFX.win();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020408, 0.78).setDepth(UI.overlayDepth);
    comicTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, 'ARCADE COMPLETE!', { size: 34, color: UI.goldText, depth: UI.overlayDepth + 1 });
    label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Plus Ultra! You cleared the ladder.', { fontSize: '13px', color: UI.text }).setDepth(UI.overlayDepth + 2);

    createButtonRow(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 44, [
      { label: 'MAIN MENU', onClick: () => transitionTo(this, 'MenuScene', {}, 120) },
    ]);
  }

  showArcadeGameOver() {
    SFX.ko();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020408, 0.78).setDepth(UI.overlayDepth);
    comicTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 'DEFEATED', { size: 36, color: '#ff6b6b', depth: UI.overlayDepth + 1 });

    createButtonRow(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 36, [
      { label: 'RETRY', onClick: () => transitionTo(this, 'CharacterSelectScene', {}, 120) },
      { label: 'MENU', onClick: () => transitionTo(this, 'MenuScene', {}, 120) },
    ]);
  }

  togglePause() {
    if (this.matchOver || !this.fightStarted || this.roundOver) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.physics.pause();
      this.showPauseMenu();
    } else {
      this.hidePauseMenu();
      this.recoverPhysics(true);
    }
    this.updatePauseButton();
  }

  showPauseMenu() {
    if (this.pauseOverlay) return;
    this.pauseOverlay = this.add.container(0, 0).setDepth(UI.overlayDepth + 10);
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const dim = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x020408, 0.65);
    const panel = drawGlassPanel(this, cx, cy, 340, 220, { depth: 0, accent: UI.gold });
    const title = this.add.text(cx, cy - 72, 'PAUSED', {
      fontFamily: UI.font, fontSize: '28px', color: UI.goldText, fontStyle: 'italic',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5);
    this.pauseOverlay.add([dim, panel, title]);

    const resume = createClickButton(this, cx, cy - 20, 'RESUME', () => {
      this.togglePause();
    }, { width: 160, height: 38, depth: UI.overlayDepth + 12 });
    const rematch = createClickButton(this, cx, cy + 22, 'REMATCH', () => {
      this.hidePauseMenu();
      this.restartMatch();
    }, { width: 160, height: 38, depth: UI.overlayDepth + 12, sfx: 'move' });
    const change = createClickButton(this, cx, cy + 64, 'CHANGE FIGHTER', () => {
      this.hidePauseMenu();
      transitionTo(this, 'CharacterSelectScene', {}, 120);
    }, { width: 160, height: 38, depth: UI.overlayDepth + 12, sfx: 'move' });
    const quit = createClickButton(this, cx, cy + 106, 'QUIT TO MENU', () => {
      this.hidePauseMenu();
      stopGameMusic();
      transitionTo(this, 'MenuScene', {}, 120);
    }, { width: 160, height: 38, depth: UI.overlayDepth + 12, sfx: 'move' });

    this.pauseOverlay.add([
      resume.container, rematch.container, change.container, quit.container,
    ]);
  }

  hidePauseMenu() {
    this.pauseOverlay?.destroy();
    this.pauseOverlay = null;
    this.paused = false;
    this.updatePauseButton();
  }

  update(time) {
    if (this.matchOver || this.paused) return;

    if (this.isOnlineGuest) {
      const canAct = this.fightStarted && !this.roundOver;
      if (canAct) {
        const c = this.p2Input.poll();
        sendOnline('input', { controls: c });
        this.p2Input.consumeFrame();
      }
      this.updateHud();
      return;
    }

    this.recoverPhysics();

    const canAct = this.fightStarted && !this.roundOver;
    const p1Controls = canAct ? this.getP1Controls() : { moveTargetX: null, block: false };
    const p2Controls = canAct
      ? this.getP2Controls()
      : { moveTargetX: null, left: false, right: false, jump: false, light: false, heavy: false, special: false, launcher: false, aerial: false, dash: false, block: false };

    if (canAct && p1Controls.moveTargetX != null && !this.isOnlineGuest) {
      this.updateMoveCursor(p1Controls.moveTargetX);
    } else {
      this.updateMoveCursor(null);
    }

    this.p1.update(time, p1Controls, canAct);
    this.p2.update(time, p2Controls, canAct);
    this.updateTwiceClones(time, canAct);
    this.hawkFeatherRing?.update();

    if (canAct) {
      if (this.p1.isDead) this.clearTwiceClonesFor(this.p1);
      if (this.p2.isDead) this.clearTwiceClonesFor(this.p2);
    }

    this.updateHud();

    if (canAct && (this.p1.isDead || this.p2.isDead)) {
      this.resolveRoundEnd('ko');
    }

    if (this.isOnlineHost) {
      this._stateSendAccum += this.game.loop.delta;
      if (this._stateSendAccum >= 50) {
        this._stateSendAccum = 0;
        sendOnline('state', { state: serializeBattleState(this) });
      }
    }
  }

  shutdown() {
    this.hidePauseMenu();
    this.events.off('fighter-hit');
    this.events.off('fighter-land');
    this.events.off('fighter-special');
    this.events.off('fighter-awaken');
    this.events.off('fighter-toga-transform');
    this.events.off('fighter-toga-revert');
    this.events.off('fighter-bloodcurdle');
    this.events.off('fighter-todoroki-freeze');
    this.events.off('fighter-todoroki-burn');
    this.events.off('fighter-zero-gravity');
    this.events.off('fighter-zero-gravity-drop');
    this.events.off('fighter-endeavor-overheat');
    cleanupAwakenCinematic(this);
    if (this._onVisibility) {
      document.removeEventListener('visibilitychange', this._onVisibility);
      this._onVisibility = null;
    }
    if (this._hitStopTimer) {
      this._hitStopTimer.remove();
      this._hitStopTimer = null;
    }
    this._hitStopUntil = null;
    this._slowMoUntil = null;
    this.p1Input?.destroy?.();
    this.p2Input?.destroy?.();
    this.p1Input = null;
    this.p2Input = null;
    for (const off of this._onlineUnsubs ?? []) off();
    this._onlineUnsubs = null;
    this.cpu = null;
    this.clearTwiceClones();
    this.hawkFeatherRing?.destroy();
    this.hawkFeatherRing = null;
    this.p1?.destroy();
    this.p2?.destroy();
    this.p1 = this.p2 = null;
    this.physics.resume();
    this.cameras.main.setAlpha(1);
    this.cameras.main.setZoom(1);
    if (this.timerEvent) this.timerEvent.destroy();
    this.physics.world.timeScale = 1;
    this.tweens.timeScale = 1;
    resetSceneTransition(this);
    ensureSceneVisible(this);
  }
}
