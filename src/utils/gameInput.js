export const CONFIRM_KEYS = ['ENTER', 'SPACE', 'NUMPAD_ENTER'];

/** Keep keyboard events on the Phaser canvas (required in most browsers). */
export function focusGameCanvas(game) {
  const canvas = game?.canvas;
  if (!canvas) return;
  canvas.setAttribute('tabindex', '0');
  canvas.style.outline = 'none';
  if (document.activeElement !== canvas) {
    canvas.focus({ preventScroll: true });
  }
}

/** Bind Enter / Space / Numpad Enter; returns an unbind function for shutdown. */
export function bindConfirmKeys(scene, callback) {
  focusGameCanvas(scene.game);
  if (scene.input.keyboard) scene.input.keyboard.enabled = true;

  let lastFire = 0;
  const fire = () => {
    const now = performance.now();
    if (now - lastFire < 180) return;
    lastFire = now;
    callback();
  };

  const phaserHandler = () => fire();
  CONFIRM_KEYS.forEach((key) => {
    scene.input.keyboard?.on(`keydown-${key}`, phaserHandler);
  });

  const domHandler = (e) => {
    if (e.code !== 'Enter' && e.code !== 'Space' && e.code !== 'NumpadEnter') return;
    if (document.activeElement === scene.game.canvas) return;
    e.preventDefault();
    fire();
  };
  window.addEventListener('keydown', domHandler);

  return () => {
    CONFIRM_KEYS.forEach((key) => {
      scene.input.keyboard?.off(`keydown-${key}`, phaserHandler);
    });
    window.removeEventListener('keydown', domHandler);
  };
}

/** Click once to focus — show on menus so keyboard works reliably. */
export function bindClickToFocus(scene) {
  const focus = () => focusGameCanvas(scene.game);
  scene.input.on('pointerdown', focus);
  return () => scene.input.off('pointerdown', focus);
}

export function confirmKeyLabel() {
  return 'ENTER or SPACE';
}
