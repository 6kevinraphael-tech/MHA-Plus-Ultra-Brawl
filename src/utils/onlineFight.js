/** Serialize / apply battle snapshots for online guest clients. */

export function serializeFighter(fighter) {
  if (!fighter?.body) return null;
  const body = fighter.body.body;
  return {
    x: fighter.body.x,
    y: fighter.body.y,
    vx: body?.velocity?.x ?? 0,
    vy: body?.velocity?.y ?? 0,
    facing: fighter.facing,
    hp: fighter.hp,
    power: fighter.power,
    onGround: fighter.onGround,
    isDead: fighter.isDead,
    isHit: fighter.isHit,
    isBlocking: fighter.isBlocking,
    isAttacking: fighter.isAttacking,
    currentAnim: fighter.currentAnim,
    animFrame: fighter.animFrame,
    activeForm: fighter.activeForm,
    spriteY: fighter.sprite?.y ?? 0,
  };
}

export function serializeBattleState(scene) {
  return {
    t: scene.time.now,
    fightStarted: scene.fightStarted,
    roundOver: scene.roundOver,
    matchOver: scene.matchOver,
    roundTimer: scene.roundTimer,
    currentRound: scene.currentRound,
    p1Rounds: scene.p1Rounds,
    p2Rounds: scene.p2Rounds,
    p1: serializeFighter(scene.p1),
    p2: serializeFighter(scene.p2),
  };
}

export function applyFighterSnapshot(fighter, snap) {
  if (!fighter || !snap) return;

  fighter.body.setPosition(snap.x, snap.y);
  if (fighter.body.body) {
    fighter.body.body.velocity.x = snap.vx;
    fighter.body.body.velocity.y = snap.vy;
  }

  fighter.facing = snap.facing;
  fighter.hp = snap.hp;
  fighter.power = snap.power;
  fighter.onGround = snap.onGround;
  fighter.isDead = snap.isDead;
  fighter.isHit = snap.isHit;
  fighter.isBlocking = snap.isBlocking;
  fighter.isAttacking = snap.isAttacking;
  fighter.activeForm = snap.activeForm ?? fighter.activeForm;

  if (fighter.sprite) {
    fighter.sprite.setFlipX(snap.facing === -1);
    fighter.sprite.y = snap.spriteY ?? fighter.sprite.y;
  }

  if (snap.currentAnim !== fighter.currentAnim || snap.animFrame !== fighter.animFrame) {
    fighter.setAnim(snap.currentAnim ?? 'idle', snap.animFrame ?? 0);
  }
}

export function applyBattleSnapshot(scene, snap) {
  if (!snap || !scene.p1 || !scene.p2) return;

  scene.fightStarted = snap.fightStarted;
  scene.roundOver = snap.roundOver;
  scene.matchOver = snap.matchOver;
  scene.roundTimer = snap.roundTimer;
  scene.currentRound = snap.currentRound;
  scene.p1Rounds = snap.p1Rounds;
  scene.p2Rounds = snap.p2Rounds;

  applyFighterSnapshot(scene.p1, snap.p1);
  applyFighterSnapshot(scene.p2, snap.p2);
}
