/**
 * Procedural SFX + YouTube game music playlist.
 */

import {
  initYouTubeMusic,
  startGameMusic as ytStart,
  stopGameMusic as ytStop,
  setGameMusicMuted,
  isGameMusicActive,
  setMusicFallback,
  setOnYoutubePlaying,
  setOnBeforeYoutubePlay,
} from './youtubeMusic.js';

export { initYouTubeMusic, isGameMusicActive };

let ctx = null;
let master = null;
let sfxGain = null;
let musicGain = null;
let muted = false;
let musicTimer = null;
let musicStep = 0;
let proceduralActive = false;

setMusicFallback(() => {
  if (muted || isGameMusicActive()) return;
  startMusic();
});

setOnYoutubePlaying(() => {
  stopMusic();
});

setOnBeforeYoutubePlay(() => {
  stopMusic();
});

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;

  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.9;
  master.connect(ctx.destination);

  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.9;
  sfxGain.connect(master);

  musicGain = ctx.createGain();
  musicGain.gain.value = 0.32;
  musicGain.connect(master);

  return ctx;
}

export function resumeAudio() {
  ensureContext();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.02);
  setGameMusicMuted(muted);
  return muted;
}

export function isMuted() {
  return muted;
}

function now() {
  return ctx ? ctx.currentTime : 0;
}

function tone(opts) {
  if (!ensureContext()) return;
  const {
    type = 'sine',
    freq = 440,
    freqEnd = freq,
    dur = 0.15,
    attack = 0.005,
    decay = dur,
    gain = 0.5,
    dest = sfxGain,
    detune = 0,
  } = opts;

  const t = now();
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
  osc.detune.value = detune;

  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + decay);

  osc.connect(env);
  env.connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(opts) {
  if (!ensureContext()) return;
  const { dur = 0.18, gain = 0.5, type = 'highpass', freq = 800, freqEnd = freq, dest = sfxGain } = opts;
  const t = now();

  const len = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, t);
  if (freqEnd !== freq) filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + dur);

  const env = ctx.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(filter);
  filter.connect(env);
  env.connect(dest);
  src.start(t);
  src.stop(t + dur + 0.02);
}

/* ---------- SFX ---------- */

export const SFX = {
  uiMove() {
    tone({ type: 'square', freq: 320, freqEnd: 420, dur: 0.06, gain: 0.18 });
  },
  uiConfirm() {
    tone({ type: 'square', freq: 480, freqEnd: 760, dur: 0.12, gain: 0.22 });
    tone({ type: 'sine', freq: 720, dur: 0.18, gain: 0.12 });
  },
  uiBack() {
    tone({ type: 'square', freq: 360, freqEnd: 200, dur: 0.1, gain: 0.18 });
  },
  jump() {
    tone({ type: 'sine', freq: 260, freqEnd: 520, dur: 0.16, gain: 0.22 });
  },
  land() {
    noise({ dur: 0.1, gain: 0.25, type: 'lowpass', freq: 500, freqEnd: 120 });
  },
  whiff() {
    noise({ dur: 0.12, gain: 0.16, type: 'bandpass', freq: 1600, freqEnd: 600 });
  },
  hitLight() {
    noise({ dur: 0.1, gain: 0.5, type: 'highpass', freq: 1200, freqEnd: 400 });
    tone({ type: 'triangle', freq: 180, freqEnd: 90, dur: 0.12, gain: 0.4 });
  },
  hitHeavy() {
    noise({ dur: 0.18, gain: 0.6, type: 'highpass', freq: 900, freqEnd: 200 });
    tone({ type: 'sine', freq: 140, freqEnd: 60, dur: 0.22, gain: 0.55 });
  },
  block() {
    noise({ dur: 0.08, gain: 0.4, type: 'bandpass', freq: 2600, freqEnd: 1800 });
    tone({ type: 'square', freq: 900, freqEnd: 700, dur: 0.06, gain: 0.12 });
  },
  special() {
    tone({ type: 'sawtooth', freq: 180, freqEnd: 900, dur: 0.4, gain: 0.3 });
    tone({ type: 'sine', freq: 90, freqEnd: 280, dur: 0.45, gain: 0.35 });
    noise({ dur: 0.4, gain: 0.3, type: 'bandpass', freq: 800, freqEnd: 2400 });
  },
  specialHit(characterId) {
    const profiles = {
      deku: { freq: 120, end: 60, type: 'sine', dur: 0.35 },
      allmight: { freq: 80, end: 40, type: 'sawtooth', dur: 0.45 },
      todoroki: { freq: 200, end: 400, type: 'triangle', dur: 0.3 },
      bakugo: { freq: 180, end: 90, type: 'square', dur: 0.25 },
      uraraka: { freq: 440, end: 220, type: 'sine', dur: 0.28 },
      shigaraki: { freq: 100, end: 50, type: 'sawtooth', dur: 0.38 },
      allforone: { freq: 140, end: 280, type: 'sawtooth', dur: 0.4 },
      dabi: { freq: 300, end: 150, type: 'triangle', dur: 0.32 },
      stain: { freq: 160, end: 80, type: 'square', dur: 0.22 },
      twice: { freq: 220, end: 110, type: 'sine', dur: 0.3 },
    };
    const p = profiles[characterId] ?? { freq: 150, end: 75, type: 'sine', dur: 0.3 };
    tone({ type: p.type, freq: p.freq, freqEnd: p.end, dur: p.dur, gain: 0.38 });
    noise({ dur: 0.2, gain: 0.22, type: 'bandpass', freq: 1200, freqEnd: 400 });
  },
  superFlash() {
    tone({ type: 'sawtooth', freq: 1200, freqEnd: 120, dur: 0.6, gain: 0.3 });
    noise({ dur: 0.5, gain: 0.35, type: 'lowpass', freq: 3000, freqEnd: 200 });
  },
  roundStart() {
    tone({ type: 'square', freq: 440, dur: 0.12, gain: 0.22 });
  },
  fight() {
    tone({ type: 'sawtooth', freq: 300, freqEnd: 600, dur: 0.3, gain: 0.3 });
    tone({ type: 'square', freq: 600, dur: 0.35, gain: 0.18 });
  },
  ko() {
    tone({ type: 'sawtooth', freq: 400, freqEnd: 60, dur: 0.9, gain: 0.4 });
    noise({ dur: 0.7, gain: 0.4, type: 'lowpass', freq: 1200, freqEnd: 80 });
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => tone({ type: 'square', freq: f, dur: 0.18, gain: 0.22 }), i * 120);
    });
  },
};

/* ---------- Music: looping minor arpeggio + bass ---------- */

const MUSIC_SCALE = [220, 261.63, 329.63, 392, 440, 392, 329.63, 261.63];
const BASS = [110, 110, 146.83, 130.81];

export function startMusic() {
  if (!ensureContext()) return;
  if (musicTimer) return;
  proceduralActive = true;
  musicStep = 0;

  const stepMs = 180;
  musicTimer = setInterval(() => {
    if (muted) return;
    const i = musicStep % MUSIC_SCALE.length;
    tone({ type: 'triangle', freq: MUSIC_SCALE[i], dur: 0.16, gain: 0.16, dest: musicGain });
    if (musicStep % 2 === 0) {
      tone({ type: 'sawtooth', freq: BASS[(musicStep / 2) % BASS.length], dur: 0.22, gain: 0.12, dest: musicGain });
    }
    if (musicStep % 8 === 0) {
      noise({ dur: 0.05, gain: 0.08, type: 'highpass', freq: 6000, dest: musicGain });
    }
    musicStep += 1;
  }, stepMs);
}

export function stopMusic() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
  proceduralActive = false;
}

/** Resume audio context and keep one soundtrack playing across scenes. */
export function ensureGameMusic() {
  resumeAudio();
  if (muted) return;
  ytStart();
}

/** Begin random anime OP playlist — YouTube with procedural fallback only if YT fails. */
export function startGameMusic() {
  if (muted) return;
  ytStart();
}

export function stopGameMusic() {
  ytStop();
  stopMusic();
}
