import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { StageSelectScene } from './scenes/StageSelectScene.js';
import { OnlineLobbyScene } from './scenes/OnlineLobbyScene.js';
import { CampaignScene } from './scenes/CampaignScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { GAME_WIDTH, GAME_HEIGHT } from './data/characters.js';
import { focusGameCanvas } from './utils/gameInput.js';
import { resumeAudio, ensureGameMusic, initYouTubeMusic } from './utils/audio.js';
import { installOnlineNavigation } from './utils/onlineNavigation.js';

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#06080f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  render: {
    antialias: true,
    roundPixels: true,
  },
  pause: {
    pauseOnBlur: false,
  },
  scene: [BootScene, PreloadScene, MenuScene, OnlineLobbyScene, CampaignScene, CharacterSelectScene, StageSelectScene, BattleScene],
};

function bindGameEvents(game) {
  if (game.__eventsBound) return;
  game.__eventsBound = true;

  initYouTubeMusic();

  const focus = () => focusGameCanvas(game);
  focus();
  game.canvas?.addEventListener('pointerdown', focus);
  document.getElementById('game-container')?.addEventListener('pointerdown', focus);

  const unlockAudio = () => {
    resumeAudio();
    ensureGameMusic();
    focus();
  };
  window.addEventListener('keydown', unlockAudio, { once: true });
  window.addEventListener('pointerdown', unlockAudio, { once: true });
}

function bootGame() {
  if (window.__game) {
    return window.__game;
  }

  const game = new Phaser.Game(config);
  window.__game = game;
  game.events.once('ready', () => {
    bindGameEvents(game);
    installOnlineNavigation(game);
  });
  return game;
}

const game = bootGame();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.__game?.destroy(true);
    window.__game = null;
  });
}

export default game;
