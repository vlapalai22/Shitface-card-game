import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ClientWsMessage,
  PublicRoomState,
  ReactionEvent,
  ServerWsMessage,
} from '../shared/types';
import { salonSound } from '../utils/sound';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

export interface ActiveReaction extends ReactionEvent {
  expiresAt: number;
}

interface UsePalaceSocketOptions {
  playerId: string;
  nickname: string;
  onError?: (message: string) => void;
  onRoomCodeChange?: (code: string | null) => void;
}

export function usePalaceSocket({
  playerId,
  nickname,
  onError,
  onRoomCodeChange,
}: UsePalaceSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [reactions, setReactions] = useState<ActiveReaction[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const activeRoomCodeRef = useRef<string | null>(null);
  const nicknameRef = useRef(nickname);
  const playerIdRef = useRef(playerId);
  const lastPlayTimestampRef = useRef<number>(0);
  const onErrorRef = useRef(onError);
  const onRoomCodeChangeRef = useRef(onRoomCodeChange);
  const pendingActionRef = useRef<ClientWsMessage | null>(null);

  nicknameRef.current = nickname;
  playerIdRef.current = playerId;
  onErrorRef.current = onError;
  onRoomCodeChangeRef.current = onRoomCodeChange;

  const sendRaw = useCallback((payload: ClientWsMessage): boolean => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const connect = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');

      // Start keepalive ping
      if (pingTimerRef.current !== null) {
        window.clearInterval(pingTimerRef.current);
      }
      pingTimerRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);

      // Rejoin active room on reconnect, or flush pending create/join
      if (pendingActionRef.current) {
        ws.send(JSON.stringify(pendingActionRef.current));
        pendingActionRef.current = null;
      } else if (activeRoomCodeRef.current && nicknameRef.current.trim()) {
        ws.send(
          JSON.stringify({
            type: 'room:join',
            roomCode: activeRoomCodeRef.current,
            playerId: playerIdRef.current,
            nickname: nicknameRef.current.trim(),
          } satisfies ClientWsMessage)
        );
      }
    };

    ws.onmessage = (event) => {
      let msg: ServerWsMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerWsMessage;
      } catch {
        return;
      }

      if (msg.type === 'pong') return;

      if (msg.type === 'error') {
        onErrorRef.current?.(msg.message);
        return;
      }

      if (msg.type === 'room:left') {
        activeRoomCodeRef.current = null;
        setRoom(null);
        setReactions([]);
        onRoomCodeChangeRef.current?.(null);
        if (msg.reason) {
          onErrorRef.current?.(msg.reason);
        }
        return;
      }

      if (msg.type === 'room:state') {
        const nextRoom = msg.room;
        if (activeRoomCodeRef.current !== nextRoom.code) {
          activeRoomCodeRef.current = nextRoom.code;
          onRoomCodeChangeRef.current?.(nextRoom.code);
        }

        if (
          nextRoom.lastPlay &&
          nextRoom.lastPlay.timestamp !== lastPlayTimestampRef.current
        ) {
          lastPlayTimestampRef.current = nextRoom.lastPlay.timestamp;
          salonSound.playEffect(nextRoom.lastPlay.effect);
        }

        setRoom(nextRoom);
        return;
      }

      if (msg.type === 'chat:message') {
        setRoom((prev) => {
          if (!prev) return prev;
          if (prev.chatMessages.some((m) => m.id === msg.message.id)) {
            return prev;
          }
          return {
            ...prev,
            chatMessages: [...prev.chatMessages.slice(-79), msg.message],
          };
        });
        return;
      }

      if (msg.type === 'chat:reaction') {
        salonSound.playReactionPop();
        const active: ActiveReaction = {
          ...msg.reaction,
          expiresAt: Date.now() + 3300,
        };
        setReactions((prev) => [...prev.filter((r) => r.id !== active.id), active]);
      }
    };

    ws.onclose = () => {
      if (pingTimerRef.current !== null) {
        window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
      setStatus('reconnecting');
      reconnectTimerRef.current = window.setTimeout(() => {
        connect();
      }, 1400);
    };

    ws.onerror = () => {
      // onclose handles automatic reconnection
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (pingTimerRef.current !== null) {
        window.clearInterval(pingTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Prune expired floating reactions smoothly
  useEffect(() => {
    if (reactions.length === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setReactions((prev) => prev.filter((r) => r.expiresAt > now));
    }, 400);
    return () => window.clearInterval(timer);
  }, [reactions.length]);

  const createTable = useCallback(
    (maxPlayers: number, nameOverride?: string) => {
      const effectiveName = (nameOverride ?? nicknameRef.current).trim();
      const payload: ClientWsMessage = {
        type: 'room:create',
        playerId: playerIdRef.current,
        nickname: effectiveName,
        maxPlayers,
      };
      if (!sendRaw(payload)) {
        pendingActionRef.current = payload;
      }
    },
    [sendRaw]
  );

  const joinTable = useCallback(
    (roomCode: string, nameOverride?: string) => {
      const effectiveName = (nameOverride ?? nicknameRef.current).trim();
      const payload: ClientWsMessage = {
        type: 'room:join',
        roomCode: roomCode.trim().toUpperCase(),
        playerId: playerIdRef.current,
        nickname: effectiveName,
      };
      if (!sendRaw(payload)) {
        pendingActionRef.current = payload;
      }
    },
    [sendRaw]
  );

  const leaveTable = useCallback(() => {
    activeRoomCodeRef.current = null;
    sendRaw({ type: 'room:leave' });
    setRoom(null);
    setReactions([]);
    onRoomCodeChangeRef.current?.(null);
  }, [sendRaw]);

  const renamePlayer = useCallback(
    (newName: string) => {
      if (activeRoomCodeRef.current) {
        sendRaw({ type: 'player:rename', nickname: newName });
      }
    },
    [sendRaw]
  );

  const startGame = useCallback(() => {
    sendRaw({ type: 'game:start' });
  }, [sendRaw]);

  const swapCard = useCallback(
    (handCardId: string, faceUpIndex: number) => {
      salonSound.playSwap();
      sendRaw({ type: 'game:swap', handCardId, faceUpIndex });
    },
    [sendRaw]
  );

  const setReady = useCallback(
    (ready: boolean) => {
      sendRaw({ type: 'game:ready', ready });
    },
    [sendRaw]
  );

  const playSelectedCards = useCallback(
    (cardIds: string[]) => {
      sendRaw({ type: 'game:play', cardIds });
    },
    [sendRaw]
  );

  const flipFaceDownCard = useCallback(
    (slotIndex: number) => {
      sendRaw({ type: 'game:playFaceDown', slotIndex });
    },
    [sendRaw]
  );

  const pickupPile = useCallback(() => {
    sendRaw({ type: 'game:pickup' });
  }, [sendRaw]);

  const requestRematch = useCallback(() => {
    sendRaw({ type: 'game:rematch' });
  }, [sendRaw]);

  const sendChatMessage = useCallback(
    (text: string, emoji?: string) => {
      sendRaw({ type: 'chat:send', text, emoji });
    },
    [sendRaw]
  );

  const sendReaction = useCallback(
    (emoji: string, taunt?: string) => {
      sendRaw({ type: 'chat:reaction', emoji, taunt });
    },
    [sendRaw]
  );

  return {
    status,
    room,
    reactions,
    createTable,
    joinTable,
    leaveTable,
    renamePlayer,
    startGame,
    swapCard,
    setReady,
    playSelectedCards,
    flipFaceDownCard,
    pickupPile,
    requestRematch,
    sendChatMessage,
    sendReaction,
  };
}
