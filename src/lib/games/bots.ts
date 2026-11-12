// Robot players: pure move pickers used only by the server (see botStep in rooms.functions.ts).
import { GAME_LIMITS, tttWinner, type GameId, type Secrets } from "./engine";

export const BOT_GAMES: GameId[] = ["tictactoe", "memory", "rps", "reaction", "quiz"];
export const BOT_NAMES = ["Robô Zeca", "Robô Bia", "Robô Tico", "Robô Lulu", "Robô Dudu", "Robô Nina", "Robô Beto"];
export const BOT_AVATAR = "bot";

/** Returns excess bot IDs to remove so the selected game stays within its player limit. */
export function botIdsToRemove(game: GameId, players: { user_id: string; is_bot?: boolean }[]): string[] {
  const excess = players.length - GAME_LIMITS[game].max;
  if (excess <= 0) return [];

  const botIds = players.filter((player) => player.is_bot).map((player) => player.user_id);
  if (botIds.length < excess) return [];
  return botIds.slice(-excess);
}

export interface BotMove {
  type: string;
  payload: Record<string, unknown>;
}

const pick = <T,>(arr: T[], rnd: () => number) => arr[Math.floor(rnd() * arr.length)]!;

function tttMove(board: (string | null)[], me: string, rnd: () => number): number {
  const free = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  const wins = (who: string | null) =>
    free.find((i) => {
      const b = [...board];
      b[i] = who ?? "__other__";
      const w = tttWinner(b);
      return w && (who ? w.id === who : w.id !== me);
    });
  // Win when possible, usually block, prefer the centre, else random.
  const win = wins(me);
  if (win !== undefined) return win;
  const other = board.find((v) => v && v !== me) ?? null;
  const blockAt = other ? wins(other) : undefined;
  if (blockAt !== undefined && rnd() < 0.85) return blockAt;
  if (free.includes(4) && rnd() < 0.7) return 4;
  return pick(free, rnd);
}

/** Returns the next move for this bot, or null when it has nothing to do right now. */
export function botMove(game: GameId, state: any, botId: string, secrets: Secrets, now: number, rnd = Math.random): BotMove | null {
  if (!state || state.finished) return null;
  switch (game) {
    case "tictactoe":
      if (state.turn !== botId) return null;
      return { type: "move", payload: { i: tttMove(state.board, botId, rnd) } };
    case "memory": {
      if (state.turn !== botId) return null;
      const open = (state.matchedBy as (string | null)[])
        .map((m, i) => (m || state.flipped.includes(i) ? -1 : i))
        .filter((i) => i >= 0);
      if (!open.length) return null;
      if (state.flipped.length === 1) {
        const deck = (Object.entries(secrets).find(([k]) => k.endsWith(":deck"))?.[1] as any)?.deck;
        const first = state.flipped[0];
        const match = deck ? open.find((i) => JSON.stringify(deck[i]) === JSON.stringify(deck[first])) : undefined;
        // Imperfect memory: finds the pair about half the time.
        if (match !== undefined && rnd() < 0.5) return { type: "flip", payload: { i: match } };
      }
      return { type: "flip", payload: { i: pick(open, rnd) } };
    }
    case "rps":
      if (state.picked?.[botId]) return null;
      return { type: "pick", payload: { c: pick(["pedra", "papel", "tesoura"], rnd) } };
    case "reaction":
      if (state.phase !== "waiting" || state.results?.[botId] !== undefined || now < state.goAt) return null;
      return { type: "hit", payload: { ms: 230 + Math.floor(rnd() * 320) } };
    case "quiz": {
      if (state.phase !== "voting" || state.voted?.[botId]) return null;
      const ids: string[] = state.playerIds ?? Object.keys(state.scores ?? {});
      return { type: "vote", payload: { target: pick(ids, rnd) } };
    }
    default:
      return null;
  }
}
