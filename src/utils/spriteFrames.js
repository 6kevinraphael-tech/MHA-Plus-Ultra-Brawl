import Phaser from 'phaser';
import {
  getSpriteDef,
  getAnimFrames,
  getAnimMs,
  getBattleFrameKey,
} from '../data/characterSprites.js';
import { getPortraitFrameKey } from '../data/portraitFrames.js';
import { applyBattlePixelFilter } from '../data/battleFrames.js';
import {
  hasImageSprites,
  getImageDef,
  getPose,
  getPortraitPose,
} from '../data/characterImages.js';

export { hasImageSprites };

const opaqueTrimCache = new Map();
/** Alpha used only to measure content bounds — never crops the image. */
const ALPHA_BOUNDS = 12;
const TRIM_PAD = 4;

/** Scale image to fill a box (cover) or fit inside (contain). Always resets scale first. */
export function fitCropToBox(image, cropW, cropH, boxW, boxH, mode = 'contain') {
  if (!cropW || !cropH || !boxW || !boxH) return;

  image.setScale(1, 1);

  const cropAspect = cropW / cropH;
  const boxAspect = boxW / boxH;

  if (mode === 'cover') {
    if (cropAspect > boxAspect) {
      image.setDisplaySize(boxH * cropAspect, boxH);
    } else {
      image.setDisplaySize(boxW, boxW / cropAspect);
    }
    return;
  }

  if (cropAspect > boxAspect) {
    image.setDisplaySize(boxW, boxW / cropAspect);
  } else {
    image.setDisplaySize(boxH * cropAspect, boxH);
  }
}

/** Trim transparent padding from a loaded PNG (cached per texture key). */
function getOpaqueTrim(scene, textureKey) {
  if (opaqueTrimCache.has(textureKey)) return opaqueTrimCache.get(textureKey);

  const texture = scene.textures.get(textureKey);
  const source = texture?.source?.[0];
  if (!source?.image) return null;

  let canvas;
  const img = source.image;
  if (img instanceof HTMLCanvasElement) {
    canvas = img;
  } else if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
    canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
  } else {
    return null;
  }

  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, w, h).data;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] > ALPHA_BOUNDS) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX > maxX) return null;

  const trim = {
    x: Math.max(0, minX - TRIM_PAD),
    y: Math.max(0, minY - TRIM_PAD),
    w: Math.min(w, maxX - minX + 1 + TRIM_PAD * 2),
    h: Math.min(h, maxY - minY + 1 + TRIM_PAD * 2),
  };
  opaqueTrimCache.set(textureKey, trim);
  return trim;
}

/** Content size for scaling — does NOT crop pixels (avoids clipping hair/VFX). */
function getContentSize(scene, textureKey, fallbackW, fallbackH) {
  const trim = getOpaqueTrim(scene, textureKey);
  if (!trim) return { w: fallbackW, h: fallbackH };
  return { w: trim.w, h: trim.h };
}

function clearImageCrop(image) {
  if (image.frame) {
    image.setCrop(0, 0, image.frame.width, image.frame.height);
  }
}

function fitBattleFrame(image, spriteDef) {
  const frame = image.frame;
  if (!frame || !spriteDef) return;
  const displayH = spriteDef.displayH ?? 145;
  fitCropToBox(image, frame.width, frame.height, displayH * (frame.width / frame.height), displayH, 'contain');
}

function resolveBattleTexture(character, animName, frameIndex) {
  const spriteDef = getSpriteDef(character.id);
  if (!spriteDef) return null;

  const frames = getAnimFrames(spriteDef, animName);
  if (frames.length === 0) return null;

  const index = frameIndex % frames.length;
  const frameKey = getBattleFrameKey(character.id, animName, index);
  const sheet = spriteDef.sheet;

  return { spriteDef, sheet, frameKey, index };
}

function applyBattleFrame(image, character, animName, frameIndex) {
  const resolved = resolveBattleTexture(character, animName, frameIndex);
  if (!resolved) return false;

  const { spriteDef, sheet, frameKey } = resolved;
  const tex = image.scene.textures.get(sheet);
  if (!tex?.has(frameKey)) return false;

  applyBattlePixelFilter(image.scene, sheet);
  image.setTexture(sheet, frameKey);
  fitBattleFrame(image, spriteDef);
  return true;
}

function boxSizeForCharacter(character, boxH) {
  const def = getImageDef(character.id);
  return {
    boxH: def?.displayH ?? boxH,
    boxW: def?.displayW ?? Math.round((def?.displayH ?? boxH) * 0.72),
  };
}

/* ---------- whole-image pose characters ---------- */

function applyImagePose(image, character, animName, form = 'base') {
  const def = getImageDef(character.id);
  const pose = getPose(character.id, animName, form ?? 'base');
  if (!def || !pose || !image.scene.textures.exists(pose.key)) return false;

  image.scene.textures.get(pose.key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  image.setTexture(pose.key);
  image.setScale(1, 1);
  image.setAlpha(1);
  image.clearTint();
  clearImageCrop(image);

  const { boxW, boxH } = boxSizeForCharacter(character, def.displayH);
  fitCropToBox(image, image.frame.width, image.frame.height, boxW, boxH, 'contain');

  const poseScale = pose.displayScale ?? pose.scale ?? 1;
  if (poseScale !== 1) {
    image.setDisplaySize(image.displayWidth * poseScale, image.displayHeight * poseScale);
  }
  return true;
}

/** Battle fighter — single frame from pre-registered sprite sheet sub-frame */
export function createCharacterSprite(scene, x, y, character, animName = 'idle', frameIndex = 0, form = null) {
  if (hasImageSprites(character.id)) {
    const pose = getPose(character.id, animName, form);
    if (!pose || !scene.textures.exists(pose.key)) return null;
    const image = scene.add.image(x, y, pose.key);
    applyImagePose(image, character, animName, form);
    image.setOrigin(0.5, 1);
    return image;
  }

  const spriteDef = getSpriteDef(character.id);
  if (!spriteDef || !scene.textures.exists(spriteDef.sheet)) return null;

  const resolved = resolveBattleTexture(character, animName, frameIndex);
  if (!resolved) return null;

  applyBattlePixelFilter(scene, resolved.sheet);
  const image = scene.add.image(x, y, resolved.sheet, resolved.frameKey);
  fitBattleFrame(image, spriteDef);
  image.setOrigin(0.5, 1);
  return image;
}

export function createCharacterSpriteInContainer(scene, container, x, y, character, animName = 'idle', frameIndex = 0, form = null) {
  const sprite = createCharacterSprite(scene, x, y, character, animName, frameIndex, form);
  if (sprite && container) container.add(sprite);
  return sprite;
}

export function updateCharacterSprite(image, character, animName = 'idle', frameIndex = 0, form = null) {
  if (!image || !character) return;
  if (hasImageSprites(character.id)) {
    applyImagePose(image, character, animName, form);
    return;
  }
  applyBattleFrame(image, character, animName, frameIndex);
}

export function getCharacterAnimMs(character, animName) {
  if (hasImageSprites(character.id)) return 150;
  return getAnimMs(getSpriteDef(character.id), animName);
}

export function getCharacterAnimFrameCount(character, animName) {
  if (hasImageSprites(character.id)) return 1;
  return getAnimFrames(getSpriteDef(character.id), animName).length;
}

function fitPortraitFrame(image, boxW, boxH) {
  const frame = image.frame;
  if (!frame) return;
  image.setAlpha(1);
  image.clearTint?.();
  clearImageCrop(image);
  fitCropToBox(image, frame.width, frame.height, boxW, boxH, 'contain');
}

/** Character select — portrait from pre-registered roster sub-frame */
export function createPortraitImage(scene, x, y, character, displayW, displayH) {
  if (hasImageSprites(character.id)) {
    const pose = getPortraitPose(character.id);
    if (!pose || !scene.textures.exists(pose.key)) return null;
    scene.textures.get(pose.key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const image = scene.add.image(x, y, pose.key);
    fitPortraitFrame(image, displayW, displayH);
    image.setOrigin(0.5, 0.5);
    image.setAlpha(1);
    return image;
  }

  if (!character?.roster || !scene.textures.exists(character.roster)) return null;

  const frameKey = getPortraitFrameKey(character.id);
  const tex = scene.textures.get(character.roster);
  if (!tex?.has(frameKey)) return null;

  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  const image = scene.add.image(x, y, character.roster, frameKey);
  fitPortraitFrame(image, displayW, displayH);
  image.setOrigin(0.5, 0.5);
  return image;
}

export function updatePortraitImage(image, character, displayW, displayH) {
  if (!image || !character) return;

  if (hasImageSprites(character.id)) {
    const pose = getPortraitPose(character.id);
    if (!pose || !image.scene.textures.exists(pose.key)) return;
    image.setTexture(pose.key);
    fitPortraitFrame(image, displayW, displayH);
    return;
  }

  const frameKey = getPortraitFrameKey(character.id);
  const tex = image.scene.textures.get(character.roster);
  if (!tex?.has(frameKey)) return;

  image.setTexture(character.roster, frameKey);
  fitPortraitFrame(image, displayW, displayH);
}

export function addPortraitToBox(scene, container, character, x, y, boxW, boxH) {
  const portrait = createPortraitImage(scene, x, y, character, boxW, boxH);
  if (portrait && container) container.add(portrait);
  return portrait;
}

/** Full-body standee for character select center clash. */
export function createSelectStandee(scene, x, y, character, flipX = false, boxH = 300) {
  if (!hasImageSprites(character.id)) return null;
  const pose = getPose(character.id, 'idle');
  if (!pose || !scene.textures.exists(pose.key)) return null;

  scene.textures.get(pose.key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const img = scene.add.image(x, y, pose.key);
  img.setScale(1);
  img.setAlpha(1);
  clearImageCrop(img);

  const frame = img.frame;
  const boxW = Math.round(boxH * 0.72);
  fitCropToBox(img, frame.width, frame.height, boxW, boxH, 'contain');
  img.setOrigin(0.5, 1);
  img.setFlipX(flipX);
  return img;
}

export function updateSelectStandee(img, character, flipX = false, boxH = 300) {
  if (!img || !character || !hasImageSprites(character.id)) return;
  const pose = getPose(character.id, 'idle');
  if (!pose || !img.scene.textures.exists(pose.key)) return;
  img.setTexture(pose.key);
  img.setScale(1);
  img.setAlpha(1);
  clearImageCrop(img);

  const boxW = Math.round(boxH * 0.72);
  fitCropToBox(img, img.frame.width, img.frame.height, boxW, boxH, 'contain');
  img.setFlipX(flipX);
}
