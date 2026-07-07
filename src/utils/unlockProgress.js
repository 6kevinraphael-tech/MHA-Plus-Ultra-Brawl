/**
 * Persistent unlock & campaign progress (localStorage).
 */
import { HERO_CHARACTERS, VILLAIN_CHARACTERS } from '../data/characters.js';

const STORAGE_KEY = 'cursed-clash-progress-v1';

const DEFAULT_PROGRESS = {
  unlockedHeroes: ['deku', 'uraraka'],
  unlockedVillains: ['shigaraki', 'dabi'],
  unlockedStages: ['ua-entrance'],
  campaign: {
    hero: { stageIndex: 0, complete: false },
    villain: { stageIndex: 0, complete: false },
  },
  secretUnlocked: false,
};

const LEGACY_STAGE_IDS = {
  'ua-high': 'ua-entrance',
  'blue-flames': 'city-streets',
  ruins: 'ground-beta',
};

const ALL_STAGE_IDS = [
  'ua-entrance',
  'ua-campus',
  'city-streets',
  'dojo',
  'ground-beta',
  'forest-camp',
];

let cache = null;

function normalizeStageId(stageId) {
  return LEGACY_STAGE_IDS[stageId] ?? stageId;
}


function readRaw() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeRaw(data) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

export function loadProgress() {
  if (cache) return cache;
  const saved = readRaw();
  cache = {
    ...DEFAULT_PROGRESS,
    ...saved,
    campaign: {
      hero: { ...DEFAULT_PROGRESS.campaign.hero, ...saved?.campaign?.hero },
      villain: { ...DEFAULT_PROGRESS.campaign.villain, ...saved?.campaign?.villain },
    },
    unlockedHeroes: saved?.unlockedHeroes ?? [...DEFAULT_PROGRESS.unlockedHeroes],
    unlockedVillains: saved?.unlockedVillains ?? [...DEFAULT_PROGRESS.unlockedVillains],
    unlockedStages: saved?.unlockedStages ?? [...DEFAULT_PROGRESS.unlockedStages],
  };
  return cache;
}

export function saveProgress(data = cache) {
  cache = data;
  writeRaw(data);
}

export function resetProgress() {
  cache = JSON.parse(JSON.stringify(DEFAULT_PROGRESS));
  writeRaw(cache);
  return cache;
}

export function getUnlockedIds(faction) {
  const p = loadProgress();
  if (p.secretUnlocked) {
    return (faction === 'villain' ? VILLAIN_CHARACTERS : HERO_CHARACTERS).map((c) => c.id);
  }
  return faction === 'villain' ? [...p.unlockedVillains] : [...p.unlockedHeroes];
}

export function isCharacterUnlocked(id) {
  const p = loadProgress();
  if (p.secretUnlocked) return true;
  const hero = HERO_CHARACTERS.some((c) => c.id === id);
  const list = hero ? p.unlockedHeroes : p.unlockedVillains;
  return list.includes(id);
}

export function isStageUnlocked(stageId) {
  const p = loadProgress();
  const resolved = normalizeStageId(stageId);
  if (p.secretUnlocked) return true;
  return p.unlockedStages.some((id) => normalizeStageId(id) === resolved);
}

export function unlockCharacter(id) {
  const p = loadProgress();
  const isHero = HERO_CHARACTERS.some((c) => c.id === id);
  const key = isHero ? 'unlockedHeroes' : 'unlockedVillains';
  if (!p[key].includes(id)) {
    p[key] = [...p[key], id];
    saveProgress(p);
    return true;
  }
  return false;
}

export function unlockStage(stageId) {
  const p = loadProgress();
  const resolved = normalizeStageId(stageId);
  if (!p.unlockedStages.some((id) => normalizeStageId(id) === resolved)) {
    p.unlockedStages = [...p.unlockedStages, resolved];
    saveProgress(p);
    return true;
  }
  return false;
}

export function getCampaignState(side) {
  const p = loadProgress();
  return p.campaign[side] ?? { stageIndex: 0, complete: false };
}

export function setCampaignProgress(side, stageIndex, complete = false) {
  const p = loadProgress();
  p.campaign[side] = { stageIndex, complete };
  if (complete && p.campaign.hero.complete && p.campaign.villain.complete) {
    p.secretUnlocked = true;
    p.unlockedHeroes = HERO_CHARACTERS.map((c) => c.id);
    p.unlockedVillains = VILLAIN_CHARACTERS.map((c) => c.id);
    p.unlockedStages = [...ALL_STAGE_IDS];
  }
  saveProgress(p);
  return p;
}

export function getUnlockStats() {
  const p = loadProgress();
  return {
    heroes: p.unlockedHeroes.length,
    villains: p.unlockedVillains.length,
    totalHeroes: HERO_CHARACTERS.length,
    totalVillains: VILLAIN_CHARACTERS.length,
    secretUnlocked: p.secretUnlocked,
    heroCampaignComplete: p.campaign.hero.complete,
    villainCampaignComplete: p.campaign.villain.complete,
  };
}
