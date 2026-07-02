import Phaser from 'phaser';
import {
  getOpposingFaction,
  getRosterForFaction,
  GAME_WIDTH,
  GAME_HEIGHT,
} from '../data/characters.js';
import {
  addPortraitToBox,
  createSelectStandee,
  createStandeeBackdrop,
  updateSelectStandee,
} from '../utils/spriteFrames.js';
import { SFX } from '../utils/audio.js';
import {
  factionLabel,
  factionPalette,
  holographicVsBadge,
  label,
  rgba,
  UI,
} from '../utils/uiTheme.js';
import {
  clampScrollOffset,
  createGridSlot,
  createShardSlot,
  drawCenterClashGlow,
  drawCharSelectBackground,
  drawCharSelectTitle,
  drawFactionBanner,
  CHAR_SELECT_DEPTH,
  getRosterLayout,
  setShardSelected,
  SLOTS_PER_PAGE,
} from '../utils/characterSelectUi.js';
import { resetSceneTransition, safeSceneStart, ensureSceneVisible } from '../utils/sceneTransition.js';
import { ensureGameMusic } from '../utils/audio.js';
import { createClickButton } from '../utils/uiButtons.js';
import { bindClickToFocus, bindConfirmKeys, focusGameCanvas } from '../utils/gameInput.js';
import {
  isOnlineHost,
  onOnlineEvent,
  sendOnline,
  leaveOnlineRoom,
} from '../utils/onlineSession.js';

const STAGE_FLOOR_Y = 478;
const P1_STANDEE_X = 350;
const P2_STANDEE_X = GAME_WIDTH - 350;
const STANDEE_H = 320;
const ROSTER_SCROLL_X = { left: 132, right: GAME_WIDTH - 132 };

export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super('CharacterSelectScene');
    this.p1Index = 0;
    this.p2Index = 0;
    this.p1Confirmed = false;
    this.p2Confirmed = false;
    this.p1Scroll = 0;
    this.p2Scroll = 0;
  }

  init(data = {}) {
    resetSceneTransition(this);
    this.p1Index = 0;
    this.p2Index = 0;
    this.p1Confirmed = false;
    this.p2Confirmed = false;
    this.p1Scroll = 0;
    this.p2Scroll = 0;
    this.mode = this.registry.get('mode') ?? '2p';
    this.onlineRole = data?.onlineRole ?? this.registry.get('onlineRole') ?? null;
    this.isOnline = this.mode === 'online';
    if (this.isOnline) this.registry.set('onlineRole', this.onlineRole);
    this.difficulty = this.registry.get('difficulty') ?? 'normal';
    this.playerSide = this.registry.get('playerSide') ?? 'hero';
    this.arcadeRun = this.registry.get('arcadeRun') ?? null;

    this.p1Roster = getRosterForFaction(this.playerSide);
    this.p2Roster = getRosterForFaction(getOpposingFaction(this.playerSide));
    this.p1Palette = factionPalette(this.playerSide);
    this.p2Palette = factionPalette(getOpposingFaction(this.playerSide));
    this.p1Layout = getRosterLayout(this.p1Roster.length, 'left');
    this.p2Layout = getRosterLayout(this.p2Roster.length, 'right');
  }

  create() {
    resetSceneTransition(this);
    ensureSceneVisible(this);
    this.cameras.main.setAlpha(1);
    this.cameras.main.setZoom(1);

    drawCharSelectBackground(this);
    drawCharSelectTitle(this);
    drawCenterClashGlow(this, GAME_WIDTH / 2, STAGE_FLOOR_Y - 150, this.p1Palette.main, this.p2Palette.main);

    this.vsBadge = holographicVsBadge(this, GAME_WIDTH / 2, STAGE_FLOOR_Y - 175, CHAR_SELECT_DEPTH.vsBadge);

    drawFactionBanner(
      this,
      'left',
      factionLabel(this.playerSide),
      this.p1Palette.main,
      'PLAYER 1',
    );
    drawFactionBanner(
      this,
      'right',
      factionLabel(getOpposingFaction(this.playerSide)),
      this.p2Palette.main,
      this.mode === '1p' ? 'CPU' : 'PLAYER 2',
    );

    this.infoPanel = this.createInfoPanel();
    this.hintText = label(this, GAME_WIDTH / 2, GAME_HEIGHT - 52, '', {
      fontSize: '11px',
      color: UI.text,
      align: 'center',
      wordWrap: { width: 520 },
      depth: CHAR_SELECT_DEPTH.footer,
      stroke: '#000000',
      strokeThickness: 3,
    });

    const ctrlLine = this.isOnline
      ? (isOnlineHost()
        ? 'Pick your fighter · CONFIRM · friend picks theirs'
        : 'Pick your fighter · CONFIRM · host chooses stage next')
      : this.mode === '1p'
        ? 'Click a fighter · ENTER or CONFIRM to lock in'
        : 'Click roster · ENTER or CONFIRM each pick';
    label(this, GAME_WIDTH / 2, GAME_HEIGHT - 30, ctrlLine, {
      fontSize: '9px', color: UI.textMuted, letterSpacing: 1, depth: CHAR_SELECT_DEPTH.footer,
    });

    this.confirmBtn = createClickButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 72, 'CONFIRM', () => {
      this.confirmSelection();
    }, { width: 140, height: 40, depth: 22 });

    createClickButton(this, 56, GAME_HEIGHT - 72, 'BACK', () => {
      safeSceneStart(this, 'MenuScene', {}, { fadeMs: 200 });
    }, { width: 90, height: 36, depth: 22, sfx: 'move' });

    ensureGameMusic();
    focusGameCanvas(this.game);
    this._unbindFocus = bindClickToFocus(this);
    this._unbindConfirm = bindConfirmKeys(this, () => this.confirmSelection());
    this.input.once('pointerdown', () => ensureGameMusic());

    this._onlineUnsubs = [];
    if (this.isOnline) {
      this._onlineUnsubs.push(onOnlineEvent('relay:pick', (msg) => this.onRemotePick(msg)));
      this._onlineUnsubs.push(onOnlineEvent('relay:confirm', (msg) => this.onRemoteConfirm(msg)));
      this._onlineUnsubs.push(onOnlineEvent('relay:goto_stage', (msg) => this.onGotoStage(msg)));
      this._onlineUnsubs.push(onOnlineEvent('peer_left', () => {
        this.hintText?.setText('Opponent disconnected — returning to menu');
        this.time.delayedCall(1200, () => {
          leaveOnlineRoom();
          safeSceneStart(this, 'MenuScene', {}, { fadeMs: 200 });
        });
      }));
    }

    this.cameras.main.fadeIn(300);
    this.finishCreate();
  }

  finishCreate() {
    this.p1Shards = this.buildRosterPanel(this.p1Roster, 'left', this.p1Palette.main, this.p1Layout, 1);
    this.p2Shards = this.buildRosterPanel(this.p2Roster, 'right', this.p2Palette.main, this.p2Layout, 2);

    this.p1StandeePlate = createStandeeBackdrop(this, P1_STANDEE_X, STAGE_FLOOR_Y, STANDEE_H, CHAR_SELECT_DEPTH.standeeBackdrop);
    this.p2StandeePlate = createStandeeBackdrop(this, P2_STANDEE_X, STAGE_FLOOR_Y, STANDEE_H, CHAR_SELECT_DEPTH.standeeBackdrop);
    this.p1Standee = createSelectStandee(this, P1_STANDEE_X, STAGE_FLOOR_Y, this.p1Roster[0], false, STANDEE_H);
    this.p2Standee = createSelectStandee(this, P2_STANDEE_X, STAGE_FLOOR_Y, this.p2Roster[0], true, STANDEE_H);
    if (this.p1Standee) this.p1Standee.setDepth(CHAR_SELECT_DEPTH.standee);
    if (this.p2Standee) this.p2Standee.setDepth(CHAR_SELECT_DEPTH.standee);

    this.updateSelection();
    this.updateHint();
  }

  shutdown() {
    resetSceneTransition(this);
    this._unbindFocus?.();
    this._unbindFocus = null;
    this._unbindConfirm?.();
    this._unbindConfirm = null;
    for (const off of this._onlineUnsubs ?? []) off();
    this._onlineUnsubs = null;
    if (this._scrollHints) {
      for (const hint of Object.values(this._scrollHints)) hint?.destroy();
      this._scrollHints = null;
    }
  }

  buildRosterPanel(roster, side, accent, layout, playerNum) {
    if (layout.mode === 'grid') {
      return this.buildGridRoster(roster, side, accent, layout, playerNum);
    }
    return this.buildWedgeRoster(roster, side, accent, layout);
  }

  buildWedgeRoster(roster, side, accent, layout) {
    const slots = layout.slots;
    const entries = [];

    roster.forEach((char, rosterIndex) => {
      const slotIndex = layout.indices[rosterIndex];
      const slot = slots[slotIndex];
      entries.push(this.buildShardEntry(char, rosterIndex, slot, side, accent, false));
    });

    return entries;
  }

  buildGridRoster(roster, side, accent, layout, playerNum) {
    const scrollKey = playerNum === 1 ? 'p1Scroll' : 'p2Scroll';
    const scroll = this[scrollKey];
    const pageSize = layout.pageSize ?? SLOTS_PER_PAGE;
    const entries = [];

    for (let slotIndex = 0; slotIndex < pageSize; slotIndex += 1) {
      const rosterIndex = scroll + slotIndex;
      if (rosterIndex >= roster.length) break;
      const slot = layout.slots[slotIndex];
      if (!slot) break;
      entries.push(this.buildShardEntry(roster[rosterIndex], rosterIndex, slot, side, accent, true));
    }

    const cx = side === 'left' ? ROSTER_SCROLL_X.left : ROSTER_SCROLL_X.right;
    const canScrollUp = scroll > 0;
    const canScrollDown = scroll + pageSize < roster.length;
    this.drawScrollButton(cx, 158, 'up', canScrollUp, () => {
      this[scrollKey] = Math.max(0, scroll - pageSize);
      this.refreshGridPanel(playerNum);
    });
    this.drawScrollButton(cx, 430, 'down', canScrollDown, () => {
      this[scrollKey] = Math.min(roster.length - pageSize, scroll + pageSize);
      if (this[scrollKey] < 0) this[scrollKey] = 0;
      this.refreshGridPanel(playerNum);
    });

    return entries;
  }

  buildShardEntry(char, rosterIndex, slot, side, accent, isGrid) {
    const shard = isGrid
      ? createGridSlot(this, slot, side, accent, 18)
      : createShardSlot(this, slot, side, accent, 18);

    const portraitX = isGrid ? slot.w * 0.5 : (side === 'left' ? slot.w * 0.55 : slot.w * 0.45);
    const portraitY = isGrid ? slot.h * 0.4 : slot.h * 0.44;
    const portrait = addPortraitToBox(this, shard, char, portraitX, portraitY, slot.w * 0.82, slot.h * 0.68);

    const shortName = char.name.split(' ').pop().toUpperCase();
    const nameText = this.add.text(isGrid ? slot.w * 0.5 : slot.w * 0.5, slot.h - 10, shortName, {
      fontFamily: UI.font,
      fontSize: isGrid ? '8px' : '10px',
      color: UI.text,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    shard.add(nameText);

    shard.setData('rosterIndex', rosterIndex);
    shard.setData('portrait', portrait);
    shard.setData('playerNum', side === 'left' ? 1 : 2);

    const playerNum = side === 'left' ? 1 : 2;
    const onPick = (pointer) => {
      pointer?.event?.stopPropagation?.();
      this.onShardClick(playerNum, rosterIndex);
    };

    shard.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, slot.w, slot.h),
      Phaser.Geom.Rectangle.Contains,
    );
    if (shard.input) shard.input.cursor = 'pointer';
    shard.on('pointerdown', onPick);

    return shard;
  }

  drawScrollButton(x, y, direction, visible, onClick) {
    const key = `scroll-${direction}-${x}`;
    this._scrollHints?.[key]?.container?.destroy();
    if (this._scrollHints) delete this._scrollHints[key];
    if (!visible) return;

    if (!this._scrollHints) this._scrollHints = {};
    this._scrollHints[key] = createClickButton(this, x, y, direction === 'up' ? '▲ MORE' : '▼ MORE', onClick, {
      width: 72, height: 28, fontSize: '9px', depth: 14, sfx: 'move',
    });
  }

  onShardClick(player, rosterIndex) {
    if (this._transitioning) return;

    const isP1 = player === 1;
    if (this.isOnline) {
      if (isOnlineHost() && !isP1) return;
      if (!isOnlineHost() && isP1) return;
    }
    if (isP1 && this.p1Confirmed) return;
    if (!isP1 && this.p2Confirmed) return;
    if (this.mode === '1p' && !isP1) return;

    const cur = isP1 ? this.p1Index : this.p2Index;
    if (cur === rosterIndex) {
      this.confirmSelection();
      return;
    }

    SFX.uiMove();
    if (isP1) this.p1Index = rosterIndex;
    else this.p2Index = rosterIndex;

    if (this.isOnline) {
      const roster = isP1 ? this.p1Roster : this.p2Roster;
      sendOnline('pick', { player: isP1 ? 1 : 2, charId: roster[rosterIndex].id, index: rosterIndex });
    }

    const layout = isP1 ? this.p1Layout : this.p2Layout;
    if (layout.mode === 'grid') {
      const scrollKey = isP1 ? 'p1Scroll' : 'p2Scroll';
      const prevScroll = this[scrollKey];
      const roster = isP1 ? this.p1Roster : this.p2Roster;
      this[scrollKey] = clampScrollOffset(roster.length, rosterIndex, this[scrollKey]);
      if (this[scrollKey] !== prevScroll) this.refreshGridPanel(player);
    }

    this.updateSelection();
    this.updateHint();
  }

  refreshGridPanel(player) {
    const isP1 = player === 1;
    const roster = isP1 ? this.p1Roster : this.p2Roster;
    const layout = isP1 ? this.p1Layout : this.p2Layout;
    if (layout.mode !== 'grid') return;

    const scrollKey = isP1 ? 'p1Scroll' : 'p2Scroll';
    const palette = isP1 ? this.p1Palette : this.p2Palette;
    const side = isP1 ? 'left' : 'right';

    (isP1 ? this.p1Shards : this.p2Shards)?.forEach((s) => s.destroy());
    const shards = this.buildGridRoster(roster, side, palette.main, layout, player);
    if (isP1) this.p1Shards = shards;
    else this.p2Shards = shards;
    this.updateSelection();
  }

  createInfoPanel() {
    const y = STAGE_FLOOR_Y + 8;
    const panel = this.add.rectangle(GAME_WIDTH / 2, y, 420, 52, 0x000000, 0.62).setDepth(CHAR_SELECT_DEPTH.infoPanel);
    panel.setStrokeStyle(2, UI.gold, 0.55);

    const name = label(this, GAME_WIDTH / 2, y - 10, '', {
      fontSize: '17px', color: UI.text, fontFamily: UI.font, fontStyle: 'italic', depth: CHAR_SELECT_DEPTH.infoPanel + 1,
    });
    const special = label(this, GAME_WIDTH / 2, y + 8, '', {
      fontSize: '10px', color: UI.goldText, depth: CHAR_SELECT_DEPTH.infoPanel + 1,
    });
    const passive = label(this, GAME_WIDTH / 2, y + 22, '', {
      fontSize: '9px', color: UI.textMuted, depth: CHAR_SELECT_DEPTH.infoPanel + 1,
    });

    return { name, special, passive };
  }

  moveSelection(player, delta) {
    if (this.mode === '1p' && player === 2) return;
    if (player === 1 && this.p1Confirmed) return;
    if (player === 2 && this.p2Confirmed) return;

    const roster = player === 1 ? this.p1Roster : this.p2Roster;
    if (roster.length <= 1) return;

    SFX.uiMove();
    const cur = player === 1 ? this.p1Index : this.p2Index;
    const next = (cur + delta + roster.length) % roster.length;
    if (player === 1) this.p1Index = next;
    else this.p2Index = next;

    const layout = player === 1 ? this.p1Layout : this.p2Layout;
    if (layout.mode === 'grid') {
      const scrollKey = player === 1 ? 'p1Scroll' : 'p2Scroll';
      const prevScroll = this[scrollKey];
      this[scrollKey] = clampScrollOffset(roster.length, next, this[scrollKey]);
      if (this[scrollKey] !== prevScroll) this.refreshGridPanel(player);
    }

    this.updateSelection();
    this.updateHint();
  }

  updateSelection() {
    if (!this.p1Shards) return;

    this.p1Shards.forEach((shard) => {
      setShardSelected(shard, shard.getData('rosterIndex') === this.p1Index, this.p1Confirmed);
    });
    this.p2Shards.forEach((shard) => {
      setShardSelected(shard, shard.getData('rosterIndex') === this.p2Index, this.p2Confirmed);
    });

    const p1Char = this.p1Roster[this.p1Index];
    const p2Char = this.p2Roster[this.p2Index];

    if (this.p1Standee) updateSelectStandee(this.p1Standee, p1Char, false, STANDEE_H);
    if (this.p2Standee) updateSelectStandee(this.p2Standee, p2Char, true, STANDEE_H);

    const focus = !this.p1Confirmed ? p1Char : p2Char;
    const accent = !this.p1Confirmed ? this.p1Palette.main : this.p2Palette.main;
    this.infoPanel.name.setText(focus.name.toUpperCase());
    this.infoPanel.special.setText(focus.specialName);
    this.infoPanel.special.setColor(rgba(accent));
    this.infoPanel.passive.setText(focus.passive);
  }

  onRemotePick(msg) {
    const roster = msg.player === 1 ? this.p1Roster : this.p2Roster;
    const idx = typeof msg.index === 'number'
      ? msg.index
      : roster.findIndex((c) => c.id === msg.charId);
    if (idx < 0) return;
    if (msg.player === 1) this.p1Index = idx;
    else this.p2Index = idx;
    this.updateSelection();
  }

  onRemoteConfirm(msg) {
    if (msg.player === 1) {
      this.p1Confirmed = true;
      const idx = this.p1Roster.findIndex((c) => c.id === msg.charId);
      if (idx >= 0) this.p1Index = idx;
    } else {
      this.p2Confirmed = true;
      const idx = this.p2Roster.findIndex((c) => c.id === msg.charId);
      if (idx >= 0) this.p2Index = idx;
    }
    this.updateSelection();
    this.updateHint();
    if (this.isOnline && !isOnlineHost() && this.p1Confirmed && this.p2Confirmed) {
      this.hintText.setText('Waiting for host to choose stage…');
    }
    if (this.isOnline && isOnlineHost() && this.p1Confirmed && this.p2Confirmed) {
      this.launch();
    }
  }

  onGotoStage(msg) {
    if (this._transitioning) return;
    safeSceneStart(this, 'StageSelectScene', {
      p1: msg.p1,
      p2: msg.p2,
      mode: 'online',
      playerSide: msg.playerSide,
      onlineRole: this.onlineRole,
    }, { fadeMs: 180 });
  }

  confirmSelection() {
    if (this._transitioning) return;

    if (this.isOnline) {
      if (isOnlineHost()) {
        if (!this.p1Confirmed) {
          this.p1Confirmed = true;
          SFX.uiConfirm();
          sendOnline('confirm', { player: 1, charId: this.p1Roster[this.p1Index].id });
          this.updateSelection();
          this.updateHint();
          if (this.p2Confirmed) this.launch();
          return;
        }
        if (this.p2Confirmed) this.launch();
        return;
      }

      if (!this.p2Confirmed) {
        this.p2Confirmed = true;
        SFX.uiConfirm();
        sendOnline('confirm', { player: 2, charId: this.p2Roster[this.p2Index].id });
        this.updateSelection();
        this.updateHint();
      }
      return;
    }

    if (!this.p1Confirmed) {
      this.p1Confirmed = true;
      SFX.uiConfirm();
      this.updateSelection();
      this.updateHint();

      if (this.mode === '1p') {
        const oppId = this.arcadeRun?.ladder?.[this.arcadeRun.stageIndex ?? 0];
        if (oppId) {
          const idx = this.p2Roster.findIndex((c) => c.id === oppId);
          this.p2Index = idx >= 0 ? idx : Phaser.Math.Between(0, this.p2Roster.length - 1);
        } else {
          this.p2Index = Phaser.Math.Between(0, this.p2Roster.length - 1);
        }
        this.p2Confirmed = true;
        this.updateSelection();
        this.launch();
      }
      return;
    }

    if (!this.p2Confirmed) {
      this.p2Confirmed = true;
      SFX.uiConfirm();
      this.updateSelection();
      this.launch();
    }
  }

  launch() {
    if (this._transitioning) resetSceneTransition(this);
    const p1Char = this.p1Roster[this.p1Index];
    const p2Char = this.p2Roster[this.p2Index];

    const payload = {
      p1: p1Char.id,
      p2: p2Char.id,
      mode: this.mode,
      difficulty: this.difficulty,
      playerSide: this.playerSide,
      onlineRole: this.onlineRole,
      arcade: this.arcadeRun
        ? { ladder: this.arcadeRun.ladder, stageIndex: this.arcadeRun.stageIndex ?? 0 }
        : null,
    };

    if (this.isOnline && isOnlineHost()) {
      sendOnline('goto_stage', {
        p1: p1Char.id,
        p2: p2Char.id,
        playerSide: this.playerSide,
      });
    }

    safeSceneStart(this, 'StageSelectScene', payload, { fadeMs: 180 });
  }

  updateHint() {
    const char = !this.p1Confirmed
      ? this.p1Roster[this.p1Index]
      : this.p2Roster[this.p2Index];

    if (!this.p1Confirmed) {
      this.hintText.setText(`${char.specialDesc}  ·  ENTER or CONFIRM to lock in`);
    } else if (!this.p2Confirmed && (this.mode === '2p' || this.isOnline)) {
      this.hintText.setText(this.isOnline && isOnlineHost()
        ? 'Waiting for friend to lock in…'
        : `${char.specialDesc}  ·  P2 ENTER or CONFIRM`);
    } else if (this.isOnline && !isOnlineHost()) {
      this.hintText.setText('Waiting for host to choose stage…');
    } else {
      this.hintText.setText('Entering battle…');
    }

    const canConfirm = this.isOnline
      ? (isOnlineHost() ? !this.p1Confirmed : !this.p2Confirmed)
      : (!this.p1Confirmed || (this.mode === '2p' && !this.p2Confirmed));
    this.confirmBtn?.setEnabled(canConfirm);
  }
}
