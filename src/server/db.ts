import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { LeaderboardEntry, MatchStanding } from '../shared/types.ts';

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(process.cwd(), 'palace_salon.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    player_id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 1000,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    matches_played INTEGER NOT NULL DEFAULT 0,
    burns INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_players_rating ON players (rating DESC, wins DESC);
  CREATE INDEX IF NOT EXISTS idx_players_wins ON players (wins DESC, rating DESC);
`);

export interface MatchParticipantInput {
  playerId: string;
  nickname: string;
  place: number; // 1 = winner, 2..4 = others
  remainingCards: number;
  burns: number;
}

interface PlayerRow {
  player_id: string;
  nickname: string;
  rating: number;
  wins: number;
  losses: number;
  matches_played: number;
  burns: number;
  current_streak: number;
  best_streak: number;
  updated_at: number;
}

const stmtGetPlayer = db.prepare<[string], PlayerRow>(
  'SELECT * FROM players WHERE player_id = ?'
);

const stmtUpsertPlayer = db.prepare(`
  INSERT INTO players (player_id, nickname, rating, wins, losses, matches_played, burns, current_streak, best_streak, updated_at)
  VALUES (@player_id, @nickname, 1000, 0, 0, 0, 0, 0, 0, @updated_at)
  ON CONFLICT(player_id) DO UPDATE SET
    nickname = excluded.nickname,
    updated_at = excluded.updated_at
`);

const stmtUpdateStats = db.prepare(`
  UPDATE players
  SET
    nickname = @nickname,
    rating = @rating,
    wins = @wins,
    losses = @losses,
    matches_played = @matches_played,
    burns = @burns,
    current_streak = @current_streak,
    best_streak = @best_streak,
    updated_at = @updated_at
  WHERE player_id = @player_id
`);

export function ensurePlayerProfile(playerId: string, nickname: string): void {
  stmtUpsertPlayer.run({
    player_id: playerId,
    nickname,
    updated_at: Date.now(),
  });
}

/**
 * Atomically computes multiplayer Elo rating deltas and persists final match standings.
 */
export const recordMatchResults = db.transaction(
  (participants: MatchParticipantInput[]): MatchStanding[] => {
    const now = Date.now();
    const rows = participants.map((p) => {
      stmtUpsertPlayer.run({
        player_id: p.playerId,
        nickname: p.nickname,
        updated_at: now,
      });
      const existing = stmtGetPlayer.get(p.playerId);
      return {
        input: p,
        row: existing ?? {
          player_id: p.playerId,
          nickname: p.nickname,
          rating: 1000,
          wins: 0,
          losses: 0,
          matches_played: 0,
          burns: 0,
          current_streak: 0,
          best_streak: 0,
          updated_at: now,
        },
      };
    });

    const n = rows.length;
    const K = 32;
    const standings: MatchStanding[] = [];

    for (let i = 0; i < n; i++) {
      const me = rows[i];
      let expectedTotal = 0;
      let actualTotal = 0;

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const opp = rows[j];
        const expected = 1 / (1 + Math.pow(10, (opp.row.rating - me.row.rating) / 400));
        expectedTotal += expected;

        if (me.input.place < opp.input.place) {
          actualTotal += 1;
        } else if (me.input.place === opp.input.place) {
          actualTotal += 0.5;
        }
      }

      const divisor = Math.max(1, n - 1);
      const rawDelta = Math.round((K * (actualTotal - expectedTotal)) / divisor);
      // Winner always gets at least +8 rating; minimum rating floor is 400
      const ratingDelta = me.input.place === 1 ? Math.max(8, rawDelta) : rawDelta;
      const ratingAfter = Math.max(400, me.row.rating + ratingDelta);

      const won = me.input.place === 1;
      const newStreak = won ? me.row.current_streak + 1 : 0;
      const bestStreak = Math.max(me.row.best_streak, newStreak);

      stmtUpdateStats.run({
        player_id: me.input.playerId,
        nickname: me.input.nickname,
        rating: ratingAfter,
        wins: me.row.wins + (won ? 1 : 0),
        losses: me.row.losses + (won ? 0 : 1),
        matches_played: me.row.matches_played + 1,
        burns: me.row.burns + me.input.burns,
        current_streak: newStreak,
        best_streak: bestStreak,
        updated_at: now,
      });

      standings.push({
        playerId: me.input.playerId,
        nickname: me.input.nickname,
        place: me.input.place,
        remainingCards: me.input.remainingCards,
        burns: me.input.burns,
        ratingBefore: me.row.rating,
        ratingAfter,
        ratingDelta: ratingAfter - me.row.rating,
      });
    }

    return standings.sort((a, b) => a.place - b.place);
  }
);

export type LeaderboardSort = 'rating' | 'wins' | 'winRate' | 'burns';

export function getLeaderboard(options: {
  sort?: LeaderboardSort;
  search?: string;
  limit?: number;
}): LeaderboardEntry[] {
  const sort = options.sort ?? 'rating';
  const search = (options.search ?? '').trim();
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));

  // Explicit allowlist for ORDER BY clause (never interpolated from untrusted input)
  let orderClause = 'rating DESC, wins DESC, updated_at DESC';
  if (sort === 'wins') {
    orderClause = 'wins DESC, rating DESC, updated_at DESC';
  } else if (sort === 'burns') {
    orderClause = 'burns DESC, rating DESC, updated_at DESC';
  } else if (sort === 'winRate') {
    orderClause =
      'CASE WHEN matches_played > 0 THEN (CAST(wins AS REAL) / matches_played) ELSE 0 END DESC, wins DESC, rating DESC';
  }

  let rows: PlayerRow[];
  if (search.length > 0) {
    const stmt = db.prepare<[string, number], PlayerRow>(
      `SELECT * FROM players
       WHERE matches_played > 0 AND LOWER(nickname) LIKE LOWER(?)
       ORDER BY ${orderClause}
       LIMIT ?`
    );
    rows = stmt.all(`%${search}%`, limit);
  } else {
    const stmt = db.prepare<[number], PlayerRow>(
      `SELECT * FROM players
       WHERE matches_played > 0
       ORDER BY ${orderClause}
       LIMIT ?`
    );
    rows = stmt.all(limit);
  }

  return rows.map((row, idx) => ({
    rank: idx + 1,
    playerId: row.player_id,
    nickname: row.nickname,
    rating: row.rating,
    wins: row.wins,
    losses: row.losses,
    matchesPlayed: row.matches_played,
    winRate:
      row.matches_played > 0 ? Math.round((row.wins / row.matches_played) * 100) : 0,
    burns: row.burns,
    currentStreak: row.current_streak,
    bestStreak: row.best_streak,
    updatedAt: row.updated_at,
  }));
}

export function getPlayerProfile(playerId: string): LeaderboardEntry | null {
  const row = stmtGetPlayer.get(playerId);
  if (!row) return null;

  const rankRow = db
    .prepare<[number, number, number], { higher: number }>(
      `SELECT COUNT(*) AS higher FROM players
       WHERE matches_played > 0 AND (rating > ? OR (rating = ? AND wins > ?))`
    )
    .get(row.rating, row.rating, row.wins);

  return {
    rank: row.matches_played > 0 ? (rankRow?.higher ?? 0) + 1 : 0,
    playerId: row.player_id,
    nickname: row.nickname,
    rating: row.rating,
    wins: row.wins,
    losses: row.losses,
    matchesPlayed: row.matches_played,
    winRate:
      row.matches_played > 0 ? Math.round((row.wins / row.matches_played) * 100) : 0,
    burns: row.burns,
    currentStreak: row.current_streak,
    bestStreak: row.best_streak,
    updatedAt: row.updated_at,
  };
}
