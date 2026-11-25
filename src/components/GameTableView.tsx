import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Copy,
  Crown,
  Flame,
  Hand,
  LogOut,
  MessageSquare,
  Play,
  RotateCcw,
  Share2,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  Card,
  MOCK_EMOJIS,
  PublicPlayerState,
  PublicRoomState,
  getActiveRuleSummary,
  getPlayerActiveZone,
  isRankPlayableOnPile,
} from '../shared/types';
import type { ActiveReaction, ConnectionStatus } from '../hooks/usePalaceSocket';
import { PlayingCard } from './PlayingCard';
import { TableChatPanel } from './TableChatPanel';

const TABLE_FELT_IMAGE = '/src/assets/images/emerald_felt_table_1795605613085.jpg';

interface GameTableViewProps {
  room: PublicRoomState;
  currentPlayerId: string;
  connectionStatus: ConnectionStatus;
  reactions: ActiveReaction[];
  muted: boolean;
  onToggleMute: () => void;
  onOpenRules: () => void;
  onOpenLeaderboard: () => void;
  onLeaveTable: () => void;
  onStartGame: () => void;
  onSwapCard: (handCardId: string, faceUpIndex: number) => void;
  onSetReady: (ready: boolean) => void;
  onPlayCards: (cardIds: string[]) => void;
  onFlipFaceDown: (slotIndex: number) => void;
  onPickupPile: () => void;
  onRematch: () => void;
  onSendChat: (text: string, emoji?: string) => void;
  onSendReaction: (emoji: string, taunt?: string) => void;
  onCopyInvite: () => void;
}

interface FloatingReactionBubbleProps {
  reaction?: ActiveReaction;
}

const FloatingReactionBubble: React.FC<FloatingReactionBubbleProps> = ({ reaction }) => {
  if (!reaction) return null;
  return (
    <div
      key={reaction.id}
      className="animate-float-reaction pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0D1A14]/95 border border-[#D4AF37]/60 shadow-[0_10px_24px_rgba(0,0,0,0.55)] whitespace-nowrap"
    >
      <span className="text-2xl leading-none">{reaction.emoji}</span>
      {reaction.taunt && (
        <span className="text-xs font-semibold text-[#FAF7F0] max-w-[160px] truncate">
          {reaction.taunt}
        </span>
      )}
    </div>
  );
};

interface OpponentSeatProps {
  player: PublicPlayerState;
  isHost: boolean;
  isTurn: boolean;
  phase: PublicRoomState['phase'];
  reaction?: ActiveReaction;
  compact?: boolean;
}

const OpponentSeat: React.FC<OpponentSeatProps> = ({
  player,
  isHost,
  isTurn,
  phase,
  reaction,
  compact = false,
}) => {
  const totalRemaining =
    player.handCount +
    player.faceUp.filter(Boolean).length +
    player.faceDownCount;

  return (
    <div
      className={`relative rounded-xl px-3.5 py-2.5 transition-all duration-200 ${
        isTurn
          ? 'bg-[#102E20]/95 border border-[#D4AF37] shadow-[0_0_24px_rgba(212,175,55,0.22)]'
          : 'bg-[#0C1D15]/85 border border-white/10'
      }`}
    >
      <FloatingReactionBubble reaction={reaction} />

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {isHost && <Crown className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />}
            <span className="text-sm font-semibold text-[#FAF7F0] truncate max-w-[130px]">
              {player.nickname}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#A8B6AD] font-mono-tabular">
            <span>{player.handCount} hand</span>
            <span aria-hidden="true">·</span>
            <span>{totalRemaining} left</span>
            {player.burnsThisMatch > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-300">{player.burnsThisMatch} burn</span>
              </>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          {!player.connected ? (
            <span className="text-[11px] font-medium text-amber-300">Reconnecting</span>
          ) : phase === 'SWAPPING' ? (
            <span
              className={`text-[11px] font-semibold ${
                player.ready ? 'text-emerald-300' : 'text-[#A8B6AD]'
              }`}
            >
              {player.ready ? 'Setup Locked' : 'Swapping...'}
            </span>
          ) : isTurn ? (
            <span className="text-[11px] font-semibold text-[#D4AF37]">Active Turn</span>
          ) : null}
        </div>
      </div>

      {/* Opponent Palace 3 Stacks */}
      {phase !== 'WAITING' && (
        <div className={`mt-2.5 flex items-center justify-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
          {[0, 1, 2].map((slotIdx) => {
            const upCard = player.faceUp[slotIdx];
            const hasDown = player.faceDownSlots[slotIdx];
            return (
              <div key={slotIdx} className="relative w-11 h-16 flex items-center justify-center">
                {!upCard && !hasDown ? (
                  <div className="w-11 h-16 rounded-md border border-dashed border-white/10" />
                ) : (
                  <>
                    {hasDown && (
                      <div className={upCard ? 'absolute top-1 left-0.5 opacity-90' : ''}>
                        <PlayingCard faceDown size="xs" />
                      </div>
                    )}
                    {upCard && (
                      <div className="relative z-10 -translate-y-0.5">
                        <PlayingCard card={upCard} size="xs" />
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const GameTableView: React.FC<GameTableViewProps> = ({
  room,
  currentPlayerId,
  connectionStatus,
  reactions,
  muted,
  onToggleMute,
  onOpenRules,
  onOpenLeaderboard,
  onLeaveTable,
  onStartGame,
  onSwapCard,
  onSetReady,
  onPlayCards,
  onFlipFaceDown,
  onPickupPile,
  onRematch,
  onSendChat,
  onSendReaction,
  onCopyInvite,
}) => {
  const [feltImgFailed, setFeltImgFailed] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [lastSeenChatCount, setLastSeenChatCount] = useState(room.chatMessages.length);
  const [copiedJustNow, setCopiedJustNow] = useState(false);

  // Selection state for PLAYING multi-card plays
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  // Selection state for SWAPPING phase
  const [swapHandId, setSwapHandId] = useState<string | null>(null);
  const [swapFaceUpIdx, setSwapFaceUpIdx] = useState<number | null>(null);

  const me = useMemo(
    () => room.players.find((p) => p.playerId === currentPlayerId) ?? null,
    [room.players, currentPlayerId]
  );

  // Order opponents clockwise starting after `me`
  const opponents = useMemo(() => {
    const myIdx = room.players.findIndex((p) => p.playerId === currentPlayerId);
    if (myIdx === -1) return room.players;
    const rotated: PublicPlayerState[] = [];
    for (let i = 1; i < room.players.length; i++) {
      rotated.push(room.players[(myIdx + i) % room.players.length]);
    }
    return rotated;
  }, [room.players, currentPlayerId]);

  const isHost = room.hostId === currentPlayerId;
  const isMyTurn = room.phase === 'PLAYING' && room.currentTurnPlayerId === currentPlayerId;
  const myZone = me ? getPlayerActiveZone(me) : 'DONE';
  const myHand = me?.hand ?? [];

  const ruleSummary = useMemo(
    () => getActiveRuleSummary(room.discardPile),
    [room.discardPile]
  );

  // Clear stale selections whenever turn, phase, or hand/faceUp changes
  useEffect(() => {
    if (!me) {
      setSelectedCardIds([]);
      setSwapHandId(null);
      setSwapFaceUpIdx(null);
      return;
    }
    const validIds = new Set<string>([
      ...(me.hand ?? []).map((c) => c.id),
      ...me.faceUp.filter((c): c is Card => c !== null).map((c) => c.id),
    ]);
    setSelectedCardIds((prev) => prev.filter((id) => validIds.has(id)));
    if (swapHandId && !validIds.has(swapHandId)) {
      setSwapHandId(null);
    }
  }, [me, room.phase, room.currentTurnPlayerId, swapHandId]);

  // Clear selections when leaving turn or swapping
  useEffect(() => {
    if (!isMyTurn) setSelectedCardIds([]);
  }, [isMyTurn]);

  useEffect(() => {
    if (room.phase !== 'SWAPPING') {
      setSwapHandId(null);
      setSwapFaceUpIdx(null);
    }
  }, [room.phase]);

  // Unread chat count tracking
  useEffect(() => {
    if (chatOpen) {
      setLastSeenChatCount(room.chatMessages.length);
    }
  }, [chatOpen, room.chatMessages.length]);

  const unreadCount = chatOpen
    ? 0
    : Math.max(0, room.chatMessages.length - lastSeenChatCount);

  // Latest active reaction per playerId
  const latestReactionByPlayer = useMemo(() => {
    const map = new Map<string, ActiveReaction>();
    for (const r of reactions) {
      map.set(r.senderId, r);
    }
    return map;
  }, [reactions]);

  // Determine whether current player has ANY legal play in their active zone
  const hasAnyLegalPlay = useMemo(() => {
    if (!me || !isMyTurn) return false;
    if (myZone === 'HAND') {
      return myHand.some((c) => isRankPlayableOnPile(c.rank, room.discardPile));
    }
    if (myZone === 'FACE_UP') {
      return me.faceUp.some(
        (c) => c !== null && isRankPlayableOnPile(c.rank, room.discardPile)
      );
    }
    if (myZone === 'FACE_DOWN') {
      return me.faceDownCount > 0;
    }
    return false;
  }, [me, isMyTurn, myZone, myHand, room.discardPile]);

  const selectedCards: Card[] = useMemo(() => {
    if (!me || selectedCardIds.length === 0) return [];
    const pool =
      myZone === 'HAND'
        ? myHand
        : me.faceUp.filter((c): c is Card => c !== null);
    return pool.filter((c) => selectedCardIds.includes(c.id));
  }, [me, selectedCardIds, myZone, myHand]);

  const handleCopyInviteClick = () => {
    onCopyInvite();
    setCopiedJustNow(true);
    window.setTimeout(() => setCopiedJustNow(false), 2000);
  };

  // Swap phase click handlers
  const handleSwapHandClick = (card: Card) => {
    if (!me || me.ready) return;
    if (swapFaceUpIdx !== null) {
      onSwapCard(card.id, swapFaceUpIdx);
      setSwapHandId(null);
      setSwapFaceUpIdx(null);
    } else {
      setSwapHandId((prev) => (prev === card.id ? null : card.id));
    }
  };

  const handleSwapFaceUpClick = (slotIdx: number) => {
    if (!me || me.ready) return;
    if (swapHandId !== null) {
      onSwapCard(swapHandId, slotIdx);
      setSwapHandId(null);
      setSwapFaceUpIdx(null);
    } else {
      setSwapFaceUpIdx((prev) => (prev === slotIdx ? null : slotIdx));
    }
  };

  // Playing phase card toggle (multi-select same rank)
  const handlePlayCardClick = (card: Card) => {
    if (!isMyTurn) return;
    if (!isRankPlayableOnPile(card.rank, room.discardPile)) return;

    setSelectedCardIds((prev) => {
      if (prev.includes(card.id)) {
        return prev.filter((id) => id !== card.id);
      }
      if (prev.length === 0) {
        return [card.id];
      }
      const pool =
        myZone === 'HAND'
          ? myHand
          : (me?.faceUp.filter((c): c is Card => c !== null) ?? []);
      const firstSelected = pool.find((c) => c.id === prev[0]);
      if (firstSelected && firstSelected.rank === card.rank) {
        return [...prev, card.id];
      }
      // Switch selection to this new rank
      return [card.id];
    });
  };

  const handlePlayCardDoubleClick = (card: Card) => {
    if (!isMyTurn) return;
    if (!isRankPlayableOnPile(card.rank, room.discardPile)) return;
    setSelectedCardIds([]);
    onPlayCards([card.id]);
  };

  const handleConfirmPlay = () => {
    if (!isMyTurn || selectedCardIds.length === 0) return;
    onPlayCards(selectedCardIds);
    setSelectedCardIds([]);
  };

  const currentTurnName =
    room.players.find((p) => p.playerId === room.currentTurnPlayerId)?.nickname ?? '';

  const visibleDiscardStack = room.discardPile.slice(-4);
  const readyCount = room.players.filter((p) => p.ready).length;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#08120D] text-[#FAF7F0]">
      {/* Compact Non-Intrusive Table HUD Bar */}
      <header className="h-14 px-4 sm:px-6 bg-[#0B1711] border-b border-[#D4AF37]/20 flex items-center justify-between gap-4 shrink-0 z-30">
        {/* Left: Brand & Room Code */}
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <span className="font-display text-base sm:text-lg font-semibold text-[#FAF7F0] whitespace-nowrap shrink-0">
            Royal Salon Palace
          </span>
          <span className="hidden sm:inline text-white/20" aria-hidden="true">
            |
          </span>
          <div className="flex items-center gap-2 text-xs text-[#B8C4BC] whitespace-nowrap">
            <span className="hidden md:inline">Table</span>
            <span className="font-mono-tabular font-semibold tracking-wider text-[#D4AF37]">
              {room.code}
            </span>
            <button
              type="button"
              onClick={handleCopyInviteClick}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#162C22] hover:bg-[#1E3B2E] border border-[#D4AF37]/30 text-xs font-medium text-[#FAF7F0] transition-colors whitespace-nowrap shrink-0"
            >
              {copiedJustNow ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Link Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span className="hidden sm:inline">Copy Invite Link</span>
                  <span className="sm:hidden">Invite</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Table Status & Utility Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden xl:inline text-xs text-[#9AA89F] mr-2 whitespace-nowrap font-mono-tabular">
            {room.players.length}/{room.maxPlayers} Seated
            {room.matchNumber > 0 ? ` · Match #${room.matchNumber}` : ''}
            {connectionStatus !== 'connected' ? ' · Reconnecting' : ''}
          </span>

          <button
            type="button"
            onClick={onOpenRules}
            title="Palace Rules"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#C5D1C9] hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden md:inline">Rules</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
            className="p-2 rounded-lg text-[#C5D1C9] hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setChatOpen((prev) => !prev)}
            className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              chatOpen
                ? 'bg-[#1A3528] text-[#FAF7F0] border border-[#D4AF37]/30'
                : 'text-[#C5D1C9] hover:text-white hover:bg-white/10'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Chat</span>
            {unreadCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#D4AF37] text-[#0B1410] font-mono-tabular text-[10px] font-bold leading-none">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onLeaveTable}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </header>

      {/* Main Content Area: Emerald Felt Arena + Collapsible Chat Sidebar */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* Felt Card Table Canvas */}
        <div className="flex-1 relative flex flex-col justify-between overflow-y-auto overflow-x-hidden p-3 sm:p-5">
          {/* Generated Emerald Baize Felt Background + Fallback */}
          {!feltImgFailed ? (
            <img
              src={TABLE_FELT_IMAGE}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              onError={() => setFeltImgFailed(true)}
              className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover opacity-90"
            />
          ) : (
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,#115536_0%,#0B3B24_58%,#061F13_100%)]" />
          )}
          {/* Subtle vignette for card contrast */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(8,26,17,0.08)_0%,rgba(5,16,11,0.58)_100%)]" />

          {/* TOP OPPONENT ROW */}
          <div className="relative z-10 flex items-start justify-center gap-3 sm:gap-5 flex-wrap min-h-[76px]">
            {opponents.length === 0 ? (
              <div className="text-xs text-[#C5D1C9]/80 pt-2">
                Waiting for friends to join your table...
              </div>
            ) : opponents.length === 3 ? (
              <OpponentSeat
                player={opponents[1]}
                isHost={opponents[1].playerId === room.hostId}
                isTurn={
                  room.phase === 'PLAYING' &&
                  room.currentTurnPlayerId === opponents[1].playerId
                }
                phase={room.phase}
                reaction={latestReactionByPlayer.get(opponents[1].playerId)}
              />
            ) : (
              opponents.map((opp) => (
                <OpponentSeat
                  key={opp.playerId}
                  player={opp}
                  isHost={opp.playerId === room.hostId}
                  isTurn={
                    room.phase === 'PLAYING' &&
                    room.currentTurnPlayerId === opp.playerId
                  }
                  phase={room.phase}
                  reaction={latestReactionByPlayer.get(opp.playerId)}
                />
              ))
            )}
          </div>

          {/* MIDDLE ZONE: Side Opponents (when 4 players) + Center Felt Arena */}
          <div className="relative z-10 my-auto py-3 flex items-center justify-between gap-3">
            {/* Left Seat (4-player tables only) */}
            {opponents.length === 3 && (
              <div className="hidden md:block shrink-0">
                <OpponentSeat
                  player={opponents[0]}
                  isHost={opponents[0].playerId === room.hostId}
                  isTurn={
                    room.phase === 'PLAYING' &&
                    room.currentTurnPlayerId === opponents[0].playerId
                  }
                  phase={room.phase}
                  reaction={latestReactionByPlayer.get(opponents[0].playerId)}
                  compact
                />
              </div>
            )}

            {/* Center Arena */}
            <div className="mx-auto flex flex-col items-center justify-center w-full max-w-xl">
              {/* Mobile fallback seats for 4-player side opponents */}
              {opponents.length === 3 && (
                <div className="md:hidden grid grid-cols-2 gap-2 w-full mb-3">
                  {[opponents[0], opponents[2]].map((opp) => (
                    <OpponentSeat
                      key={opp.playerId}
                      player={opp}
                      isHost={opp.playerId === room.hostId}
                      isTurn={
                        room.phase === 'PLAYING' &&
                        room.currentTurnPlayerId === opp.playerId
                      }
                      phase={room.phase}
                      reaction={latestReactionByPlayer.get(opp.playerId)}
                      compact
                    />
                  ))}
                </div>
              )}

              {/* WAITING ROOM OVERLAY */}
              {room.phase === 'WAITING' && (
                <div className="w-full max-w-md rounded-2xl bg-[#0D1E16]/95 border border-[#D4AF37]/35 shadow-2xl p-6 text-center">
                  <p className="text-xs font-medium text-[#D4AF37]">
                    Private Salon · Classic + 7 Rules
                  </p>
                  <h2 className="mt-1.5 font-display text-2xl font-semibold text-[#FAF7F0]">
                    Invite Friends to the Table
                  </h2>
                  <p className="mt-1.5 text-xs text-[#B8C4BC]">
                    Share this table link or 6-character code. Match starts once 2 to{' '}
                    {room.maxPlayers} players are seated.
                  </p>

                  {/* Code & Copy Row */}
                  <div className="mt-5 flex items-center justify-center gap-2">
                    <div className="px-4 py-2.5 rounded-lg bg-[#08130E] border border-white/10 font-mono-tabular text-lg font-semibold tracking-[0.22em] text-[#D4AF37]">
                      {room.code}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyInviteClick}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1A382A] hover:bg-[#234A37] border border-[#D4AF37]/35 text-xs font-semibold text-[#FAF7F0] transition-colors whitespace-nowrap"
                    >
                      {copiedJustNow ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-[#D4AF37]" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Seated Roster */}
                  <div className="mt-5 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs text-[#9AA89F] mb-2.5">
                      <span>Seated Players</span>
                      <span className="font-mono-tabular">
                        {room.players.length} / {room.maxPlayers}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {room.players.map((p) => (
                        <div
                          key={p.playerId}
                          className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] text-xs"
                        >
                          <div className="flex items-center gap-2">
                            {p.playerId === room.hostId && (
                              <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />
                            )}
                            <span className="font-medium text-[#FAF7F0]">
                              {p.nickname}
                              {p.playerId === currentPlayerId ? ' (You)' : ''}
                            </span>
                          </div>
                          <span className="text-emerald-300">Ready</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5">
                    {isHost ? (
                      <button
                        type="button"
                        onClick={onStartGame}
                        disabled={room.players.length < 2}
                        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#D4AF37] text-[#0B1410] text-sm font-semibold hover:bg-[#E2C152] disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>
                          {room.players.length < 2
                            ? 'Waiting for at least 1 friend...'
                            : `Deal Cards (${room.players.length} Players)`}
                        </span>
                      </button>
                    ) : (
                      <p className="text-xs text-[#B8C4BC] py-2">
                        Waiting for{' '}
                        <strong className="text-[#FAF7F0]">
                          {room.players.find((p) => p.playerId === room.hostId)?.nickname ??
                            'Host'}
                        </strong>{' '}
                        to deal the cards...
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* SWAPPING PHASE BANNER */}
              {room.phase === 'SWAPPING' && me && (
                <div className="w-full max-w-lg rounded-2xl bg-[#0D1E16]/95 border border-[#D4AF37]/40 shadow-xl px-5 py-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#D4AF37]">
                    <Sparkles className="w-4 h-4" />
                    <span>Opening Palace Setup · {readyCount}/{room.players.length} Locked</span>
                  </div>
                  <p className="mt-1.5 text-sm text-[#E4EAE6]">
                    {me.ready
                      ? 'Your Palace is locked. Waiting for other players to lock their setup...'
                      : swapHandId
                        ? 'Now click one of your 3 face-up cards to swap it in.'
                        : swapFaceUpIdx !== null
                          ? 'Now click a card in your hand to place into that face-up slot.'
                          : 'Click any hand card and any face-up card to swap them. Place 2s, 10s, 7s, or Aces on top!'}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => onSetReady(!me.ready)}
                      className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                        me.ready
                          ? 'bg-white/10 hover:bg-white/15 text-[#FAF7F0] border border-white/15'
                          : 'bg-[#D4AF37] hover:bg-[#E2C152] text-[#0B1410]'
                      }`}
                    >
                      {me.ready ? 'Unlock to Keep Swapping' : 'Lock Setup & Ready'}
                    </button>
                  </div>
                </div>
              )}

              {/* ACTIVE PLAYING CENTER PILES */}
              {(room.phase === 'PLAYING' || room.phase === 'FINISHED') && (
                <div className="flex flex-col items-center gap-4">
                  {/* Explicit Rule Banner (Non-Hue-Only) */}
                  <div
                    className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border text-xs sm:text-sm font-medium shadow-md ${
                      ruleSummary.tone === 'seven'
                        ? 'bg-amber-950/90 border-amber-400/70 text-amber-100'
                        : ruleSummary.tone === 'reset'
                          ? 'bg-emerald-950/90 border-emerald-400/60 text-emerald-100'
                          : 'bg-[#0C1D15]/90 border-[#D4AF37]/30 text-[#FAF7F0]'
                    }`}
                  >
                    {ruleSummary.tone === 'seven' && (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span className="font-semibold whitespace-nowrap">{ruleSummary.label}</span>
                    <span className="text-white/40" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-white/85">{ruleSummary.detail}</span>
                  </div>

                  {/* Deck + Discard Pile + Burn Counter */}
                  <div className="flex items-center justify-center gap-6 sm:gap-10">
                    {/* Draw Deck */}
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="relative w-[74px] h-[106px] sm:w-[82px] sm:h-[118px] flex items-center justify-center">
                        {room.deckCount > 0 ? (
                          <>
                            {room.deckCount > 8 && (
                              <div className="absolute translate-x-1 translate-y-1 opacity-70">
                                <PlayingCard faceDown size="md" />
                              </div>
                            )}
                            {room.deckCount > 2 && (
                              <div className="absolute translate-x-0.5 translate-y-0.5 opacity-85">
                                <PlayingCard faceDown size="md" />
                              </div>
                            )}
                            <div className="relative z-10">
                              <PlayingCard faceDown size="md" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full rounded-lg border border-dashed border-white/20 flex items-center justify-center text-[11px] text-white/45 text-center px-2">
                            Deck Empty
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-mono-tabular text-[#D1DBD4]">
                        Deck · {room.deckCount}
                      </span>
                    </div>

                    {/* Discard Pile */}
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="relative w-[96px] h-[126px] sm:w-[112px] sm:h-[140px] flex items-center justify-center">
                        {visibleDiscardStack.length === 0 ? (
                          <div className="w-[82px] h-[118px] rounded-lg border border-dashed border-[#D4AF37]/40 bg-black/15 flex items-center justify-center text-xs text-[#C5D1C9]/70 text-center px-2">
                            Open Pile
                          </div>
                        ) : (
                          visibleDiscardStack.map((card, idx) => {
                            const offset = idx - (visibleDiscardStack.length - 1);
                            const rotation = offset * 6;
                            const translateX = offset * 7;
                            return (
                              <div
                                key={card.id}
                                style={{
                                  transform: `translateX(${translateX}px) rotate(${rotation}deg)`,
                                  zIndex: idx + 1,
                                }}
                                className="absolute transition-transform duration-200 ease-out"
                              >
                                <PlayingCard card={card} size="md" />
                              </div>
                            );
                          })
                        )}
                      </div>
                      <span className="text-xs font-mono-tabular text-[#D1DBD4]">
                        Pile · {room.discardPile.length}
                      </span>
                    </div>

                    {/* Burned Pile Indicator */}
                    <div className="hidden sm:flex flex-col items-center gap-1.5">
                      <div className="w-16 h-20 rounded-xl bg-[#0A1812]/80 border border-white/10 flex flex-col items-center justify-center gap-1">
                        <Flame
                          className={`w-5 h-5 ${
                            room.burnCount > 0 ? 'text-amber-400' : 'text-white/25'
                          }`}
                        />
                        <span className="font-mono-tabular text-sm font-semibold text-[#FAF7F0]">
                          {room.burnCount}
                        </span>
                      </div>
                      <span className="text-xs text-[#A8B6AD]">Burned</span>
                    </div>
                  </div>

                  {/* Last Action Feed Line */}
                  {room.lastPlay && (
                    <p className="text-xs sm:text-sm text-[#E4EAE6]/90 text-center max-w-md px-3 py-1 rounded-lg bg-black/30">
                      {room.lastPlay.message}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right Seat (4-player tables only) */}
            {opponents.length === 3 && (
              <div className="hidden md:block shrink-0">
                <OpponentSeat
                  player={opponents[2]}
                  isHost={opponents[2].playerId === room.hostId}
                  isTurn={
                    room.phase === 'PLAYING' &&
                    room.currentTurnPlayerId === opponents[2].playerId
                  }
                  phase={room.phase}
                  reaction={latestReactionByPlayer.get(opponents[2].playerId)}
                  compact
                />
              </div>
            )}
          </div>

          {/* BOTTOM ZONE: CURRENT PLAYER PALACE + HAND + ACTION BAR */}
          {me && (
            <div className="relative z-20 mt-auto pt-2 flex flex-col items-center gap-3">
              {/* Self Floating Reaction */}
              <div className="relative w-full max-w-3xl flex flex-col items-center">
                <FloatingReactionBubble
                  reaction={latestReactionByPlayer.get(currentPlayerId)}
                />

                {/* Turn Status + Action Controls + Quick Mock Bar */}
                {room.phase === 'PLAYING' && (
                  <div className="w-full flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl bg-[#0B1B13]/92 border border-[#D4AF37]/25 shadow-lg mb-3">
                    {/* Turn Indicator */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-xs sm:text-sm font-semibold ${
                          isMyTurn ? 'text-[#D4AF37]' : 'text-[#A8B6AD]'
                        }`}
                      >
                        {isMyTurn
                          ? myZone === 'FACE_DOWN'
                            ? 'Your Turn · Flip a Blind Palace Card'
                            : myZone === 'FACE_UP'
                              ? 'Your Turn · Play from Face-Up Palace'
                              : hasAnyLegalPlay
                                ? 'Your Turn · Select matching cards to play'
                                : 'Your Turn · No playable card — Pick Up Pile'
                          : `Waiting for ${currentTurnName}...`}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {myZone !== 'FACE_DOWN' && (
                        <button
                          type="button"
                          onClick={handleConfirmPlay}
                          disabled={!isMyTurn || selectedCards.length === 0}
                          className="px-4 py-2 rounded-lg bg-[#D4AF37] text-[#0B1410] text-xs sm:text-sm font-semibold hover:bg-[#E2C152] disabled:opacity-35 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          {selectedCards.length > 0
                            ? `Play ${
                                selectedCards.length > 1
                                  ? `${selectedCards.length}× ${selectedCards[0].rank}`
                                  : selectedCards[0].rank
                              }`
                            : 'Play Selected'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={onPickupPile}
                        disabled={!isMyTurn || room.discardPile.length === 0}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap disabled:opacity-35 disabled:cursor-not-allowed ${
                          isMyTurn && !hasAnyLegalPlay && room.discardPile.length > 0
                            ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-300/60'
                            : 'bg-[#173024] hover:bg-[#204232] text-[#FAF7F0] border border-white/15'
                        }`}
                      >
                        <Hand className="w-3.5 h-3.5" />
                        <span>Pick Up ({room.discardPile.length})</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Player's 3 Palace Stacks (Face-Down under Face-Up) + Hand */}
                {room.phase !== 'WAITING' && (
                  <div className="w-full flex flex-col lg:flex-row items-center justify-center gap-5 lg:gap-8">
                    {/* 3 Palace Slots */}
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      <div className="flex items-center gap-2.5">
                        {[0, 1, 2].map((slotIdx) => {
                          const upCard = me.faceUp[slotIdx];
                          const hasDown = me.faceDownSlots[slotIdx];

                          const canSwapHere = room.phase === 'SWAPPING' && !me.ready && upCard !== null;
                          const isSwapTarget = swapFaceUpIdx === slotIdx;

                          const canPlayFaceUp =
                            isMyTurn &&
                            myZone === 'FACE_UP' &&
                            upCard !== null &&
                            isRankPlayableOnPile(upCard.rank, room.discardPile);
                          const isFaceUpSelected =
                            upCard !== null && selectedCardIds.includes(upCard.id);

                          const canFlipBlind =
                            isMyTurn && myZone === 'FACE_DOWN' && !upCard && hasDown;

                          return (
                            <div
                              key={slotIdx}
                              className="relative w-[74px] h-[108px] sm:w-[82px] sm:h-[120px] flex items-center justify-center"
                            >
                              {!upCard && !hasDown ? (
                                <div className="w-full h-full rounded-lg border border-dashed border-white/15 flex items-center justify-center text-[10px] text-white/35">
                                  Cleared
                                </div>
                              ) : (
                                <>
                                  {/* Face-Down Card Underneath */}
                                  {hasDown && (
                                    <div
                                      className={
                                        upCard
                                          ? 'absolute top-1.5 left-1 opacity-90 pointer-events-none'
                                          : 'relative z-10'
                                      }
                                    >
                                      <PlayingCard
                                        faceDown
                                        size="md"
                                        interactive={canFlipBlind}
                                        playable={canFlipBlind}
                                        onClick={() => canFlipBlind && onFlipFaceDown(slotIdx)}
                                        ariaLabel={`Flip blind Palace card ${slotIdx + 1}`}
                                      />
                                    </div>
                                  )}

                                  {/* Face-Up Card On Top */}
                                  {upCard && (
                                    <div className="relative z-10 -translate-y-1">
                                      <PlayingCard
                                        card={upCard}
                                        size="md"
                                        interactive={canSwapHere || canPlayFaceUp}
                                        selected={isSwapTarget || isFaceUpSelected}
                                        playable={canSwapHere || canPlayFaceUp}
                                        dimmed={
                                          isMyTurn &&
                                          myZone === 'FACE_UP' &&
                                          !isRankPlayableOnPile(upCard.rank, room.discardPile)
                                        }
                                        onClick={() => {
                                          if (canSwapHere) {
                                            handleSwapFaceUpClick(slotIdx);
                                          } else if (canPlayFaceUp) {
                                            handlePlayCardClick(upCard);
                                          }
                                        }}
                                        onDoubleClick={() => {
                                          if (canPlayFaceUp) {
                                            handlePlayCardDoubleClick(upCard);
                                          }
                                        }}
                                      />
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <span className="text-[11px] text-[#C5D1C9]/80 font-mono-tabular">
                        Your Palace · {me.faceUp.filter(Boolean).length} up · {me.faceDownCount} down
                      </span>
                    </div>

                    {/* Player's Hand */}
                    <div className="flex flex-col items-center gap-1.5 min-w-0 max-w-full">
                      {myHand.length === 0 ? (
                        <div className="h-[118px] px-6 rounded-xl border border-dashed border-white/15 flex items-center justify-center text-xs text-[#A8B6AD]">
                          {myZone === 'FACE_UP'
                            ? 'Hand empty — play your Face-Up Palace cards'
                            : myZone === 'FACE_DOWN'
                              ? 'Flip a Face-Down Palace card to finish!'
                              : 'All cards cleared!'}
                        </div>
                      ) : (
                        <div className="flex items-end justify-center overflow-x-auto max-w-full pt-5 pb-1 px-3">
                          {myHand.map((card, idx) => {
                            const canSwap = room.phase === 'SWAPPING' && !me.ready;
                            const canPlay =
                              isMyTurn &&
                              myZone === 'HAND' &&
                              isRankPlayableOnPile(card.rank, room.discardPile);
                            const isSelected =
                              room.phase === 'SWAPPING'
                                ? swapHandId === card.id
                                : selectedCardIds.includes(card.id);

                            const overlapClass =
                              idx === 0
                                ? ''
                                : myHand.length > 8
                                  ? '-ml-9 sm:-ml-8'
                                  : myHand.length > 5
                                    ? '-ml-6 sm:-ml-5'
                                    : '-ml-2 sm:-ml-1.5';

                            return (
                              <div
                                key={card.id}
                                className={`${overlapClass} transition-all duration-150 hover:z-30 ${
                                  isSelected ? 'z-20' : 'z-10'
                                }`}
                              >
                                <PlayingCard
                                  card={card}
                                  size="md"
                                  interactive={canSwap || canPlay}
                                  selected={isSelected}
                                  playable={canSwap || canPlay}
                                  dimmed={isMyTurn && myZone === 'HAND' && !canPlay}
                                  onClick={() => {
                                    if (canSwap) {
                                      handleSwapHandClick(card);
                                    } else if (canPlay) {
                                      handlePlayCardClick(card);
                                    }
                                  }}
                                  onDoubleClick={() => {
                                    if (canPlay) {
                                      handlePlayCardDoubleClick(card);
                                    }
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-[11px] text-[#C5D1C9]/85">
                        <span className="font-semibold text-[#FAF7F0]">{me.nickname}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">{myHand.length} in hand</span>
                        {!chatOpen && (
                          <>
                            <span aria-hidden="true">·</span>
                            <div className="inline-flex items-center gap-1">
                              {MOCK_EMOJIS.slice(0, 6).map((item) => (
                                <button
                                  key={`quick-${item.emoji}`}
                                  type="button"
                                  onClick={() => onSendReaction(item.emoji, item.defaultTaunt)}
                                  title={`Mock: ${item.defaultTaunt}`}
                                  className="w-6 h-6 rounded hover:bg-white/15 flex items-center justify-center text-sm transition-transform active:scale-90"
                                >
                                  {item.emoji}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VICTORY / MATCH SUMMARY MODAL */}
          {room.phase === 'FINISHED' && room.standings && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="match-summary-title"
            >
              <div className="w-full max-w-lg rounded-2xl bg-[#102018] border border-[#D4AF37]/45 shadow-2xl p-6 sm:p-7">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center mx-auto">
                    <Trophy className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                  <p className="mt-3 text-xs font-medium text-[#D4AF37]">
                    Match #{room.matchNumber} Complete · Leaderboard Updated
                  </p>
                  <h2
                    id="match-summary-title"
                    className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[#FAF7F0]"
                  >
                    {room.standings[0]?.nickname} Claims the Palace
                  </h2>
                </div>

                <div className="mt-6 rounded-xl bg-[#0A1510] border border-white/10 overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] text-[#9AA89F]">
                        <th className="py-2.5 pl-4 pr-2">#</th>
                        <th className="py-2.5 px-2">Player</th>
                        <th className="py-2.5 px-2 text-right">Left</th>
                        <th className="py-2.5 px-2 text-right">Burns</th>
                        <th className="py-2.5 pl-2 pr-4 text-right">Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {room.standings.map((s) => (
                        <tr
                          key={s.playerId}
                          className={s.playerId === currentPlayerId ? 'bg-[#D4AF37]/10' : ''}
                        >
                          <td className="py-2.5 pl-4 pr-2 font-mono-tabular font-semibold text-[#D4AF37]">
                            #{s.place}
                          </td>
                          <td className="py-2.5 px-2 font-medium text-[#FAF7F0]">
                            {s.nickname}
                            {s.playerId === currentPlayerId ? ' (You)' : ''}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono-tabular text-[#B8C4BC]">
                            {s.remainingCards}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono-tabular text-[#B8C4BC]">
                            {s.burns}
                          </td>
                          <td className="py-2.5 pl-2 pr-4 text-right font-mono-tabular">
                            <span className="font-semibold text-[#FAF7F0]">{s.ratingAfter}</span>{' '}
                            <span
                              className={
                                s.ratingDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }
                            >
                              ({s.ratingDelta >= 0 ? `+${s.ratingDelta}` : s.ratingDelta})
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onOpenLeaderboard}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs sm:text-sm font-medium text-[#E4EAE6] transition-colors whitespace-nowrap"
                  >
                    Global Leaderboard
                  </button>
                  {isHost ? (
                    <button
                      type="button"
                      onClick={onRematch}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#E2C152] text-[#0B1410] text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Play Rematch</span>
                    </button>
                  ) : (
                    <span className="text-xs text-[#A8B6AD] px-2">
                      Waiting for host to deal rematch...
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Table Chat + Mocking Emojis Drawer */}
        <TableChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          messages={room.chatMessages}
          currentPlayerId={currentPlayerId}
          onSendMessage={onSendChat}
          onSendReaction={onSendReaction}
        />
      </div>
    </div>
  );
};
