/**
 * Guarded scene transitions — prevents double-starts and orphaned fade timers.
 */
import Phaser from 'phaser';

const TRANSITION_WATCHDOG_MS = 2500;

export function resetSceneTransition(scene) {
  scene._transitioning = false;
  scene._transitionTimer?.remove();
  scene._transitionTimer = null;
  scene._transitionWatchdog?.remove();
  scene._transitionWatchdog = null;
  scene._transitionFadeHandler?.();
  scene._transitionFadeHandler = null;
}

/** Ensure the scene camera is visible (fixes stuck black fades). */
export function ensureSceneVisible(scene) {
  const cam = scene.cameras.main;
  cam.setAlpha(1);
  cam.setVisible(true);
  cam.resetFX();
}

export function safeSceneStart(scene, key, data = {}, { fadeMs = 0 } = {}) {
  if (scene._transitioning) return;

  scene._transitionTimer?.remove();
  scene._transitionWatchdog?.remove();
  scene._transitionFadeHandler?.();

  const cam = scene.cameras.main;
  cam.resetFX();
  cam.setAlpha(1);

  scene._transitioning = true;

  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    scene._transitionTimer = null;
    scene._transitionWatchdog?.remove();
    scene._transitionWatchdog = null;
    scene._transitionFadeHandler = null;
    scene._transitioning = false;
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
  } else {
    run();
  }
}
