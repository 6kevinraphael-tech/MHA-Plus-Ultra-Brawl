/**
 * Whole-image pose system for characters built from individual high-res PNGs.
 * Some fighters (e.g. Shigaraki) support multiple forms via `forms` + `awakenAt`.
 */

export const CHARACTER_IMAGES = {
  deku: {
    displayH: 168,
    displayW: 124,
    portraitPose: 'idle',
    portraitForm: 'base',
    awakenAt: 1 / 3,
    awakenLabel: 'ONE FOR ALL — 100%',
    awakenTransformKey: 'img-deku-awaken-transform',
    awakenTheme: 'deku-dark',
    awakenBuff: {
      speedMult: 1.38,
      damageMult: 1.52,
      jumpMult: 1.22,
      damageTakenMult: 0.72,
    },
    forms: {
      base: {
        idle: { key: 'img-deku-idle', scale: 1.0 },
        walk: { key: 'img-deku-idle', scale: 1.0 },
        attack: { key: 'img-deku-attack', scale: 1.0 },
        heavy: { key: 'img-deku-kick', scale: 1.0 },
        special: { key: 'img-deku-kick', scale: 1.0 },
        hit: { key: 'img-deku-idle', scale: 1.0 },
      },
      awakened: {
        idle: { key: 'img-deku-awaken-idle', scale: 1.0 },
        walk: { key: 'img-deku-awaken-idle', scale: 1.0 },
        attack: { key: 'img-deku-awaken-attack', scale: 1.0 },
        heavy: { key: 'img-deku-awaken-heavy', scale: 1.0 },
        special: { key: 'img-deku-awaken-special', scale: 1.0 },
        hit: { key: 'img-deku-awaken-idle', scale: 1.0 },
      },
    },
  },
  allmight: {
    displayH: 184,
    displayW: 136,
    portraitPose: 'idle',
    poses: {
      idle: { key: 'img-allmight-idle', scale: 1.0 },
      walk: { key: 'img-allmight-idle', scale: 1.0 },
      attack: { key: 'img-allmight-attack', scale: 1.0 },
      heavy: { key: 'img-allmight-heavy', scale: 1.0 },
      special: { key: 'img-allmight-special', scale: 1.0 },
      hit: { key: 'img-allmight-idle', scale: 1.0 },
    },
  },
  todoroki: {
    displayH: 172,
    displayW: 128,
    portraitPose: 'idle',
    poses: {
      idle: { key: 'img-todoroki-idle', scale: 1.0 },
      walk: { key: 'img-todoroki-idle', scale: 1.0 },
      attack: { key: 'img-todoroki-attack', scale: 1.0 },
      heavy: { key: 'img-todoroki-heavy', scale: 1.0 },
      special: { key: 'img-todoroki-special', scale: 1.0 },
      hit: { key: 'img-todoroki-idle', scale: 1.0 },
    },
  },
  shigaraki: {
    displayH: 168,
    displayW: 124,
    portraitPose: 'idle',
    portraitForm: 'base',
    /** Awakens when HP ratio drops to or below this (1/3 health). */
    awakenAt: 1 / 3,
    awakenLabel: 'ALL FOR ONE',
    awakenTransformKey: 'img-shigaraki-awaken-transform',
    awakenTheme: 'shigaraki-afo',
    awakenBuff: {
      speedMult: 1.42,
      damageMult: 1.55,
      jumpMult: 1.24,
      damageTakenMult: 0.68,
    },
    forms: {
      base: {
        idle: { key: 'img-shigaraki-idle', scale: 1.0 },
        walk: { key: 'img-shigaraki-idle', scale: 1.0 },
        attack: { key: 'img-shigaraki-attack', scale: 1.0 },
        heavy: { key: 'img-shigaraki-heavy', scale: 1.0 },
        special: { key: 'img-shigaraki-special', scale: 1.0 },
        hit: { key: 'img-shigaraki-idle', scale: 1.0 },
      },
      awakened: {
        idle: { key: 'img-shigaraki-awaken-idle', scale: 1.0 },
        walk: { key: 'img-shigaraki-awaken-idle', scale: 1.0 },
        attack: { key: 'img-shigaraki-awaken-attack', scale: 1.0 },
        heavy: { key: 'img-shigaraki-awaken-heavy', scale: 1.0 },
        special: { key: 'img-shigaraki-awaken-special', scale: 1.0 },
        hit: { key: 'img-shigaraki-awaken-idle', scale: 1.0 },
      },
    },
  },
  allforone: {
    displayH: 182,
    displayW: 200,
    portraitPose: 'idle',
    poses: {
      idle: { key: 'img-allforone-idle', scale: 1.0 },
      walk: { key: 'img-allforone-idle', scale: 1.0 },
      attack: { key: 'img-allforone-attack', scale: 1.0 },
      heavy: { key: 'img-allforone-heavy', scale: 1.0 },
      special: { key: 'img-allforone-special', scale: 1.0 },
      hit: { key: 'img-allforone-idle', scale: 1.0 },
    },
  },
  dabi: {
    displayH: 176,
    displayW: 196,
    portraitPose: 'idle',
    poses: {
      idle: { key: 'img-dabi-idle', scale: 1.0 },
      walk: { key: 'img-dabi-idle', scale: 1.0 },
      attack: { key: 'img-dabi-attack', scale: 1.0 },
      heavy: { key: 'img-dabi-heavy', scale: 1.0 },
      special: { key: 'img-dabi-special', scale: 1.0 },
      hit: { key: 'img-dabi-idle', scale: 1.0 },
    },
  },
  stain: {
    displayH: 172,
    displayW: 188,
    portraitPose: 'idle',
    poses: {
      idle: { key: 'img-stain-idle', scale: 1.0 },
      walk: { key: 'img-stain-idle', scale: 1.0 },
      attack: { key: 'img-stain-attack', scale: 1.0 },
      heavy: { key: 'img-stain-heavy', scale: 1.0 },
      special: { key: 'img-stain-special', scale: 1.0 },
      hit: { key: 'img-stain-idle', scale: 1.0 },
    },
  },
  bakugo: {
    displayH: 170,
    displayW: 192,
    portraitPose: 'idle',
    poses: {
      idle: { key: 'img-bakugo-idle', scale: 1.0 },
      walk: { key: 'img-bakugo-idle', scale: 1.0 },
      attack: { key: 'img-bakugo-attack', scale: 1.0 },
      heavy: { key: 'img-bakugo-heavy', scale: 1.0 },
      special: { key: 'img-bakugo-special', scale: 1.0 },
      hit: { key: 'img-bakugo-idle', scale: 1.0 },
    },
  },
  twice: {
    displayH: 168,
    displayW: 190,
    portraitPose: 'idle',
    poses: {
      idle: { key: 'img-twice-idle', scale: 1.0 },
      walk: { key: 'img-twice-idle', scale: 1.0 },
      attack: { key: 'img-twice-attack', scale: 1.0 },
      heavy: { key: 'img-twice-heavy', scale: 1.0 },
      special: { key: 'img-twice-special', scale: 1.0 },
      hit: { key: 'img-twice-idle', scale: 1.0 },
    },
  },
  uraraka: {
    displayH: 166,
    displayW: 188,
    portraitPose: 'idle',
    poses: {
      idle: { key: 'img-uraraka-idle', scale: 1.0 },
      walk: { key: 'img-uraraka-idle', scale: 1.0 },
      attack: { key: 'img-uraraka-attack', scale: 1.0 },
      heavy: { key: 'img-uraraka-heavy', scale: 1.0 },
      special: { key: 'img-uraraka-special', scale: 1.0 },
      hit: { key: 'img-uraraka-idle', scale: 1.0 },
    },
  },
  overhaul: {
    displayH: 174,
    displayW: 196,
    portraitPose: 'idle',
    portraitForm: 'base',
    awakenOnSuper: true,
    awakenDurationMs: 5000,
    awakenHealRatio: 0.25,
    awakenLabel: 'OVERHAUL — FUSED FORM',
    awakenTransformKey: 'img-overhaul-awaken-transform',
    awakenTheme: 'shigaraki-afo',
    awakenBuff: {
      damageMult: 1.12,
    },
    forms: {
      base: {
        idle: { key: 'img-overhaul-idle', scale: 1.0 },
        walk: { key: 'img-overhaul-idle', scale: 1.0 },
        attack: { key: 'img-overhaul-attack', scale: 1.0 },
        heavy: { key: 'img-overhaul-heavy', scale: 1.0 },
        special: { key: 'img-overhaul-special', scale: 1.0 },
        hit: { key: 'img-overhaul-idle', scale: 1.0 },
      },
      awakened: {
        idle: { key: 'img-overhaul-awaken-idle', scale: 1.0 },
        walk: { key: 'img-overhaul-awaken-idle', scale: 1.0 },
        attack: { key: 'img-overhaul-awaken-attack', scale: 1.0 },
        heavy: { key: 'img-overhaul-awaken-heavy', scale: 1.0 },
        special: { key: 'img-overhaul-awaken-special', scale: 1.0 },
        hit: { key: 'img-overhaul-awaken-idle', scale: 1.0 },
      },
    },
  },
};

function pathFor(key) {
  const transform = key.match(/^img-([a-z]+)-awaken-transform$/);
  if (transform) return `/assets/sprites/mha/${transform[1]}/awaken-transform.png`;
  const awaken = key.match(/^img-([a-z]+)-awaken-([a-z]+)$/);
  if (awaken) return `/assets/sprites/mha/${awaken[1]}/awaken-${awaken[2]}.png`;
  const m = key.match(/^img-([a-z]+)-([a-z]+)$/);
  if (m) return `/assets/sprites/mha/${m[1]}/${m[2]}.png`;
  return null;
}

/** [textureKey, publicPath] pairs to preload. */
export const CHARACTER_IMAGE_ASSETS = (() => {
  const seen = new Map();
  for (const def of Object.values(CHARACTER_IMAGES)) {
    const poseSets = def.forms ? Object.values(def.forms) : [def.poses];
    for (const poses of poseSets) {
      for (const pose of Object.values(poses)) {
        if (!seen.has(pose.key)) seen.set(pose.key, pathFor(pose.key));
      }
    }
    if (def.awakenTransformKey) {
      const p = pathFor(def.awakenTransformKey);
      if (p && !seen.has(def.awakenTransformKey)) seen.set(def.awakenTransformKey, p);
    }
  }
  return [...seen.entries()].filter(([, p]) => p);
})();

/** All pose assets for a single fighter (for lazy loading). */
export function getAssetsForCharacter(characterId) {
  const def = CHARACTER_IMAGES[characterId];
  if (!def) return [];
  const seen = new Set();
  const out = [];

  const addKey = (key) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    const p = pathFor(key);
    if (p) out.push([key, p]);
  };

  const poseSets = def.forms ? Object.values(def.forms) : [def.poses];
  for (const poses of poseSets) {
    for (const pose of Object.values(poses)) addKey(pose.key);
  }
  if (def.awakenTransformKey) addKey(def.awakenTransformKey);
  return out;
}

/** Deduplicated assets for multiple fighters. */
export function getAssetsForCharacters(characterIds) {
  const seen = new Map();
  for (const id of characterIds) {
    for (const [key, path] of getAssetsForCharacter(id)) {
      if (!seen.has(key)) seen.set(key, path);
    }
  }
  return [...seen.entries()];
}

export function hasImageSprites(characterId) {
  return !!CHARACTER_IMAGES[characterId];
}

export function getImageDef(characterId) {
  return CHARACTER_IMAGES[characterId] ?? null;
}

/** Returns 'base' | 'awakened' | null (null = single-form or super-triggered only). */
export function getActiveForm(characterId, hpRatio) {
  const def = CHARACTER_IMAGES[characterId];
  if (!def?.forms || def.awakenAt == null || def.awakenOnSuper) return null;
  if (hpRatio <= def.awakenAt && hpRatio > 0) return 'awakened';
  return 'base';
}

export function isSuperAwakenCharacter(characterId) {
  return !!CHARACTER_IMAGES[characterId]?.awakenOnSuper;
}

export function getAwakenBuff(characterId, form) {
  const def = CHARACTER_IMAGES[characterId];
  if (form !== 'awakened' || !def?.awakenBuff) return null;
  return def.awakenBuff;
}

export function getPose(characterId, animName, form = null) {
  const def = CHARACTER_IMAGES[characterId];
  if (!def) return null;
  if (def.forms) {
    const f = form ?? 'base';
    const poses = def.forms[f] ?? def.forms.base;
    return poses[animName] ?? poses.idle;
  }
  return def.poses[animName] ?? def.poses.idle;
}

export function getPortraitPose(characterId, form = null) {
  const def = CHARACTER_IMAGES[characterId];
  if (!def) return null;
  const f = form ?? def.portraitForm ?? 'base';
  const anim = def.portraitPose ?? 'idle';
  if (def.forms) return def.forms[f]?.[anim] ?? def.forms.base?.[anim];
  return def.poses[anim] ?? def.poses.idle;
}

export function getAwakenCinematicPayload(characterId) {
  const def = CHARACTER_IMAGES[characterId];
  if (!def?.forms) return null;
  const transformKey = def.awakenTransformKey
    ?? def.forms.awakened?.idle?.key
    ?? null;
  return {
    label: def.awakenLabel ?? 'AWAKENED',
    transformKey,
    theme: def.awakenTheme ?? 'shigaraki-afo',
  };
}
