// Robot players: pure move pickers used only by the server (see botStep in rooms.functions.ts).
import { GAME_LIMITS, tttWinner, type GameId, type Secrets } from "./engine";

export const BOT_GAMES: GameId[] = ["tictactoe", "memory", "rps", "reaction", "quiz", "hangman", "mime"];
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

const BOT_WORDS = ["banana", "girafa", "computador", "bicicleta", "chocolate", "foguete", "pipoca", "guitarra", "abacaxi", "elefante", "travesseiro", "dinossauro", "sorvete", "tartaruga", "helicoptero", "futebol"];
const BOT_GUESSES = ["dançar", "nadar", "cozinhar", "dormir", "correr", "pescar", "cantar", "dirigir", "pular corda", "tocar violão", "jogar bola", "escovar os dentes"];
const LETTER_FREQ = "aeosrinmdtculpvgqbfhzjxkwy";

/** Text clue a robot gives instead of miming; never contains the whole word. */
export function mimeHint(word: string, index: number): string {
  const w = word.trim();
  const words = w.split(/\s+/).length;
  if (index === 0) return `🤖 Dica: ${words > 1 ? `${words} palavras, ` : ""}${w.replace(/\s/g, "").length} letras`;
  if (index === 1) return `🤖 Começa com "${w[0]!.toUpperCase()}"`;
  if (index === 2) return `🤖 Termina com "${w[w.length - 1]!.toUpperCase()}"`;
  return "🤖 " + Array.from(w).map((c, i) => (c === " " ? " " : i % 2 === 0 ? c.toUpperCase() : "_")).join(" ");
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
    case "hangman": {
      if (state.presenter === botId) {
        if (state.phase !== "prepare") return null;
        return { type: "present", payload: { word: pick(BOT_WORDS, rnd) } };
      }
      if (state.phase !== "guessing" || state.order?.[state.turn] !== botId) return null;
      const used: string[] = state.letters ?? [];
      const open = LETTER_FREQ.split("").filter((l) => !used.includes(l));
      if (!open.length) return null;
      // Usually picks a common letter, sometimes a random one.
      const letter = rnd() < 0.75 ? open[Math.floor(rnd() * Math.min(5, open.length))]! : pick(open, rnd);
      return { type: "guessLetter", payload: { letter } };
    }
    case "mime": {
      if (state.phase !== "acting") return null;
      const word: string = (secrets[state.presenter + ":mime"] as any)?.word ?? "";
      if (!word) return null;
      const elapsed = now - (state.endsAt - 60_000);
      if (state.presenter === botId) {
        const given = (state.feed ?? []).filter((f: any) => f.uid === botId).length;
        const stage = Math.min(4, 1 + Math.floor(elapsed / 10_000));
        if (given >= stage) return null;
        return { type: "hint", payload: { text: mimeHint(word, given) } };
      }
      if (now >= state.endsAt) return null;
      const r = rnd();
      if (elapsed > 12_000 && r < 0.15) return { type: "guess", payload: { text: word } };
      if (r < 0.4) {
        const wrong = BOT_GUESSES.filter((g) => g.toLowerCase() !== word.toLowerCase());
        return { type: "guess", payload: { text: pick(wrong, rnd) } };
      }
      return null;
    }
    default:
      return null;
  }
}
