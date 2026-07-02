import { UI } from './uiTheme.js';
import { SFX } from './audio.js';

/** Clickable menu / overlay button. Returns { container, bg, text, setLabel, setEnabled }. */
export function createClickButton(scene, x, y, labelText, onClick, opts = {}) {
  const {
    width = Math.max(88, labelText.length * 7 + 32),
    height = 36,
    depth = 20,
    fontSize = '12px',
    accent = UI.gold,
    fill = 0x0c0a12,
    sfx = 'confirm',
  } = opts;

  const container = scene.add.container(x, y).setDepth(depth);
  const bg = scene.add.rectangle(0, 0, width, height, fill, 0.92);
  bg.setStrokeStyle(2, accent, 0.85);
  bg.setInteractive({ useHandCursor: true });

  const text = scene.add.text(0, 0, labelText, {
    fontFamily: UI.font,
    fontSize,
    color: UI.goldText,
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5);

  container.add([bg, text]);

  const fire = (pointer) => {
    pointer?.event?.stopPropagation?.();
    if (!bg.input?.enabled) return;
    if (sfx === 'confirm') SFX.uiConfirm();
    else if (sfx === 'move') SFX.uiMove();
    onClick();
  };

  bg.on('pointerover', () => {
    if (bg.input?.enabled) bg.setFillStyle(0x18121e, 0.98);
  });
  bg.on('pointerout', () => bg.setFillStyle(fill, 0.92));
  bg.on('pointerdown', fire);

  return {
    container,
    bg,
    text,
    setLabel: (t) => {
      text.setText(t);
    },
    setEnabled: (enabled) => {
      bg.input.enabled = enabled;
      container.setAlpha(enabled ? 1 : 0.45);
    },
  };
}

/** Horizontal row of buttons centered at (cx, cy). */
export function createButtonRow(scene, cx, cy, specs, depth = UI.overlayDepth + 3) {
  const gap = 10;
  const buttons = specs.map((spec) => createClickButton(scene, 0, 0, spec.label, spec.onClick, {
    width: spec.width,
    depth,
    accent: spec.accent ?? UI.gold,
    fontSize: spec.fontSize ?? '11px',
  }));

  const totalW = buttons.reduce((sum, b, i) => {
    const w = b.bg.width;
    return sum + w + (i > 0 ? gap : 0);
  }, 0);

  let x = cx - totalW / 2;
  for (const btn of buttons) {
    const w = btn.bg.width;
    btn.container.setPosition(x + w / 2, cy);
    x += w + gap;
  }

  return buttons;
}
