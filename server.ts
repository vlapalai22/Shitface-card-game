import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { WebSocket, WebSocketServer } from 'ws';
import {
  ALLOWED_REACTION_EMOJIS,
  ChatMessage,
  ClientWsMessage,
  ReactionEvent,
  ServerWsMessage,
} from './src/shared/types.ts';
import {
  LeaderboardSort,
  ensurePlayerProfile,
  getLeaderboard,
  getPlayerProfile,
} from './src/server/db.ts';
import {
  ServerRoomState,
  addOrReconnectPlayer,
  createRoom,
  generateRoomCode,
  pickupDiscardPile,
  playCards,
  playFaceDownCard,
  sanitizeRoomForPlayer,
  setPlayerReady,
  startDeal,
  swapOpeningCard,
} from './src/server/palaceEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MAX_CHAT_HISTORY = 80;
const MAX_ROOMS = 500;
const ROOM_IDLE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const CHAT_COOLDOWN_MS = 350;

const PLAYER_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
const ROOM_CODE_RE = /^[A-Z0-9]{4,8}$/;

interface SocketSession {
  ws: WebSocket;
  playerId: string | null;
  roomCode: string | null;
  lastChatAt: number;
}

const rooms = new Map<string, ServerRoomState>();
const sessions = new Map<WebSocket, SocketSession>();

function sanitizeNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 20);
  if (cleaned.length < 1) return null;
  return cleaned;
}

function sanitizeChatText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 220);
}

function sendJson(ws: WebSocket, payload: ServerWsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoomState(room: ServerRoomState): void {
  for (const session of sessions.values()) {
    if (session.roomCode === room.code && session.playerId) {
      sendJson(session.ws, {
        type: 'room:state',
        room: sanitizeRoomForPlayer(room, session.playerId),
      });
    }
  }
}

function broadcastToRoom(roomCode: string, payload: ServerWsMessage): void {
  for (const session of sessions.values()) {
    if (session.roomCode === roomCode) {
      sendJson(session.ws, payload);
    }
  }
}

function appendRoomChat(room: ServerRoomState, msg: ChatMessage): void {
  room.chatMessages.push(msg);
  if (room.chatMessages.length > MAX_CHAT_HISTORY) {
    room.chatMessages.splice(0, room.chatMessages.length - MAX_CHAT_HISTORY);
  }
  room.lastActivityAt = Date.now();
  broadcastToRoom(room.code, { type: 'chat:message', message: msg });
}

function transferHostIfNeeded(room: ServerRoomState): void {
  const currentHost = room.players.find((p) => p.playerId === room.hostId);
  if (currentHost && currentHost.connected) return;
  const nextConnected = room.players.find((p) => p.connected);
  if (nextConnected) {
    room.hostId = nextConnected.playerId;
  } else if (room.players.length > 0) {
    room.hostId = room.players[0].playerId;
  }
}

function removePlayerFromRoom(
  session: SocketSession,
  explicitLeave: boolean
): void {
  if (!session.roomCode || !session.playerId) return;
  const room = rooms.get(session.roomCode);
  const playerId = session.playerId;
  session.roomCode = null;

  if (!room) return;

  const idx = room.players.findIndex((p) => p.playerId === playerId);
  if (idx === -1) return;

  const leavingPlayer = room.players[idx];

  if (!explicitLeave && (room.phase === 'SWAPPING' || room.phase === 'PLAYING')) {
    // Unexpected disconnect mid-match: keep seat reserved so player can reconnect seamlessly
    leavingPlayer.connected = false;
    transferHostIfNeeded(room);
    broadcastRoomState(room);
    return;
  }

  // Explicit leave (or disconnect during WAITING / FINISHED)
  room.players.splice(idx, 1);

  if (room.players.length === 0) {
    rooms.delete(room.code);
    return;
  }

  if (room.hostId === playerId) {
    transferHostIfNeeded(room);
  }

  if (room.phase === 'SWAPPING' || room.phase === 'PLAYING') {
    if (room.players.length < 2) {
      // Return room cleanly to WAITING so remaining player is never stuck
      room.phase = 'WAITING';
      room.deck = [];
      room.discardPile = [];
      room.burnCount = 0;
      room.currentTurnIndex = 0;
      for (const p of room.players) {
        p.hand = [];
        p.faceUp = [null, null, null];
        p.faceDown = [null, null, null];
        p.ready = false;
      }
      room.lastPlay = {
        playerId: leavingPlayer.playerId,
        playerName: leavingPlayer.nickname,
        cards: [],
        effect: 'pickup',
        message: `${leavingPlayer.nickname} left the table — waiting for players to start a new match.`,
        timestamp: Date.now(),
      };
    } else {
      // Keep match going with remaining 2–3 players
      if (idx < room.currentTurnIndex) {
        room.currentTurnIndex = Math.max(0, room.currentTurnIndex - 1);
      } else if (room.currentTurnIndex >= room.players.length) {
        room.currentTurnIndex = 0;
      }
      room.lastPlay = {
        playerId: leavingPlayer.playerId,
        playerName: leavingPlayer.nickname,
        cards: [],
        effect: 'pickup',
        message: `${leavingPlayer.nickname} left the table.`,
        timestamp: Date.now(),
      };
    }
  }

  broadcastRoomState(room);
}

// Periodically prune idle rooms
setInterval(() => {
  const cutoff = Date.now() - ROOM_IDLE_TTL_MS;
  for (const [code, room] of rooms.entries()) {
    const anyConnected = room.players.some((p) => p.connected);
    if (!anyConnected && room.lastActivityAt < cutoff) {
      rooms.delete(code);
    }
  }
}, 5 * 60 * 1000);

async function bootstrap(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size });
  });

  app.get('/api/leaderboard', (req, res) => {
    const sortParam = typeof req.query.sort === 'string' ? req.query.sort : 'rating';
    const validSorts: LeaderboardSort[] = ['rating', 'wins', 'winRate', 'burns'];
    const sort: LeaderboardSort = validSorts.includes(sortParam as LeaderboardSort)
      ? (sortParam as LeaderboardSort)
      : 'rating';

    const search =
      typeof req.query.search === 'string' ? req.query.search.slice(0, 40) : '';
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 50;

    const entries = getLeaderboard({ sort, search, limit });
    res.json({ entries });
  });

  app.get('/api/player/:playerId', (req, res) => {
    const playerId = req.params.playerId;
    if (!PLAYER_ID_RE.test(playerId)) {
      res.status(400).json({ error: 'Invalid player ID.' });
      return;
    }
    const profile = getPlayerProfile(playerId);
    res.json({ profile });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const code = (req.params.code ?? '').trim().toUpperCase();
    if (!ROOM_CODE_RE.test(code)) {
      res.json({ exists: false });
      return;
    }
    const room = rooms.get(code);
    if (!room) {
      res.json({ exists: false });
      return;
    }
    const host = room.players.find((p) => p.playerId === room.hostId);
    res.json({
      exists: true,
      code: room.code,
      phase: room.phase,
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers,
      hostName: host?.nickname ?? 'Host',
    });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    const session: SocketSession = {
      ws,
      playerId: null,
      roomCode: null,
      lastChatAt: 0,
    };
    sessions.set(ws, session);

    ws.on('message', (rawData) => {
      let msg: ClientWsMessage;
      try {
        msg = JSON.parse(rawData.toString('utf8')) as ClientWsMessage;
      } catch {
        sendJson(ws, { type: 'error', message: 'Invalid message format.' });
        return;
      }

      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
        sendJson(ws, { type: 'error', message: 'Malformed request.' });
        return;
      }

      if (msg.type === 'ping') {
        sendJson(ws, { type: 'pong' });
        return;
      }

      if (msg.type === 'room:create') {
        const nickname = sanitizeNickname(msg.nickname);
        if (!nickname) {
          sendJson(ws, { type: 'error', message: 'Please enter a valid nickname (1–20 characters).' });
          return;
        }
        if (typeof msg.playerId !== 'string' || !PLAYER_ID_RE.test(msg.playerId)) {
          sendJson(ws, { type: 'error', message: 'Invalid player session ID.' });
          return;
        }
        if (rooms.size >= MAX_ROOMS) {
          sendJson(ws, { type: 'error', message: 'Salon is at capacity. Try again shortly.' });
          return;
        }

        // Leave previous room if any
        if (session.roomCode) {
          removePlayerFromRoom(session, true);
        }

        const code = generateRoomCode(new Set(rooms.keys()));
        const maxPlayers = typeof msg.maxPlayers === 'number' ? msg.maxPlayers : 4;
        const room = createRoom(code, msg.playerId, nickname, maxPlayers);
        rooms.set(code, room);

        session.playerId = msg.playerId;
        session.roomCode = code;

        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'room:join') {
        const nickname = sanitizeNickname(msg.nickname);
        if (!nickname) {
          sendJson(ws, { type: 'error', message: 'Please enter a valid nickname (1–20 characters).' });
          return;
        }
        if (typeof msg.playerId !== 'string' || !PLAYER_ID_RE.test(msg.playerId)) {
          sendJson(ws, { type: 'error', message: 'Invalid player session ID.' });
          return;
        }
        const code =
          typeof msg.roomCode === 'string' ? msg.roomCode.trim().toUpperCase() : '';
        if (!ROOM_CODE_RE.test(code)) {
          sendJson(ws, { type: 'error', message: 'Enter a valid 6-character room code.' });
          return;
        }

        const room = rooms.get(code);
        if (!room) {
          sendJson(ws, {
            type: 'error',
            message: `Table "${code}" was not found. Double-check the invite code.`,
          });
          return;
        }

        // If already in another room, leave it cleanly
        if (session.roomCode && session.roomCode !== code) {
          removePlayerFromRoom(session, true);
        }

        // Disconnect any stale duplicate socket for this same playerId in this room
        for (const other of sessions.values()) {
          if (
            other !== session &&
            other.roomCode === code &&
            other.playerId === msg.playerId
          ) {
            other.roomCode = null;
          }
        }

        const result = addOrReconnectPlayer(room, msg.playerId, nickname);
        if (!result.ok) {
          sendJson(ws, { type: 'error', message: result.error });
          return;
        }

        session.playerId = msg.playerId;
        session.roomCode = code;

        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'room:leave') {
        removePlayerFromRoom(session, true);
        sendJson(ws, { type: 'room:left' });
        return;
      }

      // All remaining actions require an active room session
      if (!session.roomCode || !session.playerId) {
        sendJson(ws, { type: 'error', message: 'You are not seated at a table.' });
        return;
      }

      const room = rooms.get(session.roomCode);
      if (!room) {
        session.roomCode = null;
        sendJson(ws, { type: 'room:left', reason: 'Room closed.' });
        return;
      }

      if (msg.type === 'player:rename') {
        const nickname = sanitizeNickname(msg.nickname);
        if (!nickname) {
          sendJson(ws, { type: 'error', message: 'Nickname must be 1–20 characters.' });
          return;
        }
        const player = room.players.find((p) => p.playerId === session.playerId);
        if (player) {
          player.nickname = nickname;
          ensurePlayerProfile(player.playerId, nickname);
          broadcastRoomState(room);
        }
        return;
      }

      if (msg.type === 'game:start' || msg.type === 'game:rematch') {
        const res = startDeal(room, session.playerId);
        if (!res.ok) {
          sendJson(ws, { type: 'error', message: res.error });
          return;
        }
        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'game:swap') {
        const res = swapOpeningCard(
          room,
          session.playerId,
          String(msg.handCardId ?? ''),
          Number(msg.faceUpIndex)
        );
        if (!res.ok) {
          sendJson(ws, { type: 'error', message: res.error });
          return;
        }
        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'game:ready') {
        const res = setPlayerReady(room, session.playerId, Boolean(msg.ready));
        if (!res.ok) {
          sendJson(ws, { type: 'error', message: res.error });
          return;
        }
        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'game:play') {
        const ids = Array.isArray(msg.cardIds)
          ? msg.cardIds.filter((x): x is string => typeof x === 'string')
          : [];
        const res = playCards(room, session.playerId, ids);
        if (!res.ok) {
          sendJson(ws, { type: 'error', message: res.error });
          return;
        }
        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'game:playFaceDown') {
        const res = playFaceDownCard(room, session.playerId, Number(msg.slotIndex));
        if (!res.ok) {
          sendJson(ws, { type: 'error', message: res.error });
          return;
        }
        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'game:pickup') {
        const res = pickupDiscardPile(room, session.playerId);
        if (!res.ok) {
          sendJson(ws, { type: 'error', message: res.error });
          return;
        }
        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'chat:send') {
        const now = Date.now();
        if (now - session.lastChatAt < CHAT_COOLDOWN_MS) {
          return;
        }
        session.lastChatAt = now;

        const text = sanitizeChatText(msg.text);
        const emoji =
          typeof msg.emoji === 'string' && ALLOWED_REACTION_EMOJIS.has(msg.emoji)
            ? msg.emoji
            : undefined;
        if (!text && !emoji) return;

        const sender = room.players.find((p) => p.playerId === session.playerId);
        if (!sender) return;

        const chatMsg: ChatMessage = {
          id: randomUUID(),
          senderId: sender.playerId,
          senderName: sender.nickname,
          text,
          emoji,
          timestamp: now,
        };
        appendRoomChat(room, chatMsg);

        if (emoji) {
          const reaction: ReactionEvent = {
            id: randomUUID(),
            senderId: sender.playerId,
            senderName: sender.nickname,
            emoji,
            taunt: text || undefined,
            timestamp: now,
          };
          broadcastToRoom(room.code, { type: 'chat:reaction', reaction });
        }
        return;
      }

      if (msg.type === 'chat:reaction') {
        const now = Date.now();
        if (now - session.lastChatAt < CHAT_COOLDOWN_MS) {
          return;
        }
        session.lastChatAt = now;

        if (typeof msg.emoji !== 'string' || !ALLOWED_REACTION_EMOJIS.has(msg.emoji)) {
          sendJson(ws, { type: 'error', message: 'Invalid reaction emoji.' });
          return;
        }

        const sender = room.players.find((p) => p.playerId === session.playerId);
        if (!sender) return;

        const taunt = sanitizeChatText(msg.taunt).slice(0, 60);
        const reaction: ReactionEvent = {
          id: randomUUID(),
          senderId: sender.playerId,
          senderName: sender.nickname,
          emoji: msg.emoji,
          taunt: taunt || undefined,
          timestamp: now,
        };

        // Broadcast floating tabletop reaction AND log in room chat
        broadcastToRoom(room.code, { type: 'chat:reaction', reaction });
        appendRoomChat(room, {
          id: randomUUID(),
          senderId: sender.playerId,
          senderName: sender.nickname,
          text: taunt,
          emoji: msg.emoji,
          timestamp: now,
        });
      }
    });

    ws.on('close', () => {
      removePlayerFromRoom(session, false);
      sessions.delete(ws);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Royal Salon Palace running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
