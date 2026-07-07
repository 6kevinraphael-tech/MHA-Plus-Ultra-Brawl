import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../data/characters.js';
import {
  coverImage,
  label,
  rgba,
  UI,
} from '../utils/uiTheme.js';
import { SFX, resumeAudio, ensureGameMusic, toggleMute, isMuted } from '../utils/audio.js';
import { ensureSceneVisible, resetSceneTransition, safeSceneStart } from '../utils/sceneTransition.js';
import { ensureDeferredAssets } from '../utils/deferredAssetLoad.js';
import { createClickButton } from '../utils/uiButtons.js';
import { bindClickToFocus, bindConfirmKeys, focusGameCanvas } from '../utils/gameInput.js';
import { getUnlockStats } from '../utils/unlockProgress.js';

const MODES = [
  { id: 'campaign', label: 'CAMPAIGN  ·  UNLOCK FIGHTERS', pill: 'CAMPAIGN' },
  { id: '1p', label: 'NORMAL  ·  1P vs CPU', pill: '1P NORMAL' },
  { id: '2p', label: 'VERSUS  ·  2P LOCAL', pill: '2P LOCAL' },
  { id: 'online', label: 'ONLINE  ·  VS FRIENDS', pill: 'ONLINE VS' },
];
const SIDES = [
  { id: 'hero', label: 'FIGHT AS HEROES', pill: 'HEROES' },
  { id: 'villain', label: 'FIGHT AS VILLAINS', pill: 'VILLAINS' },
];
const DIFFS = [
  { id: 'easy', label: 'EASY', pill: 'EASY' },
  { id: 'normal', label: 'NORMAL', pill: 'NORMAL' },
  { id: 'hard', label: 'HARD', pill: 'HARD' },
];

const MENU_LEFT = 56;
const MENU_TOP = 400;
const ROW_H = 40;
const PILL_H = 30;
const PILL_GAP = 8;

function pillLabel(opt) {
  return opt.pill ?? opt.label;
}

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  init() {
    resetSceneTransition(this);
  }

  create() {
    resetSceneTransition(this);
    ensureSceneVisible(this);
    this.cameras.main.setBackgroundColor('#06080f');
    this.titleImage = null;

    this.modeIndex = this.registry.get('modeIndex') ?? 0;
    this.sideIndex = this.registry.get('sideIndex') ?? 0;
    this.diffIndex = this.registry.get('diffIndex') ?? 1;
    this.row = 0;

    this.applyMenuBackground();
    this.events.on('deferred-assets-ready', () => this.applyMenuBackground());
    ensureDeferredAssets(this);

    const shade = this.add.graphics().setDepth(-90);
    shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0, 0.88);
    shade.fillRect(0, MENU_TOP - 28, GAME_WIDTH, GAME_HEIGHT - MENU_TOP + 28);

    this.drawMenuPanel();

    this.menuLabels = [];
    this.menuRows = [];
    const rows = ['MODE', 'YOUR SIDE', 'CPU DIFFICULTY'];
    for (let i = 0; i < 3; i += 1) {
      const y = MENU_TOP + i * ROW_H;
      this.menuLabels.push(label(this, MENU_LEFT, y, rows[i], {
        fontSize: '10px', color: UI.textDim, originX: 0, originY: 0.5, depth: 20,
      }));
    }

    this.modePills = this.buildPillRow(0, MENU_TOP, MODES, (i) => this.setMode(i));
    this.sidePills = this.buildPillRow(1, MENU_TOP + ROW_H, SIDES, (i) => this.setSide(i));
    this.diffPills = this.buildPillRow(2, MENU_TOP + ROW_H * 2, DIFFS, (i) => this.setDiff(i));
    this.menuRows = [this.modePills, this.sidePills, this.diffPills];

    this.startBtn = this.add.container(GAME_WIDTH - 56, MENU_TOP + ROW_H).setDepth(22);
    const startBg = this.add.rectangle(0, 0, 148, 52, 0x000000, 0.45);
    startBg.setStrokeStyle(2, 0xffff00, 0.9);
    startBg.setInteractive({ useHandCursor: true });
    this.startHint = this.add.text(0, -6, 'START', {
      fontFamily: UI.font,
      fontSize: '24px',
      color: '#ffff00',
      fontStyle: 'italic',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);
    const startLabel = this.add.text(0, 16, 'START', {
      fontFamily: UI.font,
      fontSize: '11px',
      color: '#ffffff',
      letterSpacing: 4,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.startBtn.add([startBg, this.startHint, startLabel]);
    startBg.on('pointerdown', () => this.start());

    this.muteBtn = createClickButton(this, GAME_WIDTH - 56, 28, 'AUDIO ON', () => {
      toggleMute();
      this.render();
    }, { width: 100, height: 30, fontSize: '10px', depth: 15, sfx: 'move' });

    label(this, MENU_LEFT, GAME_HEIGHT - 34, 'Click options · ENTER or click START', {
      fontSize: '9px', color: UI.textDim, originX: 0, originY: 1, depth: 20,
    });
    this.unlockHint = label(this, MENU_LEFT, GAME_HEIGHT - 18, '', {
      fontSize: '8px', color: UI.textMuted, originX: 0, originY: 1, depth: 20,
    });
    label(this, GAME_WIDTH - 56, GAME_HEIGHT - 18, 'Fan project', {
      fontSize: '9px', color: UI.textDim, originX: 1, originY: 1, depth: 20,
    });

    this.tweens.add({
      targets: this.startHint,
      alpha: 0.45,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.render();
    ensureGameMusic();
    this.setupMusicUnlock();

    focusGameCanvas(this.game);
    if (this.input.keyboard) this.input.keyboard.enabled = true;
    this._unbindFocus = bindClickToFocus(this);
    this._unbindConfirm = bindConfirmKeys(this, () => this.start());
    this.time.delayedCall(80, () => focusGameCanvas(this.game));

    this.cameras.main.fadeIn(400);
  }

  setupMusicUnlock() {
    const unlock = () => {
      resumeAudio();
      ensureGameMusic();
    };
    this._musicUnlock = unlock;
    this.input.on('pointerdown', unlock);
  }

  applyMenuBackground() {
    if (!this.textures.exists('ui-title-clash')) return;
    if (this.titleImage?.active) return;
    this.titleImage = coverImage(this, 'ui-title-clash', -100, 0.95);
  }

  drawMenuPanel() {
    const g = this.add.graphics().setDepth(18);
    g.fillStyle(0x000000, 0.42);
    g.fillRoundedRect(MENU_LEFT - 16, MENU_TOP - 22, 720, 142, 4);
    g.lineStyle(1, 0xffffff, 0.25);
    g.strokeRoundedRect(MENU_LEFT - 16, MENU_TOP - 22, 720, 142, 4);
  }

  buildPillRow(rowIndex, y, options, onPick) {
    const pills = [];
    let x = MENU_LEFT + 98;

    options.forEach((opt, i) => {
      const text = pillLabel(opt);
      const pillW = Math.max(92, text.length * 7 + 28);
      const cx = x + pillW / 2;
      const container = this.add.container(cx, y).setDepth(21);
      const bg = this.add.rectangle(0, 0, pillW, PILL_H, 0x0c0a12, 0.88);
      bg.setStrokeStyle(2, 0xffffff, 0.4);
      bg.setInteractive({ useHandCursor: true });
      const txt = this.add.text(0, 0, text, {
        fontFamily: UI.font,
        fontSize: '11px',
        color: UI.textMuted,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);
      container.add([bg, txt]);

      bg.on('pointerdown', () => {
        if (rowIndex === 2 && MODES[this.modeIndex].id === '2p') return;
        this.row = rowIndex;
        onPick(i);
      });

      pills.push({ container, bg, txt, rowIndex, index: i });
      x += pillW + PILL_GAP;
    });

    return pills;
  }

  setMode(index) {
    this.modeIndex = Phaser.Math.Clamp(index, 0, MODES.length - 1);
    this.registry.set('modeIndex', this.modeIndex);
    SFX.uiMove();
    this.render();
  }

  setSide(index) {
    this.sideIndex = Phaser.Math.Clamp(index, 0, SIDES.length - 1);
    this.registry.set('sideIndex', this.sideIndex);
    SFX.uiMove();
    this.render();
  }

  setDiff(index) {
    if (MODES[this.modeIndex].id === '2p') return;
    this.diffIndex = Phaser.Math.Clamp(index, 0, DIFFS.length - 1);
    this.registry.set('diffIndex', this.diffIndex);
    SFX.uiMove();
    this.render();
  }

  updatePillRow(pills, selectedIndex, rowIndex, dimmed = false) {
    const rowFocus = this.row === rowIndex;
    for (const pill of pills) {
      const active = pill.index === selectedIndex;
      pill.bg.setFillStyle(active ? 0x18121e : 0x0c0a12, dimmed ? 0.35 : active ? 0.98 : 0.8);
      pill.bg.setStrokeStyle(active ? 3 : 1, active ? UI.gold : 0xffffff, dimmed ? 0.15 : active ? 1 : 0.35);
      if (rowIndex === 1 && active && !dimmed) {
        const accent = SIDES[selectedIndex].id === 'hero' ? UI.hero : UI.villain;
        pill.txt.setColor(rgba(accent));
      } else {
        pill.txt.setColor(dimmed ? UI.textDim : active ? UI.goldText : UI.textMuted);
      }
      pill.txt.setFontSize(active && rowFocus ? '12px' : '11px');
      pill.bg.input.enabled = !dimmed;
    }
  }

  render() {
    const diffDim = MODES[this.modeIndex].id === '2p' || MODES[this.modeIndex].id === 'online';

    for (let i = 0; i < 3; i += 1) {
      const selected = this.row === i;
      const dim = i === 2 && diffDim;
      this.menuLabels[i].setText(['MODE', 'YOUR SIDE', 'CPU DIFFICULTY'][i]);
      this.menuLabels[i].setFontSize(selected ? '11px' : '10px');
      this.menuLabels[i].setColor(selected ? '#ffff00' : dim ? UI.textDim : UI.textDim);
    }

    this.updatePillRow(this.modePills, this.modeIndex, 0);
    this.updatePillRow(this.sidePills, this.sideIndex, 1);
    this.updatePillRow(this.diffPills, this.diffIndex, 2, diffDim);

    this.muteBtn.setLabel(isMuted() ? 'AUDIO OFF' : 'AUDIO ON');

    const stats = getUnlockStats();
    this.unlockHint?.setText(
      stats.secretUnlocked
        ? 'PLUS ULTRA — all fighters unlocked!'
        : `Unlocked ${stats.heroes}/${stats.totalHeroes} heroes · ${stats.villains}/${stats.totalVillains} villains`,
    );
  }

  start() {
    if (this._transitioning) resetSceneTransition(this);
    resumeAudio();
    ensureGameMusic();
    SFX.uiConfirm();

    const selected = MODES[this.modeIndex]?.id ?? 'campaign';

    if (selected === 'online') {
      this.registry.set('mode', 'online');
      this.registry.set('playerSide', SIDES[this.sideIndex].id);
      this.registry.remove('campaignRun');
      this.cameras.main.flash(120, 255, 255, 255, false);
      safeSceneStart(this, 'OnlineLobbyScene', {
        playerSide: SIDES[this.sideIndex].id,
      }, { fadeMs: 350 });
      return;
    }

    if (selected === 'campaign') {
      this.registry.set('mode', 'campaign');
      this.registry.set('playerSide', SIDES[this.sideIndex].id);
      this.registry.set('difficulty', DIFFS[this.diffIndex].id);
      this.registry.remove('campaignRun');
      this.cameras.main.flash(120, 255, 255, 255, false);
      safeSceneStart(this, 'CampaignScene', {
        playerSide: SIDES[this.sideIndex].id,
        difficulty: DIFFS[this.diffIndex].id,
      }, { fadeMs: 350 });
      return;
    }

    const playMode = selected === '2p' ? '2p' : '1p';

    this.registry.set('mode', playMode);
    this.registry.set('playerSide', SIDES[this.sideIndex].id);
    this.registry.set('difficulty', DIFFS[this.diffIndex].id);
    this.registry.remove('campaignRun');

    this.cameras.main.flash(120, 255, 255, 255, false);
    safeSceneStart(this, 'CharacterSelectScene', {}, { fadeMs: 350 });
  }

  shutdown() {
    resetSceneTransition(this);
    this.events.off('deferred-assets-ready');
    this._unbindFocus?.();
    this._unbindFocus = null;
    this._unbindConfirm?.();
    this._unbindConfirm = null;
    if (this._musicUnlock) {
      this.input.off('pointerdown', this._musicUnlock);
      this._musicUnlock = null;
    }
  }
}
