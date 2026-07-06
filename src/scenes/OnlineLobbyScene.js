import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, getOpposingFaction } from '../data/characters.js';
import {
  createOnlineRoom,
  joinOnlineRoom,
  leaveOnlineRoom,
  onOnlineEvent,
  getRoomCode,
  isOnlineHost,
  sendOnline,
  getOnlineWsUrl,
  setOnlineRelayUrl,
} from '../utils/onlineSession.js';
import { SFX, ensureGameMusic } from '../utils/audio.js';
import { comicTitle, label, rgba, UI, coverImage } from '../utils/uiTheme.js';
import { resetSceneTransition, safeSceneStart, ensureSceneVisible } from '../utils/sceneTransition.js';
import { createClickButton } from '../utils/uiButtons.js';
import { bindClickToFocus, focusGameCanvas } from '../utils/gameInput.js';

export class OnlineLobbyScene extends Phaser.Scene {
  constructor() {
    super('OnlineLobbyScene');
  }

  init(data) {
    this.playerSide = data.playerSide ?? 'hero';
    this.hostSide = this.playerSide;
    this.guestSide = getOpposingFaction(this.hostSide);
    this.mode = 'online';
    this._unsubs = [];
    this.statusText = null;
    this.codeText = null;
    this.joinInput = null;
    this.waiting = false;
    this.peerConnected = false;
    this._launched = false;
    this.sideButtons = {};
  }

  create() {
    resetSceneTransition(this);
    ensureSceneVisible(this);
    this.cameras.main.setAlpha(1);

    coverImage(this, 'ui-online-lobby', -100, 1);

    const shade = this.add.graphics().setDepth(-95);
    shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.05, 0.12, 0.78, 0.9);
    shade.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    comicTitle(this, GAME_WIDTH / 2, 48, 'ONLINE VS', { size: 40, color: UI.goldText, depth: 5 });
    label(this, GAME_WIDTH / 2, 82, 'Pick HEROES or VILLAINS · host starts the match when ready', {
      fontSize: '11px', color: UI.textMuted, depth: 5,
    });

    this.serverHint = label(this, GAME_WIDTH / 2, 104, `Relay: ${getOnlineWsUrl()}`, {
      fontSize: '8px', color: UI.textDim, depth: 5,
    });

    this.statusText = label(this, GAME_WIDTH / 2, 130, '', {
      fontSize: '12px', color: UI.text, align: 'center', wordWrap: { width: 560 }, depth: 10,
    });

    this.codeText = label(this, GAME_WIDTH / 2, 200, '', {
      fontSize: '42px', color: UI.goldText, letterSpacing: 8, depth: 10,
    });

    this.buildFactionRow('YOUR FACTION', GAME_WIDTH / 2 - 140, 248, 'local');
    this.opponentSideLabel = label(this, GAME_WIDTH / 2 + 140, 232, 'OPPONENT', {
      fontSize: '9px', color: UI.textDim, letterSpacing: 2, depth: 10,
    });
    this.opponentFactionLabel = label(this, GAME_WIDTH / 2 + 140, 258, '', {
      fontSize: '14px', color: UI.text, letterSpacing: 2, depth: 10,
    });
    this.renderFactionLabels();

    this.createRoomBtn = createClickButton(this, GAME_WIDTH / 2 - 120, 308, 'CREATE ROOM', () => this.createRoom(), {
      width: 180, height: 44, depth: 12,
    });

    label(this, GAME_WIDTH / 2, 370, '— or join with a code —', {
      fontSize: '10px', color: UI.textDim, depth: 10,
    });

    this.joinValue = '';
    this.joinDisplay = label(this, GAME_WIDTH / 2, 408, 'ENTER CODE', {
      fontSize: '28px', color: UI.text, letterSpacing: 6, depth: 10,
    });

    const keys = ['A','B','C','D','E','F','G','H','J','K','L','M','N','P','Q','R','S','T','U','V','W','X','Y','Z','2','3','4','5','6','7','8','9'];
    const startX = GAME_WIDTH / 2 - 240;
    keys.forEach((key, i) => {
      const col = i % 10;
      const row = Math.floor(i / 10);
      createClickButton(this, startX + col * 48, 450 + row * 34, key, () => this.appendCode(key), {
        width: 40, height: 28, fontSize: '11px', depth: 12, sfx: 'move',
      });
    });

    createClickButton(this, GAME_WIDTH / 2 + 200, 450, 'DEL', () => this.backspaceCode(), {
      width: 56, height: 28, fontSize: '10px', depth: 12, sfx: 'move',
    });

    createClickButton(this, GAME_WIDTH / 2, 530, 'JOIN ROOM', () => this.joinRoom(), {
      width: 160, height: 40, depth: 12,
    });

    this.startMatchBtn = createClickButton(this, GAME_WIDTH / 2 - 120, 308, 'START MATCH', () => this.beginMatch(), {
      width: 180, height: 44, depth: 12,
    });
    this.startMatchBtn.setEnabled(false);
    this.startMatchBtn.container.setVisible(false);

    createClickButton(this, GAME_WIDTH - 56, GAME_HEIGHT - 48, 'SET RELAY', () => this.editRelayUrl(), {
      width: 100, height: 36, depth: 12, sfx: 'move', fontSize: '9px',
    });

    createClickButton(this, 56, GAME_HEIGHT - 48, 'BACK', () => this.goBack(), {
      width: 90, height: 36, depth: 12, sfx: 'move',
    });

    this._unsubs.push(onOnlineEvent('peer_joined', () => this.onPeerJoined()));
    this._unsubs.push(onOnlineEvent('peer_left', () => this.onPeerLeft()));
    this._unsubs.push(onOnlineEvent('disconnected', () => this.setStatus('Connection lost')));
    this._unsubs.push(onOnlineEvent('relay:side_pick', (msg) => this.onRemoteSidePick(msg)));
    this._unsubs.push(onOnlineEvent('relay:goto_charselect', (data) => {
      this.launchCharacterSelect(data);
    }));

    ensureGameMusic();
    focusGameCanvas(this.game);
    bindClickToFocus(this);
    this.setStatus('Create a room or enter your friend\'s code.\n(use npm run dev — starts relay automatically)');
    this.cameras.main.fadeIn(250);
  }

  editRelayUrl() {
    const current = getOnlineWsUrl();
    const next = window.prompt(
      'Relay server WebSocket URL.\nBoth players must use the SAME URL.\n\nLocal: ws://127.0.0.1:8787\nInternet: wss://your-relay.onrender.com',
      current,
    );
    if (next == null) return;
    setOnlineRelayUrl(next.trim());
    this.serverHint?.setText(`Relay: ${getOnlineWsUrl()}`);
    this.setStatus(next.trim()
      ? 'Relay URL saved. Share this exact URL with your friend (SET RELAY on their game too).'
      : 'Using default relay URL.');
  }

  setStatus(text) {
    this.statusText?.setText(text);
  }

  localSide() {
    return isOnlineHost() ? this.hostSide : this.guestSide;
  }

  setLocalSide(side) {
    if (isOnlineHost()) this.hostSide = side;
    else this.guestSide = side;
    this.renderFactionLabels();
    sendOnline('side_pick', {
      role: isOnlineHost() ? 'host' : 'guest',
      side,
    });
  }

  onRemoteSidePick(msg) {
    if (msg.role === 'host') this.hostSide = msg.side;
    else if (msg.role === 'guest') this.guestSide = msg.side;
    this.renderFactionLabels();
  }

  buildFactionRow(caption, cx, y, key) {
    label(this, cx, y - 22, caption, {
      fontSize: '9px', color: UI.textDim, letterSpacing: 2, depth: 10,
    });
    const heroBtn = createClickButton(this, cx - 56, y + 8, 'HEROES', () => {
      this.setLocalSide('hero');
    }, { width: 96, height: 30, fontSize: '10px', depth: 12, sfx: 'move' });
    const villainBtn = createClickButton(this, cx + 56, y + 8, 'VILLAINS', () => {
      this.setLocalSide('villain');
    }, { width: 96, height: 30, fontSize: '10px', depth: 12, sfx: 'move' });
    this.sideButtons[key] = { hero: heroBtn, villain: villainBtn };
  }

  renderFactionLabels() {
    const local = this.localSide();
    for (const side of ['hero', 'villain']) {
      const active = local === side;
      const btns = this.sideButtons.local;
      if (!btns) continue;
      const btn = btns[side];
      btn.bg.setFillStyle(active ? 0x18121e : 0x0c0a12, active ? 0.98 : 0.82);
      btn.bg.setStrokeStyle(active ? 3 : 1, active ? UI.gold : 0xffffff, active ? 1 : 0.35);
      btn.text.setColor(active ? rgba(side === 'hero' ? UI.hero : UI.villain) : UI.textMuted);
    }

    const remoteSide = isOnlineHost() ? this.guestSide : this.hostSide;
    const remoteLabel = remoteSide === 'hero' ? 'HEROES' : 'VILLAINS';
    this.opponentFactionLabel?.setText(this.peerConnected ? remoteLabel : '—');
    this.opponentFactionLabel?.setColor(rgba(remoteSide === 'hero' ? UI.hero : UI.villain));
  }

  appendCode(ch) {
    if (this.waiting || this.joinValue.length >= 6) return;
    SFX.uiMove();
    this.joinValue += ch;
    this.joinDisplay.setText(this.joinValue.padEnd(6, '·'));
  }

  backspaceCode() {
    if (this.waiting || !this.joinValue.length) return;
    SFX.uiMove();
    this.joinValue = this.joinValue.slice(0, -1);
    this.joinDisplay.setText(this.joinValue.length ? this.joinValue : 'ENTER CODE');
  }

  async createRoom() {
    if (this.waiting) return;
    try {
      this.setStatus('Creating room…');
      const data = await createOnlineRoom(getOnlineWsUrl());
      this.waiting = true;
      this.codeText.setText(data.code);
      this.createRoomBtn?.container.setVisible(false);
      this.startMatchBtn?.container.setVisible(true);
      this.setStatus('Share this code with your friend.\nPick your faction · START when they join.');
      SFX.uiConfirm();
    } catch (err) {
      const msg = err.message ?? 'Could not create room';
      this.setStatus(msg.replace(/\n/g, '\n'));
    }
  }

  async joinRoom() {
    if (this.waiting) return;
    if (this.joinValue.length < 4) {
      this.setStatus('Enter the room code from your friend');
      return;
    }
    try {
      this.setStatus('Joining room…');
      await joinOnlineRoom(this.joinValue, getOnlineWsUrl());
      this.waiting = true;
      this.codeText.setText(this.joinValue);
      this.setStatus('Connected! Pick your faction · wait for host to start.');
      sendOnline('side_pick', { role: 'guest', side: this.guestSide });
      SFX.uiConfirm();
    } catch (err) {
      this.setStatus(err.message ?? 'Could not join room');
    }
  }

  onPeerJoined() {
    if (!isOnlineHost()) return;
    this.peerConnected = true;
    sendOnline('side_pick', { role: 'host', side: this.hostSide });
    this.renderFactionLabels();
    this.startMatchBtn?.setEnabled(true);
    this.setStatus(`Friend joined! Pick factions, then START MATCH.\nCode: ${getRoomCode()}`);
    SFX.uiConfirm();
  }

  onPeerLeft() {
    this.setStatus('Your friend disconnected');
    this.waiting = false;
    this.peerConnected = false;
    this.startMatchBtn?.setEnabled(false);
    this.renderFactionLabels();
  }

  beginMatch() {
    if (!isOnlineHost() || !this.peerConnected || this._launched) return;
    SFX.uiConfirm();
    sendOnline('goto_charselect', {
      hostSide: this.hostSide,
      guestSide: this.guestSide,
      playerSide: this.hostSide,
    });
    this.launchCharacterSelect({
      hostSide: this.hostSide,
      guestSide: this.guestSide,
      playerSide: this.hostSide,
    });
  }

  launchCharacterSelect(data = {}) {
    if (this._launched) return;
    this._launched = true;
    const hostSide = data.hostSide ?? this.hostSide ?? this.playerSide;
    const guestSide = data.guestSide ?? this.guestSide ?? getOpposingFaction(hostSide);
    safeSceneStart(this, 'CharacterSelectScene', {
      mode: 'online',
      hostSide,
      guestSide,
      playerSide: hostSide,
      onlineRole: isOnlineHost() ? 'host' : 'guest',
    }, { fadeMs: 280 });
  }

  goBack() {
    leaveOnlineRoom();
    safeSceneStart(this, 'MenuScene', {}, { fadeMs: 200 });
  }

  shutdown() {
    for (const off of this._unsubs) off();
    this._unsubs = [];
    resetSceneTransition(this);
  }
}
