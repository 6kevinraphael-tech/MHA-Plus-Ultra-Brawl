/**
 * WebSocket client for online versus matches.
 * Host creates a room; guest joins with a 6-character code.
 */

const STORAGE_KEY = 'cursed-clash-relay-url';
const CONNECT_TIMEOUT_MS = 10000;

/** Resolve relay URL — saved URL, env override, then dev localhost. */
export function getOnlineWsUrl() {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (saved?.trim()) return saved.trim();

  const fromEnv = import.meta.env.VITE_ONLINE_WS_URL;
  if (fromEnv) return fromEnv;

  if (import.meta.env.DEV) {
    return 'ws://127.0.0.1:8787';
  }

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'ws://127.0.0.1:8787';
  }

  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${host}`;
}

export function setOnlineRelayUrl(url) {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, trimmed);
  wsUrl = trimmed;
}

export function clearOnlineRelayUrl() {
  localStorage.removeItem(STORAGE_KEY);
}

let ws = null;
let role = null;
let roomCode = null;
let connected = false;
let wsUrl = getOnlineWsUrl();
const listeners = new Map();

function emit(event, payload) {
  for (const fn of listeners.get(event) ?? []) fn(payload);
}

export function onOnlineEvent(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

export function offOnlineEvent(event, fn) {
  listeners.get(event)?.delete(fn);
}

export function getOnlineRole() {
  return role;
}

export function getRoomCode() {
  return roomCode;
}

export function getOnlineWsUrlInUse() {
  return wsUrl;
}

export function isOnlineConnected() {
  return connected && ws?.readyState === WebSocket.OPEN;
}

export function isOnlineHost() {
  return role === 'host';
}

function connect(url = wsUrl) {
  wsUrl = url;
  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    ws?.close();
    let settled = false;

    const fail = (message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      connected = false;
      reject(new Error(message));
    };

    const ok = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      connected = true;
      resolve();
    };

    const timer = setTimeout(() => {
      ws?.close();
      fail(`Connection timed out.\n\nMake sure the relay server is running:\n  npm run server\n\nOr use: npm run dev (starts game + relay)`);
    }, CONNECT_TIMEOUT_MS);

    try {
      ws = new WebSocket(url);
    } catch (err) {
      fail(err.message ?? 'Could not open WebSocket');
      return;
    }

    ws.onopen = () => ok();

    ws.onerror = () => {
      fail(`Could not connect to ${url}.\n\nRun in a separate terminal:\n  npm run server\n\nOr restart with:\n  npm run dev`);
    };

    ws.onclose = () => {
      connected = false;
      emit('disconnected', {});
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'room_created':
          role = 'host';
          roomCode = msg.code;
          emit('room_created', msg);
          break;
        case 'room_joined':
          role = 'guest';
          roomCode = msg.code;
          emit('room_joined', msg);
          break;
        case 'peer_joined':
          emit('peer_joined', msg);
          break;
        case 'peer_left':
          emit('peer_left', msg);
          break;
        case 'relay':
          emit('relay', msg);
          emit(`relay:${msg.data?.kind}`, msg.data);
          break;
        case 'error':
          emit('error', msg);
          break;
        default:
          break;
      }
    };
  });
}

export async function createOnlineRoom(url) {
  await connect(url);
  ws.send(JSON.stringify({ type: 'create_room' }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      offOk();
      offErr();
      reject(new Error('Server did not respond. Is npm run server running?'));
    }, 8000);

    const offOk = onOnlineEvent('room_created', (data) => {
      clearTimeout(timer);
      offOk();
      offErr();
      resolve(data);
    });
    const offErr = onOnlineEvent('error', (err) => {
      clearTimeout(timer);
      offOk();
      offErr();
      reject(new Error(err.message ?? 'Failed to create room'));
    });
  });
}

export async function joinOnlineRoom(code, url) {
  await connect(url);
  ws.send(JSON.stringify({ type: 'join_room', code: String(code).toUpperCase().trim() }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      offOk();
      offErr();
      reject(new Error('Server did not respond'));
    }, 8000);

    const offOk = onOnlineEvent('room_joined', (data) => {
      clearTimeout(timer);
      offOk();
      offErr();
      resolve(data);
    });
    const offErr = onOnlineEvent('error', (err) => {
      clearTimeout(timer);
      offOk();
      offErr();
      reject(new Error(err.message ?? 'Failed to join room'));
    });
  });
}

/** Send a typed payload to the other player. */
export function sendOnline(kind, data = {}) {
  if (!isOnlineConnected()) return;
  ws.send(JSON.stringify({
    type: 'relay',
    data: { kind, ...data },
  }));
}

export function leaveOnlineRoom() {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'leave_room' }));
  }
  ws?.close();
  ws = null;
  role = null;
  roomCode = null;
  connected = false;
}
