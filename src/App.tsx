/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { LobbyView } from './components/LobbyView';
import { LeaderboardView } from './components/LeaderboardView';
import { GameTableView } from './components/GameTableView';
import { RulesModal } from './components/RulesModal';
import { usePalaceSocket } from './hooks/usePalaceSocket';
import {
  getOrCreatePlayerId,
  getStoredMuted,
  getStoredNickname,
  setStoredMuted,
  setStoredNickname,
} from './utils/playerIdentity';
import { salonSound } from './utils/sound';

type AppView = 'lobby' | 'leaderboard';

interface ToastState {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

function readRoomParamFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('room')?.trim().toUpperCase() ?? '';
    if (/^[A-Z0-9]{4,8}$/.test(raw)) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

function syncRoomParamToUrl(code: string | null): void {
  try {
    const url = new URL(window.location.href);
    if (code) {
      url.searchParams.set('room', code);
    } else {
      url.searchParams.delete('room');
    }
    window.history.replaceState({}, '', url.toString());
  } catch {
    // Ignore history API failures in restricted frames
  }
}

export default function App() {
  const [playerId] = useState<string>(() => getOrCreatePlayerId());
  const [nickname, setNickname] = useState<string>(() => getStoredNickname());
  const [muted, setMuted] = useState<boolean>(() => {
    const initial = getStoredMuted();
    salonSound.setMuted(initial);
    return initial;
  });
  const [view, setView] = useState<AppView>('lobby');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [inviteRoomCode, setInviteRoomCode] = useState<string | null>(() =>
    readRoomParamFromUrl()
  );
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((text: string, tone: 'info' | 'error' = 'info') => {
    const id = Date.now();
    setToast({ id, text, tone });
    window.setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 3600);
  }, []);

  const handleRoomCodeChange = useCallback((code: string | null) => {
    syncRoomParamToUrl(code);
    if (code) {
      setInviteRoomCode(null);
    }
  }, []);

  const socket = usePalaceSocket({
    playerId,
    nickname,
    onError: (msg) => showToast(msg, 'error'),
    onRoomCodeChange: handleRoomCodeChange,
  });

  // Auto-join if user arrived via invite link AND already has a saved nickname
  const [autoJoinedInvite, setAutoJoinedInvite] = useState(false);
  useEffect(() => {
    if (
      !autoJoinedInvite &&
      inviteRoomCode &&
      nickname.trim().length >= 1 &&
      !socket.room &&
      socket.status === 'connected'
    ) {
      setAutoJoinedInvite(true);
      socket.joinTable(inviteRoomCode, nickname.trim());
    }
  }, [autoJoinedInvite, inviteRoomCode, nickname, socket]);

  const handleNicknameChange = (next: string) => {
    const trimmed = next.slice(0, 20);
    setNickname(trimmed);
    setStoredNickname(trimmed);
  };

  const handleToggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      salonSound.setMuted(next);
      setStoredMuted(next);
      return next;
    });
  };

  const handleHostTable = (maxPlayers: number) => {
    const name = nickname.trim() || `Player${playerId.slice(0, 4).toUpperCase()}`;
    if (!nickname.trim()) {
      handleNicknameChange(name);
    }
    socket.createTable(maxPlayers, name);
  };

  const handleJoinTable = (code: string) => {
    const name = nickname.trim();
    if (!name) {
      showToast('Enter a nickname before joining a table.', 'error');
      return;
    }
    socket.joinTable(code, name);
  };

  const handleCopyInviteLink = () => {
    if (!socket.room) return;
    const url = new URL(window.location.href);
    url.searchParams.set('room', socket.room.code);
    const shareUrl = url.toString();

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => showToast('Invite link copied — share it with your friends!', 'info'))
        .catch(() => showToast(`Share code ${socket.room?.code ?? ''}`, 'info'));
    } else {
      showToast(`Share table code ${socket.room.code}`, 'info');
    }
  };

  const handleOpenLeaderboardFromTable = () => {
    socket.leaveTable();
    setView('leaderboard');
  };

  // Active Game Table takes full viewport
  if (socket.room) {
    return (
      <>
        <GameTableView
          room={socket.room}
          currentPlayerId={playerId}
          connectionStatus={socket.status}
          reactions={socket.reactions}
          muted={muted}
          onToggleMute={handleToggleMute}
          onOpenRules={() => setRulesOpen(true)}
          onOpenLeaderboard={handleOpenLeaderboardFromTable}
          onLeaveTable={socket.leaveTable}
          onStartGame={socket.startGame}
          onSwapCard={socket.swapCard}
          onSetReady={socket.setReady}
          onPlayCards={socket.playSelectedCards}
          onFlipFaceDown={socket.flipFaceDownCard}
          onPickupPile={socket.pickupPile}
          onRematch={socket.requestRematch}
          onSendChat={socket.sendChatMessage}
          onSendReaction={socket.sendReaction}
          onCopyInvite={handleCopyInviteLink}
        />

        <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-medium shadow-2xl ${
              toast.tone === 'error'
                ? 'bg-rose-950/95 border-rose-400/50 text-rose-100'
                : 'bg-[#10241A]/95 border-[#D4AF37]/50 text-[#FAF7F0]'
            }`}
          >
            {toast.text}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0B1410] text-[#FAF7F0]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#0B1410]/95 backdrop-blur-xs border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand wordmark */}
          <button
            type="button"
            onClick={() => setView('lobby')}
            className="font-display text-lg sm:text-xl font-semibold tracking-tight text-[#FAF7F0] whitespace-nowrap shrink-0"
          >
            Royal Salon Palace
          </button>

          {/* Zone 2: Clean single-line text nav links */}
          <nav className="flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => setView('lobby')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                view === 'lobby'
                  ? 'text-[#D4AF37] underline underline-offset-8 decoration-[#D4AF37]'
                  : 'text-[#B8C4BC] hover:text-white'
              }`}
            >
              Lobby
            </button>
            <button
              type="button"
              onClick={() => setView('leaderboard')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                view === 'leaderboard'
                  ? 'text-[#D4AF37] underline underline-offset-8 decoration-[#D4AF37]'
                  : 'text-[#B8C4BC] hover:text-white'
              }`}
            >
              Leaderboard
            </button>
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              className="text-[#B8C4BC] hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Rules
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => {
                if (view !== 'lobby') {
                  setView('lobby');
                  return;
                }
                handleHostTable(4);
              }}
              className="px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E2C152] text-[#0B1410] text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              Host Table
            </button>
          </div>
        </div>
      </header>

      {/* Active Page Content */}
      <div className="flex-1">
        {view === 'lobby' ? (
          <LobbyView
            nickname={nickname}
            onNicknameChange={handleNicknameChange}
            inviteRoomCode={inviteRoomCode}
            onClearInvite={() => {
              setInviteRoomCode(null);
              syncRoomParamToUrl(null);
            }}
            onHostTable={handleHostTable}
            onJoinTable={handleJoinTable}
            onOpenRules={() => setRulesOpen(true)}
            connectionStatus={socket.status}
          />
        ) : (
          <LeaderboardView
            currentPlayerId={playerId}
            onHostClick={() => setView('lobby')}
          />
        )}
      </div>

      {/* Quiet Footer */}
      <footer className="border-t border-white/10 py-6 mt-12">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#829288]">
          <span>Royal Salon Palace · Classic + 7 Real-Time Card Table</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              className="hover:text-[#FAF7F0] transition-colors"
            >
              Palace Rules
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setView('leaderboard')}
              className="hover:text-[#FAF7F0] transition-colors"
            >
              Global Standings
            </button>
          </div>
        </div>
      </footer>

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-medium shadow-2xl ${
            toast.tone === 'error'
              ? 'bg-rose-950/95 border-rose-400/50 text-rose-100'
              : 'bg-[#10241A]/95 border-[#D4AF37]/50 text-[#FAF7F0]'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
