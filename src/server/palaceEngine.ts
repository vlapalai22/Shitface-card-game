import { randomInt, randomUUID } from 'crypto';
import {
  Card,
  ChatMessage,
  GameEffectType,
  GamePhase,
  LastPlaySummary,
  MatchStanding,
  PublicPlayerState,
  PublicRoomState,
  RANKS,
  Rank,
  SUITS,
  getPlayerActiveZone,
  isRankPlayableOnPile,
  sortHandCards,
} from '../shared/types.ts';
import { ensurePlayerProfile, recordMatchResults } from './db.ts';

export interface ServerPlayerState {
  playerId: string;
  nickname: string;
  seatIndex: number;
  connected: boolean;
  ready: boolean;
  hand: Card[];
  faceUp: (Card | null)[];
  faceDown: (Card | null)[];
  burnsThisMatch: number;
}

export interface ServerRoomState {
  code: string;
  hostId: string;
  maxPlayers: number;
  phase: GamePhase;
  deck: Card[];
  discardPile: Card[];
  burnCount: number;
  currentTurnIndex: number;
  players: ServerPlayerState[];
  chatMessages: ChatMessage[];
  lastPlay: LastPlaySummary | null;
  standings: MatchStanding[] | null;
  matchNumber: number;
  lastActivityAt: number;
}

const STARTER_RANK_PRIORITY: Record<Rank, number> = {
  '3': 1,
  '4': 2,
  '5': 3,
  '6': 4,
  '8': 5,
  '9': 6,
  J: 7,
  Q: 8,
  K: 9,
  A: 10,
  '7': 11,
  '2': 12,
  '10': 13,
};

export function createShuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank}-${suit}-${randomUUID().slice(0, 6)}`,
        suit,
        rank,
      });
    }
  }
  // Cryptographically fair Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(existingCodes: Set<string>): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  return randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
}

export function createRoom(
  code: string,
  hostId: string,
  hostNickname: string,
  maxPlayers: number
): ServerRoomState {
  const clampedMax = Math.min(4, Math.max(2, Math.floor(maxPlayers)));
  ensurePlayerProfile(hostId, hostNickname);

  return {
    code,
    hostId,
    maxPlayers: clampedMax,
    phase: 'WAITING',
    deck: [],
    discardPile: [],
    burnCount: 0,
    currentTurnIndex: 0,
    players: [
      {
        playerId: hostId,
        nickname: hostNickname,
        seatIndex: 0,
        connected: true,
        ready: false,
        hand: [],
        faceUp: [null, null, null],
        faceDown: [null, null, null],
        burnsThisMatch: 0,
      },
    ],
    chatMessages: [],
    lastPlay: null,
    standings: null,
    matchNumber: 0,
    lastActivityAt: Date.now(),
  };
}

export function addOrReconnectPlayer(
  room: ServerRoomState,
  playerId: string,
  nickname: string
): { ok: true; reconnected: boolean } | { ok: false; error: string } {
  room.lastActivityAt = Date.now();
  ensurePlayerProfile(playerId, nickname);

  const existing = room.players.find((p) => p.playerId === playerId);
  if (existing) {
    existing.connected = true;
    existing.nickname = nickname;
    return { ok: true, reconnected: true };
  }

  if (room.phase !== 'WAITING') {
    return { ok: false, error: 'This match is already in progress.' };
  }

  if (room.players.length >= room.maxPlayers) {
    return { ok: false, error: `This table is full (${room.maxPlayers}/${room.maxPlayers} players).` };
  }

  const usedSeats = new Set(room.players.map((p) => p.seatIndex));
  let nextSeat = 0;
  while (usedSeats.has(nextSeat)) nextSeat++;

  room.players.push({
    playerId,
    nickname,
    seatIndex: nextSeat,
    connected: true,
    ready: false,
    hand: [],
    faceUp: [null, null, null],
    faceDown: [null, null, null],
    burnsThisMatch: 0,
  });

  room.players.sort((a, b) => a.seatIndex - b.seatIndex);
  return { ok: true, reconnected: false };
}

export function startDeal(
  room: ServerRoomState,
  requesterId: string
): { ok: true } | { ok: false; error: string } {
  if (room.hostId !== requesterId) {
    return { ok: false, error: 'Only the table host can start the match.' };
  }
  if (room.phase !== 'WAITING' && room.phase !== 'FINISHED') {
    return { ok: false, error: 'Match is already underway.' };
  }
  if (room.players.length < 2) {
    return { ok: false, error: 'At least 2 players are needed to start.' };
  }

  const deck = createShuffledDeck();
  room.deck = deck;
  room.discardPile = [];
  room.burnCount = 0;
  room.standings = null;
  room.matchNumber += 1;
  room.phase = 'SWAPPING';
  room.currentTurnIndex = 0;
  room.lastActivityAt = Date.now();

  for (const player of room.players) {
    player.faceDown = [deck.pop()!, deck.pop()!, deck.pop()!];
    player.faceUp = [deck.pop()!, deck.pop()!, deck.pop()!];
    player.hand = sortHandCards([deck.pop()!, deck.pop()!, deck.pop()!]);
    player.ready = false;
    player.burnsThisMatch = 0;
  }

  room.lastPlay = {
    playerId: requesterId,
    playerName:
      room.players.find((p) => p.playerId === requesterId)?.nickname ?? 'Host',
    cards: [],
    effect: 'deal',
    message: 'Cards dealt — swap your 3 face-up Palace cards, then lock setup.',
    timestamp: Date.now(),
  };

  return { ok: true };
}

export function swapOpeningCard(
  room: ServerRoomState,
  playerId: string,
  handCardId: string,
  faceUpIndex: number
): { ok: true } | { ok: false; error: string } {
  if (room.phase !== 'SWAPPING') {
    return { ok: false, error: 'Card swapping is only allowed during setup.' };
  }
  if (!Number.isInteger(faceUpIndex) || faceUpIndex < 0 || faceUpIndex > 2) {
    return { ok: false, error: 'Invalid face-up slot.' };
  }

  const player = room.players.find((p) => p.playerId === playerId);
  if (!player) {
    return { ok: false, error: 'You are not seated at this table.' };
  }
  if (player.ready) {
    return { ok: false, error: 'Unlock setup before swapping cards.' };
  }

  const handIdx = player.hand.findIndex((c) => c.id === handCardId);
  const faceUpCard = player.faceUp[faceUpIndex];
  if (handIdx === -1 || !faceUpCard) {
    return { ok: false, error: 'Selected card not found.' };
  }

  const handCard = player.hand[handIdx];
  player.hand[handIdx] = faceUpCard;
  player.faceUp[faceUpIndex] = handCard;
  player.hand = sortHandCards(player.hand);
  room.lastActivityAt = Date.now();

  return { ok: true };
}

export function setPlayerReady(
  room: ServerRoomState,
  playerId: string,
  ready: boolean
): { ok: true; startedPlaying: boolean } | { ok: false; error: string } {
  if (room.phase !== 'SWAPPING') {
    return { ok: false, error: 'Setup phase is not active.' };
  }

  const player = room.players.find((p) => p.playerId === playerId);
  if (!player) {
    return { ok: false, error: 'You are not seated at this table.' };
  }

  player.ready = ready;
  room.lastActivityAt = Date.now();

  const allReady = room.players.every((p) => p.ready);
  if (!allReady) {
    return { ok: true, startedPlaying: false };
  }

  // Determine starting player: lowest non-special card in hand (3 -> 4 -> 5 -> ... -> A)
  let starterIndex = 0;
  let bestPriority = Infinity;

  room.players.forEach((p, idx) => {
    for (const card of p.hand) {
      const priority = STARTER_RANK_PRIORITY[card.rank];
      if (priority < bestPriority) {
        bestPriority = priority;
        starterIndex = idx;
      }
    }
  });

  room.phase = 'PLAYING';
  room.currentTurnIndex = starterIndex;

  const starter = room.players[starterIndex];
  room.lastPlay = {
    playerId: starter.playerId,
    playerName: starter.nickname,
    cards: [],
    effect: 'deal',
    message: `${starter.nickname} holds the lowest opener and plays first.`,
    timestamp: Date.now(),
  };

  return { ok: true, startedPlaying: true };
}

function hasFourOfAKindOnTop(discardPile: Card[]): boolean {
  if (discardPile.length < 4) return false;
  const topRank = discardPile[discardPile.length - 1].rank;
  for (let i = 1; i <= 4; i++) {
    if (discardPile[discardPile.length - i].rank !== topRank) {
      return false;
    }
  }
  return true;
}

function countRemainingCards(player: ServerPlayerState): number {
  return (
    player.hand.length +
    player.faceUp.filter((c) => c !== null).length +
    player.faceDown.filter((c) => c !== null).length
  );
}

function finishMatch(room: ServerRoomState, winner: ServerPlayerState): void {
  room.phase = 'FINISHED';

  const ranked = [...room.players].sort((a, b) => {
    if (a.playerId === winner.playerId) return -1;
    if (b.playerId === winner.playerId) return 1;
    const remDiff = countRemainingCards(a) - countRemainingCards(b);
    if (remDiff !== 0) return remDiff;
    const burnDiff = b.burnsThisMatch - a.burnsThisMatch;
    if (burnDiff !== 0) return burnDiff;
    return a.seatIndex - b.seatIndex;
  });

  const participants = ranked.map((p, idx) => ({
    playerId: p.playerId,
    nickname: p.nickname,
    place: idx + 1,
    remainingCards: countRemainingCards(p),
    burns: p.burnsThisMatch,
  }));

  room.standings = recordMatchResults(participants);
  room.lastPlay = {
    playerId: winner.playerId,
    playerName: winner.nickname,
    cards: room.lastPlay?.cards ?? [],
    effect: 'win',
    message: `${winner.nickname} cleared their Palace and wins the table!`,
    timestamp: Date.now(),
  };
}

function advanceTurn(room: ServerRoomState): void {
  if (room.players.length === 0) return;
  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
}

function resolvePlayedCards(
  room: ServerRoomState,
  player: ServerPlayerState,
  playedCards: Card[],
  fromZone: 'HAND' | 'FACE_UP' | 'FACE_DOWN'
): void {
  const playedRank = playedCards[0].rank;
  room.discardPile.push(...playedCards);

  // Refill hand to 3 while deck has cards (only after hand plays)
  if (fromZone === 'HAND') {
    while (player.hand.length < 3 && room.deck.length > 0) {
      player.hand.push(room.deck.pop()!);
    }
    player.hand = sortHandCards(player.hand);
  }

  const burnedByTen = playedRank === '10';
  const burnedByFour = hasFourOfAKindOnTop(room.discardPile);
  const didBurn = burnedByTen || burnedByFour;

  let effect: GameEffectType = 'play';
  let message = `${player.nickname} played ${
    playedCards.length > 1 ? `${playedCards.length}× ${playedRank}` : playedRank
  }`;

  if (didBurn) {
    room.burnCount += room.discardPile.length;
    room.discardPile = [];
    player.burnsThisMatch += 1;
    effect = 'burn';
    message = burnedByFour && !burnedByTen
      ? `${player.nickname} completed four ${playedRank}s — pile burned! Plays again.`
      : `${player.nickname} dropped a 10 — pile burned! Plays again.`;
  } else if (playedRank === '2') {
    effect = 'reset';
    message = `${player.nickname} played a 2 — pile reset! Next player may play anything.`;
  } else if (playedRank === '7') {
    effect = 'seven';
    message = `${player.nickname} dropped ${
      playedCards.length > 1 ? `${playedCards.length}× 7` : 'a 7'
    } — next player must play 7 or lower!`;
  }

  room.lastPlay = {
    playerId: player.playerId,
    playerName: player.nickname,
    cards: playedCards,
    effect,
    message,
    timestamp: Date.now(),
  };

  // Check victory immediately
  if (countRemainingCards(player) === 0) {
    finishMatch(room, player);
    return;
  }

  // Burn grants an immediate extra turn; otherwise advance to next player
  if (!didBurn) {
    advanceTurn(room);
  }
}

export function playCards(
  room: ServerRoomState,
  playerId: string,
  cardIds: string[]
): { ok: true } | { ok: false; error: string } {
  if (room.phase !== 'PLAYING') {
    return { ok: false, error: 'Game is not currently active.' };
  }

  const currentPlayer = room.players[room.currentTurnIndex];
  if (!currentPlayer || currentPlayer.playerId !== playerId) {
    return { ok: false, error: 'It is not your turn.' };
  }

  if (!Array.isArray(cardIds) || cardIds.length === 0 || cardIds.length > 4) {
    return { ok: false, error: 'Select 1 to 4 matching cards to play.' };
  }

  const uniqueIds = new Set(cardIds);
  if (uniqueIds.size !== cardIds.length) {
    return { ok: false, error: 'Duplicate card selection detected.' };
  }

  const zone = getPlayerActiveZone({
    handCount: currentPlayer.hand.length,
    faceUp: currentPlayer.faceUp,
    faceDownCount: currentPlayer.faceDown.filter(Boolean).length,
  });

  if (zone === 'FACE_DOWN') {
    return { ok: false, error: 'Choose one of your face-down Palace cards to flip.' };
  }
  if (zone === 'DONE') {
    return { ok: false, error: 'You have no cards remaining.' };
  }

  const selectedCards: Card[] = [];

  if (zone === 'HAND') {
    for (const id of cardIds) {
      const card = currentPlayer.hand.find((c) => c.id === id);
      if (!card) {
        return { ok: false, error: 'You must play from your hand while you hold cards.' };
      }
      selectedCards.push(card);
    }
  } else {
    // FACE_UP zone
    for (const id of cardIds) {
      const card = currentPlayer.faceUp.find((c) => c !== null && c.id === id);
      if (!card) {
        return { ok: false, error: 'Selected face-up card not found.' };
      }
      selectedCards.push(card);
    }
  }

  // All played cards in a single turn must share the same rank
  const rank = selectedCards[0].rank;
  if (!selectedCards.every((c) => c.rank === rank)) {
    return { ok: false, error: 'Multiple cards played together must share the same rank.' };
  }

  if (!isRankPlayableOnPile(rank, room.discardPile)) {
    const top = room.discardPile[room.discardPile.length - 1];
    if (top?.rank === '7') {
      return {
        ok: false,
        error: 'Special 7 is active — play 7 or lower (3–7), or a wild 2 / 10.',
      };
    }
    return {
      ok: false,
      error: `Cannot play ${rank} on ${top?.rank ?? 'pile'}. Play equal or higher, or a wild 2 / 10.`,
    };
  }

  // Commit removal from active zone
  if (zone === 'HAND') {
    currentPlayer.hand = currentPlayer.hand.filter((c) => !uniqueIds.has(c.id));
  } else {
    currentPlayer.faceUp = currentPlayer.faceUp.map((c) =>
      c && uniqueIds.has(c.id) ? null : c
    );
  }

  room.lastActivityAt = Date.now();
  resolvePlayedCards(room, currentPlayer, selectedCards, zone);
  return { ok: true };
}

export function playFaceDownCard(
  room: ServerRoomState,
  playerId: string,
  slotIndex: number
): { ok: true } | { ok: false; error: string } {
  if (room.phase !== 'PLAYING') {
    return { ok: false, error: 'Game is not currently active.' };
  }

  const currentPlayer = room.players[room.currentTurnIndex];
  if (!currentPlayer || currentPlayer.playerId !== playerId) {
    return { ok: false, error: 'It is not your turn.' };
  }

  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 2) {
    return { ok: false, error: 'Invalid face-down slot.' };
  }

  const zone = getPlayerActiveZone({
    handCount: currentPlayer.hand.length,
    faceUp: currentPlayer.faceUp,
    faceDownCount: currentPlayer.faceDown.filter(Boolean).length,
  });

  if (zone !== 'FACE_DOWN') {
    return {
      ok: false,
      error: 'Clear your hand and face-up cards before flipping face-down cards.',
    };
  }

  const card = currentPlayer.faceDown[slotIndex];
  if (!card) {
    return { ok: false, error: 'That face-down slot is already empty.' };
  }

  // Remove the blind card from the slot
  currentPlayer.faceDown[slotIndex] = null;
  room.lastActivityAt = Date.now();

  if (isRankPlayableOnPile(card.rank, room.discardPile)) {
    resolvePlayedCards(room, currentPlayer, [card], 'FACE_DOWN');
    return { ok: true };
  }

  // Blind flip failed: scoop the discard pile AND the revealed card into hand
  const scoopedCount = room.discardPile.length + 1;
  const topRank = room.discardPile[room.discardPile.length - 1]?.rank ?? '?';
  currentPlayer.hand = sortHandCards([
    ...currentPlayer.hand,
    ...room.discardPile,
    card,
  ]);
  room.discardPile = [];

  room.lastPlay = {
    playerId: currentPlayer.playerId,
    playerName: currentPlayer.nickname,
    cards: [card],
    effect: 'pickup',
    message: `${currentPlayer.nickname} flipped a ${card.rank} on ${topRank} and scooped ${scoopedCount} cards!`,
    timestamp: Date.now(),
  };

  advanceTurn(room);
  return { ok: true };
}

export function pickupDiscardPile(
  room: ServerRoomState,
  playerId: string
): { ok: true } | { ok: false; error: string } {
  if (room.phase !== 'PLAYING') {
    return { ok: false, error: 'Game is not currently active.' };
  }

  const currentPlayer = room.players[room.currentTurnIndex];
  if (!currentPlayer || currentPlayer.playerId !== playerId) {
    return { ok: false, error: 'It is not your turn.' };
  }

  if (room.discardPile.length === 0) {
    return { ok: false, error: 'The discard pile is empty — play any card.' };
  }

  const pickedCount = room.discardPile.length;
  currentPlayer.hand = sortHandCards([...currentPlayer.hand, ...room.discardPile]);
  room.discardPile = [];
  room.lastActivityAt = Date.now();

  room.lastPlay = {
    playerId: currentPlayer.playerId,
    playerName: currentPlayer.nickname,
    cards: [],
    effect: 'pickup',
    message: `${currentPlayer.nickname} picked up the pile (${pickedCount} ${
      pickedCount === 1 ? 'card' : 'cards'
    }).`,
    timestamp: Date.now(),
  };

  advanceTurn(room);
  return { ok: true };
}

/**
 * Sanitizes room state for a specific recipient so hidden cards (deck, opponents' hands,
 * and all face-down cards) are NEVER leaked over the wire.
 */
export function sanitizeRoomForPlayer(
  room: ServerRoomState,
  viewerPlayerId: string
): PublicRoomState {
  const topDiscard = room.discardPile[room.discardPile.length - 1];
  const currentTurnPlayer =
    room.phase === 'PLAYING' ? room.players[room.currentTurnIndex] ?? null : null;

  const publicPlayers: PublicPlayerState[] = room.players.map((p) => {
    const faceDownSlots = p.faceDown.map((c) => c !== null);
    const base: PublicPlayerState = {
      playerId: p.playerId,
      nickname: p.nickname,
      seatIndex: p.seatIndex,
      connected: p.connected,
      ready: p.ready,
      handCount: p.hand.length,
      faceUp: p.faceUp,
      faceDownSlots,
      faceDownCount: faceDownSlots.filter(Boolean).length,
      burnsThisMatch: p.burnsThisMatch,
    };
    if (p.playerId === viewerPlayerId) {
      base.hand = p.hand;
    }
    return base;
  });

  return {
    code: room.code,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    phase: room.phase,
    deckCount: room.deck.length,
    discardPile: room.discardPile,
    burnCount: room.burnCount,
    sevenActive: topDiscard?.rank === '7',
    currentTurnPlayerId: currentTurnPlayer?.playerId ?? null,
    players: publicPlayers,
    chatMessages: room.chatMessages,
    lastPlay: room.lastPlay,
    standings: room.standings,
    matchNumber: room.matchNumber,
  };
}
