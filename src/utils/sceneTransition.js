/**
 * Guarded scene transitions — prevents double-starts and orphaned fade timers.
 */
import Phaser from 'phaser';

const TRANSITION_WATCHDOG_MS = 1200;

export function resetSceneTransition(scene) {
  if (!scene) return;
  scene._transitioning = false;
  scene._transitionTimer?.remove();
  scene._transitionTimer = null;
  scene._transitionWatchdog?.remove();
  scene._transitionWatchdog = null;
  scene._transitionFadeHandler?.();
  scene._transitionFadeHandler = null;
}

/** Call at the start of every scene init/create to recover from stuck fades. */
export function beginScene(scene) {
  resetSceneTransition(scene);
  ensureSceneVisible(scene);
  if (scene.tweens) scene.tweens.timeScale = 1;
  if (scene.physics?.world) scene.physics.world.timeScale = 1;
}

/** Ensure the scene camera is visible (fixes stuck black fades). */
export function ensureSceneVisible(scene) {
  if (!scene?.cameras?.main) return;
  const cam = scene.cameras.main;
  cam.setAlpha(1);
  cam.setVisible(true);
  cam.resetFX();
}

function clearCameraFade(cam) {
  if (!cam) return;
  cam.resetFX();
  cam.setAlpha(1);
}

export function safeSceneStart(scene, key, data = {}, { fadeMs = 0 } = {}) {
  if (!scene?.scene) return;

  if (scene._transitioning) {
    console.warn('[sceneTransition] recovering stuck transition →', key);
    resetSceneTransition(scene);
  }

  scene._transitionTimer?.remove();
  scene._transitionWatchdog?.remove();
  scene._transitionFadeHandler?.();

  const cam = scene.cameras.main;
  if (scene.tweens) scene.tweens.timeScale = 1;
  if (scene.physics?.world) scene.physics.world.timeScale = 1;
  clearCameraFade(cam);

  scene._transitioning = true;

  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    scene._transitionTimer?.remove();
    scene._transitionTimer = null;
    scene._transitionWatchdog?.remove();
    scene._transitionWatchdog = null;
    scene._transitionFadeHandler?.();
    scene._transitionFadeHandler = null;
    scene._transitioning = false;
    if (scene.tweens) scene.tweens.timeScale = 1;
    if (scene.physics?.world) scene.physics.world.timeScale = 1;
    clearCameraFade(cam);
    scene.scene.start(key, data);
  };

  scene._transitionWatchdog = scene.time.delayedCall(TRANSITION_WATCHDOG_MS, () => {
    if (!scene._transitioning) return;
    console.warn('[sceneTransition] watchdog recovered stuck transition →', key);
    run();
  });

  if (fadeMs > 0) {
    const onFade = () => run();
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, onFade);
    scene._transitionFadeHandler = () => cam.off(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, onFade);
    cam.fadeOut(fadeMs, 0, 0, 0);
    // Timer fallback — camera fade can miss its event when alpha is already 0 or timeScale was altered.
    scene._transitionTimer = scene.time.delayedCall(fadeMs + 60, run);
  } else {
    run();
  }
}

/** Use from button handlers after overlays / slow-mo — resets FX then transitions. */
export function transitionTo(scene, key, data = {}, fadeMs = 120) {
  if (scene._transitioning) return;
  beginScene(scene);
  safeSceneStart(scene, key, data, { fadeMs });
}
