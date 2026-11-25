import React, { useCallback, useEffect, useState } from 'react';
import { Flame, RefreshCw, Search, Trophy } from 'lucide-react';
import type { LeaderboardEntry } from '../shared/types';

type SortOption = 'rating' | 'wins' | 'winRate' | 'burns';

interface LeaderboardViewProps {
  currentPlayerId: string;
  onHostClick: () => void;
}

const SORT_TABS: { id: SortOption; label: string }[] = [
  { id: 'rating', label: 'Rating' },
  { id: 'wins', label: 'Wins' },
  { id: 'winRate', label: 'Win Rate' },
  { id: 'burns', label: 'Pile Burns' },
];

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  currentPlayerId,
  onHostClick,
}) => {
  const [sort, setSort] = useState<SortOption>('rating');
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myProfile, setMyProfile] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        sort,
        limit: '50',
      });
      if (search.trim()) {
        params.set('search', search.trim());
      }
      const [lbRes, meRes] = await Promise.all([
        fetch(`/api/leaderboard?${params.toString()}`),
        fetch(`/api/player/${encodeURIComponent(currentPlayerId)}`),
      ]);
      if (!lbRes.ok) {
        throw new Error('Could not load global rankings.');
      }
      const lbData = (await lbRes.json()) as { entries: LeaderboardEntry[] };
      setEntries(lbData.entries ?? []);

      if (meRes.ok) {
        const meData = (await meRes.json()) as { profile: LeaderboardEntry | null };
        setMyProfile(meData.profile ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [sort, search, currentPlayerId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchLeaderboard();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [fetchLeaderboard]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/10">
        <div>
          <p className="text-xs font-medium text-[#D4AF37] tracking-wide">
            Global Salon Standings · Server-Verified Elo
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-semibold text-[#FAF7F0] tracking-tight text-balance">
            Palace Leaderboard
          </h1>
          <p className="mt-2 text-sm text-[#A8B6AD] max-w-xl">
            Rankings update automatically after every completed multiplayer match. Win streaks,
            pile burns, and opponent strength determine rating gains.
          </p>
        </div>

        {myProfile && myProfile.matchesPlayed > 0 && (
          <div className="rounded-xl bg-[#12211A] border border-[#D4AF37]/25 px-5 py-3.5 flex items-center gap-6 shrink-0">
            <div>
              <div className="text-xs text-[#9AA89F]">Your Rank</div>
              <div className="mt-0.5 font-mono-tabular text-xl font-semibold text-[#D4AF37]">
                #{myProfile.rank}
              </div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <div className="text-xs text-[#9AA89F]">Rating</div>
              <div className="mt-0.5 font-mono-tabular text-xl font-semibold text-[#FAF7F0]">
                {myProfile.rating}
              </div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <div className="text-xs text-[#9AA89F]">Record</div>
              <div className="mt-0.5 font-mono-tabular text-sm font-medium text-[#D8E0DA]">
                {myProfile.wins}W · {myProfile.losses}L ({myProfile.winRate}%)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar: Sort tabs + Search + Refresh */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div
          className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#12211A] border border-white/10 self-start"
          role="tablist"
          aria-label="Sort leaderboard"
        >
          {SORT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={sort === tab.id}
              onClick={() => setSort(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                sort === tab.id
                  ? 'bg-[#D4AF37] text-[#0B1410] font-semibold'
                  : 'text-[#B8C4BC] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#8A9990] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player name..."
              maxLength={32}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#12211A] border border-white/10 text-sm text-[#FAF7F0] placeholder:text-[#7E8D83] focus:outline-none focus:border-[#D4AF37]/70"
            />
          </div>
          <button
            type="button"
            onClick={() => void fetchLeaderboard()}
            aria-label="Refresh leaderboard"
            className="p-2.5 rounded-lg bg-[#12211A] border border-white/10 text-[#C5D1C9] hover:text-white hover:border-[#D4AF37]/40 transition-colors shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 rounded-2xl bg-[#112019] border border-white/10 overflow-hidden">
        {error ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm text-rose-300">{error}</p>
            <button
              type="button"
              onClick={() => void fetchLeaderboard()}
              className="mt-4 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium text-white transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : loading && entries.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-[#9AA89F]">
            Loading global standings...
          </div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Trophy className="w-8 h-8 text-[#D4AF37]/70 mx-auto" />
            <h2 className="mt-3 font-display text-xl font-semibold text-[#FAF7F0]">
              {search.trim() ? 'No matching players found' : 'The Salon Ledger Awaits'}
            </h2>
            <p className="mt-1.5 text-sm text-[#9AA89F] max-w-md mx-auto">
              {search.trim()
                ? 'Try another nickname or clear your search filter.'
                : 'Complete your first multiplayer Palace match with a friend to claim the #1 seat on the global leaderboard.'}
            </p>
            {!search.trim() && (
              <button
                type="button"
                onClick={onHostClick}
                className="mt-5 px-5 py-2.5 rounded-lg bg-[#D4AF37] text-[#0B1410] text-sm font-semibold hover:bg-[#E2C152] transition-colors whitespace-nowrap"
              >
                Host First Table
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs font-medium text-[#9AA89F]">
                  <th className="py-3.5 pl-6 pr-4 w-16">Rank</th>
                  <th className="py-3.5 px-4">Player</th>
                  <th className="py-3.5 px-4 text-right">Rating</th>
                  <th className="py-3.5 px-4 text-right">Wins</th>
                  <th className="py-3.5 px-4 text-right">Matches</th>
                  <th className="py-3.5 px-4 text-right">Win Rate</th>
                  <th className="py-3.5 px-4 text-right">Burns</th>
                  <th className="py-3.5 pl-4 pr-6 text-right">Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {entries.map((entry) => {
                  const isMe = entry.playerId === currentPlayerId;
                  return (
                    <tr
                      key={entry.playerId}
                      className={`transition-colors ${
                        isMe
                          ? 'bg-[#D4AF37]/10'
                          : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <td className="py-3.5 pl-6 pr-4 font-mono-tabular font-semibold">
                        <span
                          className={
                            entry.rank === 1
                              ? 'text-[#D4AF37]'
                              : entry.rank === 2
                                ? 'text-[#DCE2DF]'
                                : entry.rank === 3
                                  ? 'text-[#CD8B5B]'
                                  : 'text-[#8B9A91]'
                          }
                        >
                          #{entry.rank}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#FAF7F0] truncate max-w-[200px]">
                            {entry.nickname}
                          </span>
                          {isMe && (
                            <span className="text-xs text-[#D4AF37]">· You</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-tabular font-semibold text-[#FAF7F0]">
                        {entry.rating}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-tabular text-[#D8E0DA]">
                        {entry.wins}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-tabular text-[#9AA89F]">
                        {entry.matchesPlayed}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-tabular text-[#D8E0DA]">
                        {entry.winRate}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-tabular text-[#D8E0DA]">
                        {entry.burns}
                      </td>
                      <td className="py-3.5 pl-4 pr-6 text-right font-mono-tabular">
                        {entry.currentStreak >= 2 ? (
                          <span className="inline-flex items-center justify-end gap-1 text-amber-300 font-medium">
                            <Flame className="w-3.5 h-3.5" />
                            {entry.currentStreak}
                          </span>
                        ) : (
                          <span className="text-[#8B9A91]">{entry.currentStreak}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
};
