import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, KeyRound, Users } from 'lucide-react';
import { PlayingCard } from './PlayingCard';

const HERO_IMAGE = '/src/assets/images/salon_hero_showcase_1795605616438.jpg';

interface RoomPreview {
  exists: boolean;
  code?: string;
  phase?: string;
  playerCount?: number;
  maxPlayers?: number;
  hostName?: string;
}

interface LobbyViewProps {
  nickname: string;
  onNicknameChange: (name: string) => void;
  inviteRoomCode: string | null;
  onClearInvite: () => void;
  onHostTable: (maxPlayers: number) => void;
  onJoinTable: (code: string) => void;
  onOpenRules: () => void;
  connectionStatus: 'connecting' | 'connected' | 'reconnecting';
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  nickname,
  onNicknameChange,
  inviteRoomCode,
  onClearInvite,
  onHostTable,
  onJoinTable,
  onOpenRules,
  connectionStatus,
}) => {
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [joinCode, setJoinCode] = useState<string>(inviteRoomCode ?? '');
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [invitePreview, setInvitePreview] = useState<RoomPreview | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteRoomCode) {
      setInvitePreview(null);
      return;
    }
    setJoinCode(inviteRoomCode);
    let cancelled = false;

    fetch(`/api/rooms/${encodeURIComponent(inviteRoomCode)}`)
      .then((res) => (res.ok ? res.json() : { exists: false }))
      .then((data: RoomPreview) => {
        if (!cancelled) setInvitePreview(data);
      })
      .catch(() => {
        if (!cancelled) setInvitePreview(null);
      });

    return () => {
      cancelled = true;
    };
  }, [inviteRoomCode]);

  const validateNickname = (): boolean => {
    if (nickname.trim().length < 1) {
      setFormError('Enter a player nickname first to take a seat.');
      return false;
    }
    setFormError(null);
    return true;
  };

  const handleHostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateNickname()) return;
    onHostTable(maxPlayers);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateNickname()) return;
    const cleaned = joinCode.trim().toUpperCase();
    if (cleaned.length < 4) {
      setFormError('Enter a valid 6-character table code.');
      return;
    }
    setFormError(null);
    onJoinTable(cleaned);
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:py-12">
      {/* Direct Friend Invite Banner */}
      {inviteRoomCode && (
        <section
          aria-label="Private table invitation"
          className="mb-8 rounded-2xl bg-[#13291E] border border-[#D4AF37]/45 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-lg"
        >
          <div>
            <p className="text-xs font-medium text-[#D4AF37]">
              Private Table Invitation · Code{' '}
              <span className="font-mono-tabular font-semibold">{inviteRoomCode}</span>
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-[#FAF7F0]">
              {invitePreview?.exists
                ? `${invitePreview.hostName}'s Palace Table is ready`
                : `Join Private Table ${inviteRoomCode}`}
            </h2>
            <p className="mt-1 text-sm text-[#B8C4BC]">
              {invitePreview?.exists
                ? `${invitePreview.playerCount} of ${invitePreview.maxPlayers} players seated · Classic + 7 Rules`
                : 'Enter your nickname below and take your seat immediately.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (!validateNickname()) return;
                onJoinTable(inviteRoomCode);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#D4AF37] text-[#0B1410] text-sm font-semibold hover:bg-[#E2C152] transition-colors whitespace-nowrap shrink-0"
            >
              <span>Join Table Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClearInvite}
              className="px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-[#CBD6CF] transition-colors whitespace-nowrap shrink-0"
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {/* Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Column: Title + Nickname + Host/Join Controls */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-7">
          <div>
            <p className="text-xs font-medium text-[#D4AF37] tracking-wide">
              Classic + 7 Rules · 2–4 Real Players · Zero-Signup Tables
            </p>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl font-semibold text-[#FAF7F0] tracking-tight leading-[1.08] text-balance">
              Classic Palace, dealt live on emerald felt.
            </h1>
            <p className="mt-4 text-base text-[#B8C4BC] leading-relaxed max-w-xl">
              Host a private salon table, send your friends a direct link, master the Special 7
              lower-or-equal rule, and mock big pile pickups with live tabletop emoji taunts.
            </p>
          </div>

          {/* Player Nickname Strip */}
          <div className="rounded-xl bg-[#112019] border border-white/10 p-5">
            <div className="flex items-center justify-between gap-4">
              <label
                htmlFor="salon-nickname"
                className="text-xs font-medium text-[#CBD6CF]"
              >
                Your Table Nickname
              </label>
              <span className="text-xs text-[#8E9E94]">
                {connectionStatus === 'connected'
                  ? 'Salon Ready · Saved for Global Leaderboard'
                  : 'Connecting to salon server...'}
              </span>
            </div>
            <input
              id="salon-nickname"
              type="text"
              value={nickname}
              onChange={(e) => {
                setFormError(null);
                onNicknameChange(e.target.value);
              }}
              placeholder="e.g. LadyHearts, AceHigh, Victor..."
              maxLength={20}
              className="mt-2.5 w-full px-4 py-2.5 rounded-lg bg-[#0A140F] border border-white/15 text-base text-[#FAF7F0] placeholder:text-[#6E7D74] focus:outline-none focus:border-[#D4AF37]"
            />
            {formError && (
              <p className="mt-2 text-xs text-amber-300" role="alert">
                {formError}
              </p>
            )}
          </div>

          {/* Host & Join Side-by-Side Panels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Host Table */}
            <form
              onSubmit={handleHostSubmit}
              className="rounded-xl bg-[#112019] border border-[#D4AF37]/30 p-5 flex flex-col justify-between gap-5"
            >
              <div>
                <div className="flex items-center gap-2 text-[#FAF7F0] font-semibold">
                  <Users className="w-4 h-4 text-[#D4AF37]" />
                  <span>Host Private Table</span>
                </div>
                <p className="mt-1.5 text-xs text-[#9AA89F] leading-relaxed">
                  Create a private room and share the invite link with 1–3 friends.
                </p>

                <div className="mt-4">
                  <span className="block text-xs text-[#B8C4BC] mb-2">Table Size</span>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[#0A140F] border border-white/10">
                    {[2, 3, 4].map((seats) => (
                      <button
                        key={seats}
                        type="button"
                        onClick={() => setMaxPlayers(seats)}
                        className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          maxPlayers === seats
                            ? 'bg-[#D4AF37] text-[#0B1410] font-semibold'
                            : 'text-[#B8C4BC] hover:text-white'
                        }`}
                      >
                        {seats} Players
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#D4AF37] text-[#0B1410] text-sm font-semibold hover:bg-[#E2C152] transition-colors whitespace-nowrap"
              >
                <span>Create & Host Table</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Join Table */}
            <form
              onSubmit={handleJoinSubmit}
              className="rounded-xl bg-[#112019] border border-white/10 p-5 flex flex-col justify-between gap-5"
            >
              <div>
                <div className="flex items-center gap-2 text-[#FAF7F0] font-semibold">
                  <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                  <span>Join with Code</span>
                </div>
                <p className="mt-1.5 text-xs text-[#9AA89F] leading-relaxed">
                  Have a 6-character code from a friend? Enter it below to sit right in.
                </p>

                <div className="mt-4">
                  <label htmlFor="room-code-input" className="block text-xs text-[#B8C4BC] mb-2">
                    Room Code
                  </label>
                  <input
                    id="room-code-input"
                    type="text"
                    value={joinCode}
                    onChange={(e) => {
                      setFormError(null);
                      setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                    }}
                    placeholder="E.g. K7P4M2"
                    maxLength={6}
                    className="w-full px-3.5 py-2 rounded-lg bg-[#0A140F] border border-white/15 font-mono-tabular text-sm tracking-widest uppercase text-[#FAF7F0] placeholder:text-[#66766C] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1C382A] hover:bg-[#244836] border border-[#D4AF37]/30 text-[#FAF7F0] text-sm font-semibold transition-colors whitespace-nowrap"
              >
                <span>Join Table</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Editorial Salon Showcase */}
        <div className="lg:col-span-5 relative rounded-2xl overflow-hidden border border-[#D4AF37]/25 bg-[#0F271B] min-h-[300px] lg:min-h-0 flex flex-col justify-end">
          {!heroImgFailed ? (
            <img
              src={HERO_IMAGE}
              alt="Classic emerald baize Palace card salon table with ivory playing cards and brass trim"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#0F4D30] via-[#0B3320] to-[#081C12]" />
          )}

          {/* Measured contrast scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#07110C]/95 via-[#07110C]/45 to-transparent" />

          <div className="relative p-6">
            <div className="flex items-center gap-3 mb-4">
              <PlayingCard card={{ id: 'h-2', rank: '2', suit: 'diamonds' }} size="xs" />
              <PlayingCard card={{ id: 'h-7', rank: '7', suit: 'spades' }} size="xs" />
              <PlayingCard card={{ id: 'h-10', rank: '10', suit: 'hearts' }} size="xs" />
            </div>
            <h2 className="font-display text-xl font-semibold text-[#FAF7F0]">
              Built for Competitive Card Nights
            </h2>
            <ul className="mt-2.5 space-y-1.5 text-xs text-[#D1DBD4]">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                <span>Server-verified hidden hands and blind face-down cards</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                <span>Instant shareable links with automatic reconnection</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                <span>Live emoji taunts floating right over the emerald felt</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Special Cards Quick Reference Row */}
      <section className="mt-12 pt-8 border-t border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[#FAF7F0]">
              Classic + 7 House Rules
            </h2>
            <p className="mt-1 text-sm text-[#9AA89F]">
              Every special card interaction enforced automatically by the table dealer.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenRules}
            className="text-sm font-medium text-[#D4AF37] hover:text-[#E8CB67] underline underline-offset-4 self-start sm:self-auto whitespace-nowrap"
          >
            Read Complete Rules
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="rounded-xl bg-[#112019] border border-white/10 p-5">
            <div className="font-mono-tabular text-sm font-semibold text-emerald-300">
              2 · Wild Reset
            </div>
            <p className="mt-2 text-xs text-[#B8C4BC] leading-relaxed">
              Playable on any card (even on a 7). Resets the pile so the next player may open with
              any rank.
            </p>
          </div>
          <div className="rounded-xl bg-[#112019] border border-amber-400/25 p-5">
            <div className="font-mono-tabular text-sm font-semibold text-amber-300">
              7 · Special Lower Rule
            </div>
            <p className="mt-2 text-xs text-[#B8C4BC] leading-relaxed">
              Forces the next player to play a card of rank 7 or lower (3–7), or escape with a
              wild 2 or 10.
            </p>
          </div>
          <div className="rounded-xl bg-[#112019] border border-white/10 p-5">
            <div className="font-mono-tabular text-sm font-semibold text-rose-300">
              10 · Pile Burn
            </div>
            <p className="mt-2 text-xs text-[#B8C4BC] leading-relaxed">
              Playable on any card. Burns the entire discard stack out of the match and grants an
              immediate extra turn.
            </p>
          </div>
          <div className="rounded-xl bg-[#112019] border border-white/10 p-5">
            <div className="font-mono-tabular text-sm font-semibold text-[#D4AF37]">
              4× · Four of a Kind
            </div>
            <p className="mt-2 text-xs text-[#B8C4BC] leading-relaxed">
              Stacking 4 matching ranks consecutively on the discard pile triggers a burn and awards
              another turn.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};
