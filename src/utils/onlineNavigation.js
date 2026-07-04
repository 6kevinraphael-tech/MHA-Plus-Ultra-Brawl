/**
 * Global online scene routing — relay messages are handled here so they
 * are not dropped when a scene is mid-fade (_transitioning).
 */
import { isOnlineHost, onOnlineEvent } from './onlineSession.js';
import { resetSceneTransition, safeSceneStart } from './sceneTransition.js';

let gameRef = null;
let installed = false;
let unsubs = [];

function activeScene() {
  const scenes = gameRef?.scene?.getScenes(true);
  return scenes?.[0] ?? null;
}

function goToStageSelect(msg) {
  const scene = activeScene();
  if (!scene) return;

  resetSceneTransition(scene);
  safeSceneStart(scene, 'StageSelectScene', {
    p1: msg.p1,
    p2: msg.p2,
    mode: 'online',
    playerSide: msg.playerSide ?? msg.hostSide ?? 'hero',
    hostSide: msg.hostSide ?? msg.playerSide ?? 'hero',
    guestSide: msg.guestSide,
    onlineRole: isOnlineHost() ? 'host' : 'guest',
  }, { fadeMs: 180 });
}

function goToBattle(msg) {
  const scene = activeScene();
  if (!scene) return;

  const { kind, ...rest } = msg;
  if (rest.stageId) scene.game.registry.set('stageId', rest.stageId);
  resetSceneTransition(scene);
  safeSceneStart(scene, 'BattleScene', {
    ...rest,
    mode: rest.mode ?? 'online',
    onlineRole: isOnlineHost() ? 'host' : 'guest',
  }, { fadeMs: 350 });
}

export function installOnlineNavigation(game) {
  if (installed || !game) return;
  installed = true;
  gameRef = game;

  unsubs.push(onOnlineEvent('relay:goto_stage', (msg) => {
    if (isOnlineHost()) return;
    goToStageSelect(msg);
  }));

  unsubs.push(onOnlineEvent('relay:goto_battle', (msg) => {
    if (isOnlineHost()) return;
    goToBattle(msg);
  }));
}

export function uninstallOnlineNavigation() {
  for (const off of unsubs) off();
  unsubs = [];
  installed = false;
  gameRef = null;
}
