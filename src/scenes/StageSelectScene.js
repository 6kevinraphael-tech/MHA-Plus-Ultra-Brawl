import Phaser from 'phaser';
import { getCharacterById, GAME_WIDTH, GAME_HEIGHT, GROUND_Y } from '../data/characters.js';
import { ARENAS, getArenaById } from '../data/backgrounds.js';
import { createSelectStandee } from '../utils/spriteFrames.js';
import {
  comicTitle,
  factionPalette,
  holographicVsBadge,
  label,
  rgba,
  UI,
} from '../utils/uiTheme.js';
import { SFX, ensureGameMusic } from '../utils/audio.js';
import { resetSceneTransition, safeSceneStart, ensureSceneVisible } from '../utils/sceneTransition.js';
import { playStageMusic } from '../utils/youtubeMusic.js';
import { createClickButton } from '../utils/uiButtons.js';
import { bindClickToFocus, bindConfirmKeys, focusGameCanvas } from '../utils/gameInput.js';
import {
  isOnlineHost,
  onOnlineEvent,
  sendOnline,
  leaveOnlineRoom,
} from '../utils/onlineSession.js';

const STANDEE_H = 260;

export class StageSelectScene extends Phaser.Scene {
  constructor() {
    super('StageSelectScene');
  }

  init(data) {
    this.p1Id = data.p1;
    this.p2Id = data.p2;
    this.mode = data.mode ?? '2p';
    this.onlineRole = data.onlineRole ?? null;
    this.isOnline = this.mode === 'online';
    this.difficulty = data.difficulty ?? 'normal';
    this.playerSide = data.playerSide ?? 'hero';
    this.arcade = data.arcade ?? null;
    this.stageIndex = 0;
    this.p1Config = getCharacterById(this.p1Id);
    this.p2Config = getCharacterById(this.p2Id);
  }

  create() {
    resetSceneTransition(this);
    ensureSceneVisible(this);
    this.cameras.main.setAlpha(1);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x06080f).setDepth(-10);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setDepth(-9);

    comicTitle(this, GAME_WIDTH / 2, 42, 'VS', { size: 48, color: UI.goldText, depth: 5 });
    if (this.arcade) {
      label(this, GAME_WIDTH / 2, 72, `ARCADE STAGE ${(this.arcade.stageIndex ?? 0) + 1} / ${this.arcade.ladder.length}`, {
        fontSize: '11px', color: UI.textMuted, letterSpacing: 3, depth: 5,
      });
    }

    const cy = GROUND_Y - 30;
    this.p1Standee = createSelectStandee(this, 200, cy, this.p1Config, false, STANDEE_H);
    this.p2Standee = createSelectStandee(this, GAME_WIDTH - 200, cy, this.p2Config, true, STANDEE_H);
    if (this.p1Standee) this.p1Standee.setDepth(4);
    if (this.p2Standee) this.p2Standee.setDepth(4);

    this.vsBadge = holographicVsBadge(this, GAME_WIDTH / 2, cy - 40);

    const p1Pal = factionPalette(this.p1Config?.faction ?? 'hero');
    const p2Pal = factionPalette(this.p2Config?.faction ?? 'villain');
    label(this, 200, cy + 100, this.p1Config?.name?.toUpperCase() ?? '', {
      fontSize: '16px', color: rgba(p1Pal.main), fontStyle: 'italic', depth: 8,
    });
    label(this, GAME_WIDTH - 200, cy + 100, this.p2Config?.name?.toUpperCase() ?? '', {
      fontSize: '16px', color: rgba(p2Pal.main), fontStyle: 'italic', depth: 8,
    });

    this.buildStagePicker();

    createClickButton(this, 70, GAME_HEIGHT - 36, '◀ STAGE', () => this.pickStage(-1), {
      width: 90, height: 34, depth: 14, sfx: 'move',
    });
    createClickButton(this, GAME_WIDTH - 70, GAME_HEIGHT - 36, 'STAGE ▶', () => this.pickStage(1), {
      width: 90, height: 34, depth: 14, sfx: 'move',
    });

    createClickButton(this, GAME_WIDTH / 2 - 90, GAME_HEIGHT - 36, 'BACK', () => {
      safeSceneStart(this, 'CharacterSelectScene', {}, { fadeMs: 200 });
    }, { width: 90, height: 40, depth: 14, sfx: 'move' });

    createClickButton(this, GAME_WIDTH / 2 + 90, GAME_HEIGHT - 36, 'FIGHT!', () => this.launch(), {
      width: 120, height: 40, depth: 14,
    });

    label(this, GAME_WIDTH / 2, GAME_HEIGHT - 12, this.isOnline && !isOnlineHost()
      ? 'Waiting for host to pick a stage…'
      : 'Click a stage · ENTER or FIGHT! when ready', {
      fontSize: '9px', color: UI.textDim, depth: 10,
    });

    if (this.isOnline && !isOnlineHost()) {
      this._onlineUnsubs = [
        onOnlineEvent('peer_left', () => {
          leaveOnlineRoom();
          safeSceneStart(this, 'MenuScene', {}, { fadeMs: 200 });
        }),
      ];
    } else {
      this._onlineUnsubs = [];
    }

    ensureGameMusic();
    focusGameCanvas(this.game);
    this._unbindFocus = bindClickToFocus(this);
    this._unbindConfirm = bindConfirmKeys(this, () => this.launch());
    const arena = getArenaById(this.registry.get('stageId') ?? ARENAS[0].id);
    playStageMusic(arena.musicTag);

    this.cameras.main.fadeIn(280);
  }

  buildStagePicker() {
    label(this, GAME_WIDTH / 2, 368, 'SELECT STAGE', {
      fontSize: '10px', color: UI.textMuted, letterSpacing: 4, depth: 8,
    });

    const saved = this.registry.get('stageId');
    this.stageIndex = Math.max(0, ARENAS.findIndex((a) => a.id === saved));
    if (this.stageIndex < 0) this.stageIndex = 0;

    this.stageCards = [];
    const startX = GAME_WIDTH / 2 - (ARENAS.length * 130) / 2 + 65;

    ARENAS.forEach((arena, i) => {
      const x = startX + i * 130;
      const card = this.add.container(x, 418).setDepth(12);
      const bg = this.add.rectangle(0, 0, 118, 72, 0x0c0a12, 0.92).setStrokeStyle(2, 0xffffff, 0.35);
      bg.setInteractive({ useHandCursor: true });
      if (this.textures.exists(arena.imageKey)) {
        const thumb = this.add.image(0, -4, arena.imageKey).setDisplaySize(110, 52);
        thumb.setAlpha(0.85);
        card.add(thumb);
      }
      const name = this.add.text(0, 30, arena.name, {
        fontFamily: UI.font, fontSize: '8px', color: UI.textMuted, align: 'center', wordWrap: { width: 108 },
      }).setOrigin(0.5);
      card.add([bg, name]);
      bg.on('pointerdown', () => {
        this.stageIndex = i;
        SFX.uiMove();
        this.renderStages();
      });
      this.stageCards.push({ card, bg, arena });
    });

    this.renderStages();
  }

  renderStages() {
    for (let i = 0; i < this.stageCards.length; i += 1) {
      const { bg } = this.stageCards[i];
      const active = i === this.stageIndex;
      bg.setStrokeStyle(active ? 3 : 1, active ? UI.gold : 0xffffff, active ? 1 : 0.35);
    }
  }

  pickStage(delta) {
    this.stageIndex = (this.stageIndex + delta + ARENAS.length) % ARENAS.length;
    SFX.uiMove();
    this.renderStages();
  }

  launch() {
    if (this._transitioning) resetSceneTransition(this);
    if (this.isOnline && !isOnlineHost()) return;

    const arena = ARENAS[this.stageIndex];
    this.registry.set('stageId', arena.id);
    SFX.uiConfirm();

    const payload = {
      p1: this.p1Id,
      p2: this.p2Id,
      mode: this.mode,
      difficulty: this.difficulty,
      playerSide: this.playerSide,
      stageId: arena.id,
      onlineRole: this.onlineRole,
      arcade: this.arcade,
    };

    if (this.isOnline && isOnlineHost()) {
      sendOnline('goto_battle', payload);
    }

    safeSceneStart(this, 'BattleScene', payload, { fadeMs: 350 });
  }

  shutdown() {
    resetSceneTransition(this);
    this._unbindFocus?.();
    this._unbindFocus = null;
    this._unbindConfirm?.();
    this._unbindConfirm = null;
    for (const off of this._onlineUnsubs ?? []) off();
    this._onlineUnsubs = null;
  }
}
