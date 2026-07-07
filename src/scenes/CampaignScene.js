import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, getCharacterById } from '../data/characters.js';
import { getCampaignPath, getCampaignNode } from '../data/campaign.js';
import { getCampaignState, getUnlockStats } from '../utils/unlockProgress.js';
import { SFX, ensureGameMusic } from '../utils/audio.js';
import { comicTitle, coverImage, label, rgba, UI, factionPalette } from '../utils/uiTheme.js';
import { resetSceneTransition, safeSceneStart, ensureSceneVisible } from '../utils/sceneTransition.js';
import { createClickButton } from '../utils/uiButtons.js';
import { bindClickToFocus, bindConfirmKeys, focusGameCanvas } from '../utils/gameInput.js';
import { createPortraitImage } from '../utils/spriteFrames.js';

const NODE_POSITIONS = [
  { x: 100, y: 420 },
  { x: 210, y: 360 },
  { x: 320, y: 300 },
  { x: 430, y: 260 },
  { x: 540, y: 300 },
  { x: 650, y: 360 },
  { x: 760, y: 420 },
];

export class CampaignScene extends Phaser.Scene {
  constructor() {
    super('CampaignScene');
  }

  init(data = {}) {
    this.playerSide = data.playerSide ?? 'hero';
    this.difficulty = data.difficulty ?? 'normal';
    this.path = getCampaignPath(this.playerSide);
    this.state = getCampaignState(this.playerSide);
    this.currentIndex = this.state.complete ? this.path.length - 1 : this.state.stageIndex;
  }

  create() {
    resetSceneTransition(this);
    ensureSceneVisible(this);
    this.cameras.main.setAlpha(1);

    coverImage(this, 'ui-mha-title', -100, 0.55);

    const shade = this.add.graphics().setDepth(-95);
    shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.35, 0.45, 0.82, 0.9);
    shade.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const pal = factionPalette(this.playerSide);
    const sideLabel = this.playerSide === 'hero' ? 'HERO CAMPAIGN' : 'VILLAIN CAMPAIGN';
    comicTitle(this, GAME_WIDTH / 2, 36, sideLabel, { size: 32, color: rgba(pal.main), depth: 10 });

    const stats = getUnlockStats();
    label(this, GAME_WIDTH / 2, 68, `Unlocked ${stats.heroes}/${stats.totalHeroes} heroes · ${stats.villains}/${stats.totalVillains} villains`, {
      fontSize: '9px', color: UI.textMuted, depth: 10,
    });

    if (this.state.complete) {
      label(this, GAME_WIDTH / 2, 88, 'PATH COMPLETE — replay any node', {
        fontSize: '10px', color: UI.goldText, depth: 10,
      });
    } else {
      label(this, GAME_WIDTH / 2, 88, `Stage ${this.currentIndex + 1} of ${this.path.length}`, {
        fontSize: '10px', color: UI.textDim, depth: 10,
      });
    }

    this.drawPathLine(pal.main);
    this.nodeCards = [];
    this.path.forEach((node, i) => this.drawNode(node, i, pal));

    const activeNode = getCampaignNode(this.playerSide, this.currentIndex);
    this.fightBtn = createClickButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 88, 'FIGHT!', () => {
      this.startNode(this.state.complete ? this.currentIndex : this.state.stageIndex);
    }, { width: 140, height: 42, depth: 20 });
    this.fightBtn.setEnabled(!!activeNode && (!this.state.complete || this.currentIndex < this.path.length));

    createClickButton(this, 70, GAME_HEIGHT - 36, 'BACK', () => {
      safeSceneStart(this, 'MenuScene', {}, { fadeMs: 220 });
    }, { width: 90, height: 34, depth: 20, sfx: 'move' });

    if (stats.secretUnlocked) {
      label(this, GAME_WIDTH - 70, GAME_HEIGHT - 36, 'PLUS ULTRA UNLOCKED', {
        fontSize: '8px', color: UI.goldText, originX: 1, originY: 1, depth: 10,
      });
    }

    ensureGameMusic();
    focusGameCanvas(this.game);
    bindClickToFocus(this);
    this._unbindConfirm = bindConfirmKeys(this, () => {
      if (!this.state.complete || this.currentIndex < this.path.length) {
        this.startNode(this.state.complete ? this.currentIndex : this.state.stageIndex);
      }
    });

    this.cameras.main.fadeIn(280);
  }

  drawPathLine(accent) {
    const g = this.add.graphics().setDepth(8);
    g.lineStyle(3, accent, 0.35);
    for (let i = 0; i < NODE_POSITIONS.length - 1; i += 1) {
      const a = NODE_POSITIONS[i];
      const b = NODE_POSITIONS[i + 1];
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  drawNode(node, index, pal) {
    const pos = NODE_POSITIONS[index];
    const cleared = index < this.state.stageIndex || this.state.complete;
    const isCurrent = !this.state.complete && index === this.state.stageIndex;
    const isFuture = !this.state.complete && index > this.state.stageIndex;
    const isBoss = node.boss === 'final' || node.boss === 'mini';
    const opp = getCharacterById(node.opponent);

    const card = this.add.container(pos.x, pos.y).setDepth(12);
    const size = isBoss ? 58 : 50;
    const bg = this.add.circle(0, 0, size / 2 + 4, isCurrent ? pal.main : 0x0c0a12, isFuture ? 0.35 : 0.88);
    bg.setStrokeStyle(isCurrent ? 3 : 2, isCurrent ? UI.gold : 0xffffff, isFuture ? 0.2 : isBoss ? 1 : 0.55);

    const ring = this.add.circle(0, 0, size / 2, 0x08060e, isFuture ? 0.4 : 0.95);
    card.add([bg, ring]);

    if (opp && !isFuture) {
      const portrait = createPortraitImage(this, 0, -2, opp, size - 8, size - 8);
      if (portrait) {
        portrait.setAlpha(isFuture ? 0.3 : 1);
        card.add(portrait);
      }
    } else if (isFuture) {
      const lock = label(this, 0, 0, '?', { fontSize: '18px', color: UI.textDim, depth: 13 });
      card.add(lock);
    }

    if (cleared) {
      const check = label(this, size / 2 - 4, -size / 2 + 4, '✓', {
        fontSize: '12px', color: UI.goldText, originX: 1, originY: 0, depth: 14,
      });
      card.add(check);
    }

    if (isBoss) {
      const tag = label(this, 0, size / 2 + 10, node.boss === 'final' ? 'BOSS' : 'MINI', {
        fontSize: '7px', color: node.boss === 'final' ? '#ff6b6b' : UI.goldText, letterSpacing: 1, depth: 14,
      });
      card.add(tag);
    }

    const name = label(this, 0, size / 2 + 22, node.label, {
      fontSize: '7px', color: isFuture ? UI.textDim : UI.text, align: 'center', wordWrap: { width: 90 }, depth: 14,
    });
    card.add(name);

    if (!isFuture) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        if (this.state.complete || index <= this.state.stageIndex) {
          SFX.uiMove();
          this.currentIndex = index;
          this.highlightNode(index);
        }
      });
    }

    this.nodeCards.push({ card, bg, index, isCurrent });
    if (isCurrent || (this.state.complete && index === this.currentIndex)) {
      this.highlightNode(index);
    }
  }

  highlightNode(index) {
    this.currentIndex = index;
    for (const n of this.nodeCards) {
      const active = n.index === index;
      n.bg.setStrokeStyle(active ? 4 : 2, active ? UI.gold : 0xffffff, active ? 1 : 0.4);
    }
    const node = this.path[index];
    if (node) {
      this.fightBtn?.setEnabled(true);
    }
  }

  startNode(stageIndex) {
    const node = getCampaignNode(this.playerSide, stageIndex);
    if (!node) return;
    SFX.uiConfirm();

    const campaignRun = {
      side: this.playerSide,
      stageIndex,
      node,
      ladder: this.path.map((n) => n.opponent),
      totalStages: this.path.length,
    };

    this.registry.set('mode', 'campaign');
    this.registry.set('playerSide', this.playerSide);
    this.registry.set('difficulty', this.difficulty);
    this.registry.set('campaignRun', campaignRun);

    safeSceneStart(this, 'CharacterSelectScene', {
      mode: 'campaign',
      playerSide: this.playerSide,
      campaignRun,
    }, { fadeMs: 280 });
  }

  shutdown() {
    this._unbindConfirm?.();
    this._unbindConfirm = null;
    resetSceneTransition(this);
  }
}
