/**
 * Lightweight WebSocket relay for online versus matches.
 * Run: npm run server
 */
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 8787;
const CODE_LEN = 6;
const rooms = new Map();

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < CODE_LEN; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  if (rooms.has(code)) return makeCode();
  return code;
}

function send(ws, type, payload = {}) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ type, ...payload }));
}

function broadcast(room, type, payload = {}, except = null) {
  for (const peer of [room.host, room.guest]) {
    if (!peer || peer === except) continue;
    send(peer, type, payload);
  }
}

function roomFor(ws) {
  for (const room of rooms.values()) {
    if (room.host === ws || room.guest === ws) return room;
  }
  return null;
}

function closeRoom(room) {
  broadcast(room, 'peer_left', {});
  for (const peer of [room.host, room.guest]) {
    peer?.close();
  }
  rooms.delete(room.code);
}

const httpServer = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'cursed-clash-relay', rooms: rooms.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      send(ws, 'error', { message: 'Invalid message' });
      return;
    }

    const { type } = msg;

    if (type === 'create_room') {
      if (roomFor(ws)) {
        send(ws, 'error', { message: 'Already in a room' });
        return;
      }
      const code = makeCode();
      const room = { code, host: ws, guest: null, p1: null, p2: null };
      rooms.set(code, room);
      ws.roomCode = code;
      ws.role = 'host';
      send(ws, 'room_created', { code, role: 'host' });
      return;
    }

    if (type === 'join_room') {
      if (roomFor(ws)) {
        send(ws, 'error', { message: 'Already in a room' });
        return;
      }
      const code = String(msg.code ?? '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) {
        send(ws, 'error', { message: 'Room not found' });
        return;
      }
      if (room.guest) {
        send(ws, 'error', { message: 'Room is full' });
        return;
      }
      room.guest = ws;
      ws.roomCode = code;
      ws.role = 'guest';
      send(ws, 'room_joined', { code, role: 'guest' });
      send(room.host, 'peer_joined', { code });
      return;
    }

    const room = roomFor(ws);
    if (!room) {
      send(ws, 'error', { message: 'Not in a room' });
      return;
    }

    if (type === 'relay') {
      broadcast(room, 'relay', { from: ws.role, data: msg.data ?? {} }, ws);
      return;
    }

    if (type === 'leave_room') {
      if (room.host === ws) {
        closeRoom(room);
      } else {
        room.guest = null;
        send(room.host, 'peer_left', {});
        ws.roomCode = null;
        ws.role = null;
      }
    }
  });

  ws.on('close', () => {
    const room = roomFor(ws);
    if (!room) return;
    if (room.host === ws) {
      closeRoom(room);
      return;
    }
    room.guest = null;
    send(room.host, 'peer_left', {});
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Cursed Clash online relay listening on 0.0.0.0:${PORT}`);
  console.log(`  Local:  ws://127.0.0.1:${PORT}`);
  if (process.env.RENDER) {
    console.log('  Public: wss://<your-service>.onrender.com');
  }
});
