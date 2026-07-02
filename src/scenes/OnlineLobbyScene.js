import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../data/characters.js';
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
import { comicTitle, label, UI } from '../utils/uiTheme.js';
import { resetSceneTransition, safeSceneStart, ensureSceneVisible } from '../utils/sceneTransition.js';
import { createClickButton } from '../utils/uiButtons.js';
import { bindClickToFocus, focusGameCanvas } from '../utils/gameInput.js';

export class OnlineLobbyScene extends Phaser.Scene {
  constructor() {
    super('OnlineLobbyScene');
  }

  init(data) {
    this.playerSide = data.playerSide ?? 'hero';
    this.mode = 'online';
    this._unsubs = [];
    this.statusText = null;
    this.codeText = null;
    this.joinInput = null;
    this.waiting = false;
  }

  create() {
    resetSceneTransition(this);
    ensureSceneVisible(this);
    this.cameras.main.setAlpha(1);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x06080f).setDepth(-10);
    comicTitle(this, GAME_WIDTH / 2, 48, 'ONLINE VS', { size: 40, color: UI.goldText, depth: 5 });
    label(this, GAME_WIDTH / 2, 82, 'Works across different Wi‑Fi / internet — share a room code', {
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

    createClickButton(this, GAME_WIDTH / 2 - 120, 280, 'CREATE ROOM', () => this.createRoom(), {
      width: 180, height: 44, depth: 12,
    });

    label(this, GAME_WIDTH / 2, 340, '— or join with a code —', {
      fontSize: '10px', color: UI.textDim, depth: 10,
    });

    this.joinValue = '';
    this.joinDisplay = label(this, GAME_WIDTH / 2, 378, 'ENTER CODE', {
      fontSize: '28px', color: UI.text, letterSpacing: 6, depth: 10,
    });

    const keys = ['A','B','C','D','E','F','G','H','J','K','L','M','N','P','Q','R','S','T','U','V','W','X','Y','Z','2','3','4','5','6','7','8','9'];
    const startX = GAME_WIDTH / 2 - 240;
    keys.forEach((key, i) => {
      const col = i % 10;
      const row = Math.floor(i / 10);
      createClickButton(this, startX + col * 48, 420 + row * 34, key, () => this.appendCode(key), {
        width: 40, height: 28, fontSize: '11px', depth: 12, sfx: 'move',
      });
    });

    createClickButton(this, GAME_WIDTH / 2 + 200, 420, 'DEL', () => this.backspaceCode(), {
      width: 56, height: 28, fontSize: '10px', depth: 12, sfx: 'move',
    });

    createClickButton(this, GAME_WIDTH / 2, 500, 'JOIN ROOM', () => this.joinRoom(), {
      width: 160, height: 40, depth: 12,
    });

    createClickButton(this, GAME_WIDTH - 56, GAME_HEIGHT - 48, 'SET RELAY', () => this.editRelayUrl(), {
      width: 100, height: 36, depth: 12, sfx: 'move', fontSize: '9px',
    });

    createClickButton(this, 56, GAME_HEIGHT - 48, 'BACK', () => this.goBack(), {
      width: 90, height: 36, depth: 12, sfx: 'move',
    });

    this._unsubs.push(onOnlineEvent('peer_joined', () => this.onPeerJoined()));
    this._unsubs.push(onOnlineEvent('peer_left', () => this.onPeerLeft()));
    this._unsubs.push(onOnlineEvent('disconnected', () => this.setStatus('Connection lost')));
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
      this.setStatus('Share this code with your friend.\nWaiting for them to join…');
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
      this.setStatus('Connected! Waiting for host to start…');
      SFX.uiConfirm();
    } catch (err) {
      this.setStatus(err.message ?? 'Could not join room');
    }
  }

  onPeerJoined() {
    if (!isOnlineHost()) return;
    this.setStatus(`Friend joined! Starting…\nCode: ${getRoomCode()}`);
    SFX.uiConfirm();
    sendOnline('goto_charselect', { playerSide: this.playerSide });
    this.time.delayedCall(400, () => this.launchCharacterSelect());
  }

  onPeerLeft() {
    this.setStatus('Your friend disconnected');
    this.waiting = false;
  }

  launchCharacterSelect(data = {}) {
    if (this._launched) return;
    this._launched = true;
    safeSceneStart(this, 'CharacterSelectScene', {
      mode: 'online',
      playerSide: data.playerSide ?? this.playerSide,
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
