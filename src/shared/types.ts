export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export type GamePhase = 'WAITING' | 'SWAPPING' | 'PLAYING' | 'FINISHED';

export type ActiveZone = 'HAND' | 'FACE_UP' | 'FACE_DOWN' | 'DONE';

export interface PublicPlayerState {
  playerId: string;
  nickname: string;
  seatIndex: number;
  connected: boolean;
  ready: boolean;
  handCount: number;
  /** Only populated for the receiving player; omitted/empty for opponents */
  hand?: Card[];
  faceUp: (Card | null)[];
  /** True/false per slot (0..2) so clients know which blind slots remain without seeing their cards */
  faceDownSlots: boolean[];
  faceDownCount: number;
  burnsThisMatch: number;
}

export interface MatchStanding {
  playerId: string;
  nickname: string;
  place: number;
  remainingCards: number;
  burns: number;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  emoji?: string;
  timestamp: number;
}

export interface ReactionEvent {
  id: string;
  senderId: string;
  senderName: string;
  emoji: string;
  taunt?: string;
  timestamp: number;
}

export type GameEffectType =
  | 'deal'
  | 'play'
  | 'seven'
  | 'reset'
  | 'burn'
  | 'pickup'
  | 'win'
  | 'swap';

export interface LastPlaySummary {
  playerId: string;
  playerName: string;
  cards: Card[];
  effect: GameEffectType;
  message: string;
  timestamp: number;
}

export interface PublicRoomState {
  code: string;
  hostId: string;
  maxPlayers: number;
  phase: GamePhase;
  deckCount: number;
  discardPile: Card[];
  burnCount: number;
  sevenActive: boolean;
  currentTurnPlayerId: string | null;
  players: PublicPlayerState[];
  chatMessages: ChatMessage[];
  lastPlay: LastPlaySummary | null;
  standings: MatchStanding[] | null;
  matchNumber: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  nickname: string;
  rating: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
  winRate: number;
  burns: number;
  currentStreak: number;
  bestStreak: number;
  updatedAt: number;
}

export const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'] as const;

export const RANKS: readonly Rank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
] as const;

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

/** Sorting order for player hand display: 3..A, with specials (2, 7, 10) clearly ordered by natural value */
export const HAND_SORT_ORDER: Record<Rank, number> = {
  '3': 1,
  '4': 2,
  '5': 3,
  '6': 4,
  '7': 5,
  '8': 6,
  '9': 7,
  J: 8,
  Q: 9,
  K: 10,
  A: 11,
  '2': 12,
  '10': 13,
};

export interface MockEmojiOption {
  emoji: string;
  label: string;
  defaultTaunt?: string;
}

export const MOCK_EMOJIS: readonly MockEmojiOption[] = [
  { emoji: '😂', label: 'Laugh', defaultTaunt: 'Enjoy that pile!' },
  { emoji: '😈', label: 'Devilish', defaultTaunt: "Seven'd!" },
  { emoji: '🤡', label: 'Clown', defaultTaunt: 'Bold strategy...' },
  { emoji: '🔥', label: 'Burn', defaultTaunt: 'Burned!' },
  { emoji: '💀', label: 'Cooked', defaultTaunt: 'Rip your hand' },
  { emoji: '👑', label: 'Crown', defaultTaunt: 'Bow to the Palace' },
  { emoji: '😭', label: 'Cry', defaultTaunt: 'Not again!' },
  { emoji: '🫡', label: 'Salute', defaultTaunt: 'Respect' },
] as const;

export const ALLOWED_REACTION_EMOJIS = new Set<string>(MOCK_EMOJIS.map((m) => m.emoji));

export const QUICK_TAUNTS: readonly string[] = [
  'Enjoy that pile!',
  "Hit 'em with a 7!",
  'Burned to ash!',
  'Bold move...',
  'Hurry up, dealer!',
  'Good game!',
] as const;

/** Classic + 7 Palace rule: can a card of `rank` be legally played on `discardPile`? */
export function isRankPlayableOnPile(rank: Rank, discardPile: Card[]): boolean {
  // Wild specials: 2 (Reset) and 10 (Burn) can ALWAYS be played on any card, including a 7
  if (rank === '2' || rank === '10') {
    return true;
  }

  if (discardPile.length === 0) {
    return true;
  }

  const topCard = discardPile[discardPile.length - 1];

  // After a 2 (Reset), any card may be played
  if (topCard.rank === '2') {
    return true;
  }

  // Special 7 rule: next player must play 7 or lower (3, 4, 5, 6, 7) or wild 2/10 (handled above)
  if (topCard.rank === '7') {
    return RANK_VALUES[rank] <= 7;
  }

  // Standard play: equal or higher rank
  return RANK_VALUES[rank] >= RANK_VALUES[topCard.rank];
}

export function getPlayerActiveZone(player: {
  handCount: number;
  faceUp: (Card | null)[];
  faceDownCount: number;
}): ActiveZone {
  if (player.handCount > 0) return 'HAND';
  if (player.faceUp.some((c) => c !== null)) return 'FACE_UP';
  if (player.faceDownCount > 0) return 'FACE_DOWN';
  return 'DONE';
}

export function getActiveRuleSummary(discardPile: Card[]): {
  label: string;
  detail: string;
  tone: 'neutral' | 'seven' | 'reset';
} {
  if (discardPile.length === 0) {
    return {
      label: 'Open Table',
      detail: 'Play any card',
      tone: 'neutral',
    };
  }
  const top = discardPile[discardPile.length - 1];
  if (top.rank === '2') {
    return {
      label: 'Pile Reset (2)',
      detail: 'Play any card',
      tone: 'reset',
    };
  }
  if (top.rank === '7') {
    return {
      label: 'Special 7 Active',
      detail: 'Play 7 or lower (3–7), or wild 2 / 10',
      tone: 'seven',
    };
  }
  return {
    label: `Beat ${top.rank}`,
    detail: `Play ${top.rank} or higher, or wild 2 / 10`,
    tone: 'neutral',
  };
}

export function sortHandCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const diff = HAND_SORT_ORDER[a.rank] - HAND_SORT_ORDER[b.rank];
    if (diff !== 0) return diff;
    return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
  });
}

// Client -> Server WebSocket messages
export type ClientWsMessage =
  | {
      type: 'room:create';
      playerId: string;
      nickname: string;
      maxPlayers: number;
    }
  | {
      type: 'room:join';
      roomCode: string;
      playerId: string;
      nickname: string;
    }
  | {
      type: 'room:leave';
    }
  | {
      type: 'player:rename';
      nickname: string;
    }
  | {
      type: 'game:start';
    }
  | {
      type: 'game:swap';
      handCardId: string;
      faceUpIndex: number;
    }
  | {
      type: 'game:ready';
      ready: boolean;
    }
  | {
      type: 'game:play';
      cardIds: string[];
    }
  | {
      type: 'game:playFaceDown';
      slotIndex: number;
    }
  | {
      type: 'game:pickup';
    }
  | {
      type: 'game:rematch';
    }
  | {
      type: 'chat:send';
      text: string;
      emoji?: string;
    }
  | {
      type: 'chat:reaction';
      emoji: string;
      taunt?: string;
    }
  | {
      type: 'ping';
    };

// Server -> Client WebSocket messages
export type ServerWsMessage =
  | {
      type: 'room:state';
      room: PublicRoomState;
    }
  | {
      type: 'room:left';
      reason?: string;
    }
  | {
      type: 'chat:message';
      message: ChatMessage;
    }
  | {
      type: 'chat:reaction';
      reaction: ReactionEvent;
    }
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'pong';
    };
