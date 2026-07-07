import { getCharacterById } from './characters.js';
import { getArcadeDifficulty } from './arcade.js';

/** Campaign node — fixed opponent, stage, unlock reward. */
const HERO_PATH = [
  {
    id: 'h1', opponent: 'stain', unlock: 'stain', stageId: 'ua-high',
    label: 'Hero Killer', intro: 'Stain: "Only true heroes deserve to live."',
    boss: null,
  },
  {
    id: 'h2', opponent: 'bakugo', unlock: 'bakugo', stageId: 'ua-high',
    label: 'Rival Clash', intro: 'Bakugo: "I\'m gonna crush you, Deku!"',
    boss: null,
  },
  {
    id: 'h3', opponent: 'todoroki', unlock: 'todoroki', stageId: 'blue-flames',
    label: 'Half-Cold Half-Hot', intro: 'Todoroki: "I\'ll use my full power."',
    boss: null,
  },
  {
    id: 'h4', opponent: 'twice', unlock: 'twice', stageId: 'ruins',
    label: 'League Ambush', intro: 'Twice: "Double the chaos!"',
    boss: null,
  },
  {
    id: 'h5', opponent: 'dabi', unlock: 'dabi', stageId: 'blue-flames',
    label: 'Blue Flames', intro: 'Dabi: "Watch the world burn."',
    boss: null,
  },
  {
    id: 'h6', opponent: 'shigaraki', unlock: 'shigaraki', stageId: 'ruins',
    label: 'Decay King', intro: 'Shigaraki: "Destroy… everything."',
    boss: 'mini',
  },
  {
    id: 'h7', opponent: 'allforone', unlock: 'allforone', stageId: 'ruins', unlockStage: 'ruins',
    label: 'Symbol of Evil', intro: 'All For One: "This world needs a new ruler."',
    boss: 'final',
  },
];

const VILLAIN_PATH = [
  {
    id: 'v1', opponent: 'uraraka', unlock: 'uraraka', stageId: 'ua-high',
    label: 'Zero Gravity', intro: 'Uraraka: "I\'ll make you float!"',
    boss: null,
  },
  {
    id: 'v2', opponent: 'deku', unlock: 'deku', stageId: 'ua-high',
    label: 'One For All', intro: 'Deku: "I have to go beyond… Plus Ultra!"',
    boss: null,
  },
  {
    id: 'v3', opponent: 'bakugo', unlock: 'bakugo', stageId: 'blue-flames',
    label: 'Explosion Rush', intro: 'Bakugo: "Die already!"',
    boss: null,
  },
  {
    id: 'v4', opponent: 'todoroki', unlock: 'todoroki', stageId: 'ruins',
    label: 'Ice & Fire', intro: 'Todoroki: "Hot and cold — that is my power."',
    boss: null,
  },
  {
    id: 'v5', opponent: 'stain', unlock: 'stain', stageId: 'ruins',
    label: 'Stain\'s Judgment', intro: 'Stain: "Fake heroes… perish."',
    boss: null,
  },
  {
    id: 'v6', opponent: 'allmight', unlock: 'allmight', stageId: 'ua-high',
    label: 'Symbol of Peace', intro: 'All Might: "Go beyond! PLUS ULTRA!"',
    boss: 'mini',
  },
  {
    id: 'v7', opponent: 'allmight', unlock: 'allmight', stageId: 'ruins',
    label: 'Final Stand', intro: 'All Might: "Young villain… I will stop you!"',
    boss: 'final',
  },
];

export const CAMPAIGN_PATHS = {
  hero: HERO_PATH,
  villain: VILLAIN_PATH,
};

export function getCampaignPath(side) {
  return CAMPAIGN_PATHS[side] ?? HERO_PATH;
}

export function getCampaignNode(side, stageIndex) {
  const path = getCampaignPath(side);
  return path[stageIndex] ?? null;
}

export function buildCampaignLadder(side) {
  return getCampaignPath(side).map((n) => n.opponent);
}

export function getCampaignRun(side, stageIndex) {
  const path = getCampaignPath(side);
  return {
    side,
    path,
    ladder: buildCampaignLadder(side),
    stageIndex,
    totalStages: path.length,
  };
}

export function getCampaignDifficulty(baseDifficulty, stageIndex) {
  return getArcadeDifficulty(baseDifficulty, stageIndex);
}

export function getBossModifiers(bossType, opponentId) {
  if (!bossType) return null;
  const base = bossType === 'final'
    ? { hpMult: 1.35, powerSteal: 0, damageMult: 1.15 }
    : { hpMult: 1.2, powerSteal: 0, damageMult: 1.08 };

  if (opponentId === 'allforone') {
    return { ...base, hpMult: 1.4, powerSteal: 8, damageMult: 1.12 };
  }
  if (opponentId === 'shigaraki') {
    return { ...base, hpMult: 1.28, decayChip: 3 };
  }
  if (opponentId === 'allmight') {
    return { ...base, hpMult: 1.32, damageMult: 1.18 };
  }
  return base;
}

export function getOpponentConfig(node) {
  const config = getCharacterById(node.opponent);
  if (!config || !node.boss) return config;
  const mods = getBossModifiers(node.boss, node.opponent);
  if (!mods) return config;
  return {
    ...config,
    hp: Math.round(config.hp * mods.hpMult),
    lightDamage: Math.round(config.lightDamage * mods.damageMult),
    heavyDamage: Math.round(config.heavyDamage * mods.damageMult),
    specialDamage: Math.round(config.specialDamage * mods.damageMult),
    campaignBoss: node.boss,
    bossMods: mods,
  };
}
