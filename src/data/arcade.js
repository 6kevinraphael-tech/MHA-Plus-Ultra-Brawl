import { getCharacterById, getOpposingFaction, getRosterForFaction } from './characters.js';

export const ARCADE_STAGES = 6;
const BOSS_IDS = ['allforone', 'shigaraki'];

/** Build a shuffled villain/hero ladder ending with a boss. */
export function buildArcadeLadder(playerSide) {
  const pool = getRosterForFaction(getOpposingFaction(playerSide));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const regular = shuffled.filter((c) => !BOSS_IDS.includes(c.id));
  const ladder = regular.slice(0, ARCADE_STAGES - 1).map((c) => c.id);

  const boss = BOSS_IDS.find((id) => pool.some((c) => c.id === id))
    ?? shuffled[0]?.id;
  ladder.push(boss);

  while (ladder.length < ARCADE_STAGES && regular.length > 0) {
    const pick = regular[ladder.length % regular.length];
    if (!ladder.includes(pick.id)) ladder.splice(ladder.length - 1, 0, pick.id);
    else break;
  }

  return ladder.slice(0, ARCADE_STAGES);
}

/** Ramp CPU difficulty as the ladder progresses. */
export function getArcadeDifficulty(baseDifficulty, stageIndex) {
  const order = ['easy', 'normal', 'hard'];
  const base = Math.max(0, order.indexOf(baseDifficulty));
  const bump = stageIndex >= 4 ? 2 : Math.floor(stageIndex / 2);
  return order[Math.min(2, base + bump)] ?? 'normal';
}

export function getArcadeOpponent(ladder, stageIndex) {
  return getCharacterById(ladder[stageIndex]);
}
