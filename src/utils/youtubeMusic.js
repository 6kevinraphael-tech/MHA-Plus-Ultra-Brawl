import { GAME_MUSIC } from '../data/gameMusic.js';

const VOLUME = 48;
const RETRY_MS = 800;
const LOAD_GUARD_MS = 4000;
const FALLBACK_MS = 1500;

let player = null;
let playerReady = false;
let pendingPlay = false;
let pendingTag = null;
let currentVideoId = null;
let muted = false;
let loadGuard = false;
let retryTimer = null;
let usingFallback = false;
let onFallback = null;
let onYoutubePlaying = null;
let onBeforePlay = null;

export function setOnYoutubePlaying(fn) {
  onYoutubePlaying = fn;
}

export function setOnBeforeYoutubePlay(fn) {
  onBeforePlay = fn;
}

function ytState() {
  return window.YT?.PlayerState;
}

function getState() {
  return player?.getPlayerState?.() ?? -1;
}

function isPlaying() {
  const S = ytState();
  if (!S || !player) return false;
  const s = getState();
  return s === S.PLAYING || s === S.BUFFERING;
}

function videoIdFor(track) {
  return track.youtube ?? track.id;
}

function pickRandomVideoId(excludeId = null, tag = null) {
  let pool = GAME_MUSIC;
  if (tag) {
    const tagged = GAME_MUSIC.filter((t) => t.tags?.includes(tag));
    if (tagged.length) pool = tagged;
  }
  if (excludeId) pool = pool.filter((t) => videoIdFor(t) !== excludeId);
  if (!pool.length) pool = GAME_MUSIC;
  return videoIdFor(pool[Math.floor(Math.random() * pool.length)]);
}

function clearRetry() {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}

function scheduleRetry() {
  if (retryTimer || muted) return;
  retryTimer = setInterval(() => {
    if (muted) {
      clearRetry();
      return;
    }
    if (isPlaying()) {
      clearRetry();
      pendingPlay = false;
      return;
    }
    if (playerReady && !loadGuard) {
      if (currentVideoId && getState() === ytState()?.PAUSED) {
        player.playVideo();
      } else if (!currentVideoId) {
        playTrack();
      }
    }
  }, RETRY_MS);
}

function ensureContainer() {
  if (document.querySelector('#yt-music-player iframe')) {
    return document.getElementById('yt-music-player');
  }

  let el = document.getElementById('yt-music-player');
  if (!el) {
    el = document.createElement('div');
    el.id = 'yt-music-player';
    el.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
    document.body.appendChild(el);
  }
  return el;
}

function createPlayer() {
  if (!window.YT?.Player) return;
  if (player) return;

  const container = ensureContainer();
  container.querySelector('iframe')?.remove();

  player = new window.YT.Player('yt-music-player', {
    height: '0',
    width: '0',
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      loop: 0,
      origin: window.location.origin,
    },
    events: {
      onReady: () => {
        playerReady = true;
        player.setVolume(muted ? 0 : VOLUME);
        if (pendingPlay) playTrack();
      },
      onStateChange: (event) => {
        const S = ytState();
        if (!S) return;
        if (event.data === S.ENDED && currentVideoId) {
          playNextTrack();
        }
        if (event.data === S.PLAYING) {
          loadGuard = false;
          pendingPlay = false;
          usingFallback = false;
          clearRetry();
          onYoutubePlaying?.();
        }
      },
      onError: () => {
        loadGuard = false;
        const failed = currentVideoId;
        currentVideoId = null;
        playTrack(failed);
      },
    },
  });
}

function playTrack(excludeId = null, tag = null) {
  if (muted) return;
  if (!playerReady || !player?.loadVideoById) {
    pendingPlay = true;
    if (tag) pendingTag = tag;
    scheduleRetry();
    return;
  }
  if (loadGuard) return;

  onBeforePlay?.();
  loadGuard = true;
  currentVideoId = pickRandomVideoId(excludeId, tag ?? pendingTag);
  pendingTag = null;
  player.stopVideo();
  player.loadVideoById({ videoId: currentVideoId, startSeconds: 0 });
  player.setVolume(muted ? 0 : VOLUME);
  player.playVideo();
  scheduleRetry();
  setTimeout(() => {
    if (loadGuard && !isPlaying()) loadGuard = false;
  }, LOAD_GUARD_MS);
}

function playNextTrack() {
  if (muted) return;
  loadGuard = false;
  const prev = currentVideoId;
  currentVideoId = null;
  playTrack(prev);
}

export function setMusicFallback(fn) {
  onFallback = fn;
}

export function initYouTubeMusic() {
  if (window.YT?.Player) {
    createPlayer();
    return;
  }

  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    if (typeof prev === 'function') prev();
    createPlayer();
  };

  if (document.getElementById('youtube-iframe-api')) return;

  const tag = document.createElement('script');
  tag.id = 'youtube-iframe-api';
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

export function startGameMusic() {
  if (muted) return;
  pendingPlay = true;

  if (isPlaying()) {
    pendingPlay = false;
    return;
  }

  if (currentVideoId && getState() === ytState()?.PAUSED) {
    onBeforePlay?.();
    player?.playVideo();
    scheduleRetry();
    return;
  }

  if (playerReady) {
    playTrack();
    return;
  }

  scheduleRetry();

  if (!usingFallback && typeof onFallback === 'function') {
    usingFallback = true;
    setTimeout(() => {
      usingFallback = false;
      if (!isPlaying() && pendingPlay && !muted && typeof onFallback === 'function') {
        onFallback();
      }
    }, FALLBACK_MS);
  }
}

export function stopGameMusic() {
  pendingPlay = false;
  loadGuard = false;
  currentVideoId = null;
  clearRetry();
  usingFallback = false;
  player?.stopVideo?.();
}

export function setGameMusicMuted(isMuted) {
  muted = isMuted;
  player?.setVolume?.(isMuted ? 0 : VOLUME);
  if (isMuted) clearRetry();
}

export function playStageMusic(tag = null) {
  if (muted) return;
  // Keep the current track playing — don't restart when changing scenes or stages.
  if (isPlaying()) return;

  pendingTag = tag;
  if (playerReady) {
    playTrack(null, tag);
  } else {
    pendingPlay = true;
    startGameMusic();
  }
}

export function isGameMusicActive() {
  return isPlaying();
}
