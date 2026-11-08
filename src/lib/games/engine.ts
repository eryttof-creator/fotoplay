// Pure, server-authoritative game rules. Every move is validated here before being saved.
export type GameId = "tictactoe" | "memory" | "rps" | "guess" | "whoami" | "reaction";

export interface PlayerRef {
  id: string;
  nickname: string;
  photo_path: string | null;
  avatar: string;
}

export type Secrets = Record<string, unknown>; // key `${userId}:${kind}`
export interface Finish {
  winners: string[];
  summary: string;
}
export interface Ctx {
  players: PlayerRef[];
  state: any;
  secrets: Secrets;
  now: number;
}
export interface Result {
  state: any;
  secrets?: Secrets;
  finish?: Finish;
}

export class GameError extends Error {}
const fail = (m: string): never => {
  throw new GameError(m);
};

export const GAME_LIMITS: Record<GameId, { min: number; max: number }> = {
  tictactoe: { min: 2, max: 2 },
  memory: { min: 2, max: 6 },
  rps: { min: 2, max: 6 },
  guess: { min: 2, max: 8 },
  whoami: { min: 2, max: 8 },
  reaction: { min: 2, max: 6 },
};

export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const shuffle = <T>(arr: T[], rnd = Math.random) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
};
const zeroScores = (ps: PlayerRef[]) => Object.fromEntries(ps.map((p) => [p.id, 0]));
const topScorers = (scores: Record<string, number>) => {
  const max = Math.max(...Object.values(scores));
  return Object.keys(scores).filter((k) => scores[k] === max);
};
const nameOf = (ps: PlayerRef[], id: string) => ps.find((p) => p.id === id)?.nickname ?? "?";

/* ---------------- Tic-tac-toe ---------------- */
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6],
];
export function tttWinner(board: (string | null)[]) {
  for (const l of LINES) {
    const [a, b, c] = l as [number, number, number];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { id: board[a]!, line: l };
  }
  return null;
}

/* ---------------- Who am I characters ---------------- */
export const CHARACTERS = [
  "Pelé", "Neymar", "Anitta", "Xuxa", "Silvio Santos", "Ayrton Senna", "Harry Potter", "Homem-Aranha",
  "Batman", "Mulher-Maravilha", "Mickey Mouse", "Shrek", "Pikachu", "Mario", "Sonic", "Bob Esponja",
  "Elsa", "Darth Vader", "Yoda", "Super-Homem", "Saci-Pererê", "Mônica", "Cebolinha", "Chaves",
  "Messi", "Cristiano Ronaldo", "Taylor Swift", "Michael Jackson", "Albert Einstein", "Cleópatra",
  "Napoleão", "Papai Noel", "Coelhinho da Páscoa", "Goku", "Naruto", "Hulk", "Thor", "Barbie",
  "Simba", "Branca de Neve",
];

/* ---------------- Engine ---------------- */
export function initGame(game: GameId, ctx: Omit<Ctx, "state"> & { prev?: any }): Result {
  const ps = ctx.players;
  const lim = GAME_LIMITS[game];
  if (ps.length < lim.min) fail(`Este jogo precisa de pelo menos ${lim.min} jogadores.`);
  if (ps.length > lim.max) fail(`Este jogo aceita no máximo ${lim.max} jogadores.`);
  const round = (ctx.prev?.round ?? 0) + 1;

  switch (game) {
    case "tictactoe": {
      const a = ps[0]!, b = ps[1]!;
      const x = round % 2 === 1 ? a : b;
      const o = x === a ? b : a;
      return { state: { round, board: Array(9).fill(null), xId: x.id, oId: o.id, turn: x.id } };
    }
    case "memory": {
      const faces: any[] = ps.filter((p) => p.photo_path).map((p) => ({ k: "photo", uid: p.id }));
      const avatars = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10", "a11", "a12"];
      for (const av of shuffle(avatars)) {
        if (faces.length >= 8) break;
        faces.push({ k: "avatar", key: av });
      }
      const deck = shuffle([...faces.slice(0, 8), ...faces.slice(0, 8)]);
      const order = shuffle(ps.map((p) => p.id));
      return {
        state: {
          round, size: deck.length, revealed: Array(deck.length).fill(null),
          matchedBy: Array(deck.length).fill(null), flipped: [], mismatch: [], order, turn: order[0],
          scores: zeroScores(ps),
        },
        secrets: { [`${ps[0]!.id}:deck`]: { deck } },
      };
    }
    case "rps":
      return { state: { round, target: 3, picked: {}, last: null, scores: zeroScores(ps) } };
    case "reaction":
      return { state: { round, game: 1, maxGames: 5, phase: "idle", goAt: 0, results: {}, scores: zeroScores(ps) } };
    case "guess": {
      const order = shuffle(ps.map((p) => p.id));
      return {
        state: {
          round, turn: 0, order, phase: "upload", presenter: order[0], photoPath: null, hint: "",
          endsAt: 0, guessed: {}, feed: [], answer: null, scores: zeroScores(ps),
        },
      };
    }
    case "whoami": {
      const chars = shuffle(CHARACTERS);
      const secrets: Secrets = {};
      ps.forEach((p, i) => (secrets[`${p.id}:whoami`] = { name: chars[i] }));
      const order = shuffle(ps.map((p) => p.id));
      return {
        state: {
          round, order, turn: order[0], phase: "ask", question: "", answers: {}, log: [], solved: {},
          scores: zeroScores(ps), revealed: null,
        },
        secrets,
      };
    }
  }
}

export function applyAction(game: GameId, ctx: Ctx, uid: string, type: string, payload: any): Result {
  const ps = ctx.players;
  const s = structuredClone(ctx.state);
  if (s.finished) fail("A partida já terminou. Peça uma revanche!");
  if (!ps.some((p) => p.id === uid)) fail("Você não está nesta partida.");

  switch (game) {
    case "tictactoe": {
      if (type !== "move") fail("Ação inválida.");
      if (s.turn !== uid) fail("Não é a sua vez.");
      const i = Number(payload?.i);
      if (!Number.isInteger(i) || i < 0 || i > 8) fail("Casa inválida.");
      if (s.board[i]) fail("Essa casa já está ocupada.");
      s.board[i] = uid;
      const w = tttWinner(s.board);
      if (w) {
        s.line = w.line;
        s.finished = { winners: [w.id], summary: `${nameOf(ps, w.id)} venceu o Jogo da Velha` };
        return { state: s, finish: s.finished };
      }
      if (s.board.every(Boolean)) {
        s.finished = { winners: [], summary: "Jogo da Velha terminou empatado" };
        return { state: s, finish: s.finished };
      }
      s.turn = s.turn === s.xId ? s.oId : s.xId;
      return { state: s };
    }

    case "memory": {
      if (type !== "flip") fail("Ação inválida.");
      if (s.turn !== uid) fail("Não é a sua vez.");
      const deckKey = Object.keys(ctx.secrets).find((k) => k.endsWith(":deck"));
      const deck = (ctx.secrets[deckKey!] as any)?.deck;
      if (!deck) fail("Baralho não encontrado.");
      const i = Number(payload?.i);
      if (!Number.isInteger(i) || i < 0 || i >= s.size) fail("Carta inválida.");
      if (s.matchedBy[i] || s.flipped.includes(i)) fail("Escolha outra carta.");
      if (s.flipped.length === 0) {
        for (const m of s.mismatch) s.revealed[m] = null;
        s.mismatch = [];
      }
      s.revealed[i] = deck[i];
      s.flipped.push(i);
      if (s.flipped.length === 2) {
        const [a, b] = s.flipped;
        const same = JSON.stringify(deck[a]) === JSON.stringify(deck[b]);
        if (same) {
          s.matchedBy[a] = s.matchedBy[b] = uid;
          s.scores[uid] += 1;
        } else {
          s.mismatch = [a, b];
          const idx = s.order.indexOf(uid);
          s.turn = s.order[(idx + 1) % s.order.length];
        }
        s.flipped = [];
        if (s.matchedBy.every(Boolean)) {
          const winners = topScorers(s.scores);
          s.finished = {
            winners: winners.length === ps.length ? [] : winners,
            summary: winners.length === ps.length ? "Jogo da Memória empatado" : `${winners.map((w) => nameOf(ps, w)).join(" e ")} venceu o Jogo da Memória`,
          };
          return { state: s, finish: s.finished };
        }
      }
      return { state: s };
    }

    case "rps": {
      if (type !== "pick") fail("Ação inválida.");
      const c = payload?.c;
      if (!["pedra", "papel", "tesoura"].includes(c)) fail("Escolha inválida.");
      if (s.picked[uid]) fail("Você já escolheu nesta rodada.");
      const secrets: Secrets = { [`${uid}:rps`]: { c } };
      s.picked[uid] = true;
      const all = { ...ctx.secrets, ...secrets };
      if (ps.every((p) => s.picked[p.id])) {
        const choices: Record<string, string> = {};
        ps.forEach((p) => (choices[p.id] = (all[`${p.id}:rps`] as any).c));
        const set = new Set(Object.values(choices));
        let winners: string[] = [];
        if (set.size === 2) {
          const beats: Record<string, string> = { pedra: "tesoura", papel: "pedra", tesoura: "papel" };
          const [m, n] = [...set] as [string, string];
          const win = beats[m] === n ? m : n;
          winners = ps.filter((p) => choices[p.id] === win).map((p) => p.id);
        }
        winners.forEach((w) => (s.scores[w] += 1));
        s.last = { choices, winners, n: (s.last?.n ?? 0) + 1 };
        s.picked = {};
        ps.forEach((p) => (secrets[`${p.id}:rps`] = null));
        const champs = Object.keys(s.scores).filter((k) => s.scores[k] >= s.target);
        if (champs.length) {
          const top = topScorers(s.scores);
          s.finished = { winners: top, summary: `${top.map((w) => nameOf(ps, w)).join(" e ")} venceu Pedra, Papel e Tesoura` };
          return { state: s, secrets, finish: s.finished };
        }
      }
      return { state: s, secrets };
    }

    case "reaction": {
      if (type === "start") {
        if (s.phase === "waiting") fail("A rodada já começou.");
        s.phase = "waiting";
        s.goAt = ctx.now + 2000 + Math.floor(Math.random() * 3000);
        s.results = {};
        return { state: s };
      }
      if (type !== "hit") fail("Ação inválida.");
      if (s.phase !== "waiting") fail("Aguarde a próxima rodada.");
      if (s.results[uid] !== undefined) fail("Você já reagiu.");
      const ms = Number(payload?.ms);
      const early = !!payload?.early || ctx.now < s.goAt - 250 || !(ms >= 90 && ms <= 10000);
      s.results[uid] = early ? "early" : Math.round(ms);
      if (ps.every((p) => s.results[p.id] !== undefined)) {
        const valid = ps.filter((p) => typeof s.results[p.id] === "number");
        if (valid.length) {
          const best = Math.min(...valid.map((p) => s.results[p.id]));
          valid.filter((p) => s.results[p.id] === best).forEach((p) => (s.scores[p.id] += 1));
        }
        s.phase = "result";
        if (s.game >= s.maxGames) {
          const top = topScorers(s.scores);
          s.finished = { winners: top, summary: `${top.map((w) => nameOf(ps, w)).join(" e ")} venceu a Batalha de Reação` };
          return { state: s, finish: s.finished };
        }
        s.game += 1;
      }
      return { state: s };
    }

    case "guess": {
      const isPresenter = s.presenter === uid;
      if (type === "present") {
        if (!isPresenter) fail("Só quem apresenta pode enviar a foto.");
        if (s.phase !== "upload") fail("A foto já foi enviada.");
        const path = String(payload?.path ?? "");
        const answer = String(payload?.answer ?? "").trim();
        if (!path.startsWith(`${uid}/`)) fail("Foto inválida.");
        if (normalize(answer).length < 2) fail("Escreva a resposta certa.");
        s.phase = "guessing";
        s.photoPath = path;
        s.hint = String(payload?.hint ?? "").slice(0, 80);
        s.endsAt = ctx.now + 60_000;
        s.guessed = {};
        s.feed = [];
        return { state: s, secrets: { [`${uid}:answer`]: { answer } } };
      }
      if (type === "guess") {
        if (isPresenter) fail("Você apresentou esta foto.");
        if (s.phase !== "guessing") fail("Não há foto para adivinhar agora.");
        if (s.guessed[uid]) fail("Você já acertou!");
        const answer = (ctx.secrets[`${s.presenter}:answer`] as any)?.answer ?? "";
        const text = String(payload?.text ?? "").slice(0, 60);
        if (ctx.now > s.endsAt) fail("O tempo acabou.");
        if (normalize(text) && normalize(text) === normalize(answer)) {
          const pts = Math.max(1, Math.ceil((s.endsAt - ctx.now) / 10_000));
          s.scores[uid] += pts;
          s.scores[s.presenter] += 1;
          s.guessed[uid] = pts;
          s.feed.push({ uid, ok: true, pts });
        } else {
          s.feed.push({ uid, ok: false, text });
        }
        s.feed = s.feed.slice(-30);
        const others = ps.filter((p) => p.id !== s.presenter);
        if (others.every((p) => s.guessed[p.id])) {
          s.phase = "reveal";
          s.answer = answer;
        }
        return { state: s };
      }
      if (type === "timeout") {
        if (s.phase !== "guessing") fail("Nada a encerrar.");
        if (ctx.now < s.endsAt) fail("Ainda há tempo.");
        s.phase = "reveal";
        s.answer = (ctx.secrets[`${s.presenter}:answer`] as any)?.answer ?? "";
        return { state: s };
      }
      if (type === "next") {
        if (s.phase !== "reveal") fail("A rodada ainda não acabou.");
        s.turn += 1;
        if (s.turn >= s.order.length) {
          const top = topScorers(s.scores);
          s.finished = { winners: top, summary: `${top.map((w) => nameOf(ps, w)).join(" e ")} venceu Adivinhe a Foto` };
          return { state: s, finish: s.finished };
        }
        s.presenter = s.order[s.turn];
        s.phase = "upload";
        s.photoPath = null;
        s.answer = null;
        s.hint = "";
        return { state: s };
      }
      return fail("Ação inválida.");
    }

    case "whoami": {
      const isTurn = s.turn === uid;
      const advance = () => {
        const unsolved = s.order.filter((id: string) => !s.solved[id]);
        if (unsolved.length <= 1 || unsolved.length === 0) return true;
        let idx = s.order.indexOf(s.turn);
        do idx = (idx + 1) % s.order.length;
        while (s.solved[s.order[idx]]);
        s.turn = s.order[idx];
        s.phase = "ask";
        s.question = "";
        s.answers = {};
        return false;
      };
      const finishIt = (): Result => {
        const top = topScorers(s.scores);
        const all: Record<string, string> = {};
        ps.forEach((p) => (all[p.id] = (ctx.secrets[`${p.id}:whoami`] as any)?.name));
        s.revealed = all;
        s.finished = { winners: top, summary: `${top.map((w) => nameOf(ps, w)).join(" e ")} venceu Quem Sou Eu?` };
        return { state: s, finish: s.finished };
      };
      if (type === "ask") {
        if (!isTurn || s.phase !== "ask") fail("Não é a sua vez de perguntar.");
        const q = String(payload?.q ?? "").trim().slice(0, 120);
        if (q.length < 3) fail("Escreva uma pergunta.");
        s.question = q;
        s.answers = {};
        s.phase = "answer";
        return { state: s };
      }
      if (type === "answer") {
        if (isTurn) fail("Você não pode responder a própria pergunta.");
        if (s.phase !== "answer") fail("Não há pergunta agora.");
        const a = payload?.a;
        if (!["sim", "nao", "talvez"].includes(a)) fail("Resposta inválida.");
        s.answers[uid] = a;
        if (ps.filter((p) => p.id !== s.turn).every((p) => s.answers[p.id])) {
          s.log.push({ uid: s.turn, q: s.question, answers: s.answers });
          s.log = s.log.slice(-40);
          if (advance()) return finishIt();
        }
        return { state: s };
      }
      if (type === "guess") {
        if (!isTurn || s.phase !== "ask") fail("Não é a sua vez.");
        const name = (ctx.secrets[`${uid}:whoami`] as any)?.name ?? "";
        const text = String(payload?.name ?? "");
        const ok = normalize(text) === normalize(name);
        s.log.push({ uid, guess: text.slice(0, 40), ok });
        if (ok) {
          const solvedCount = Object.keys(s.solved).length;
          s.solved[uid] = name;
          s.scores[uid] += ps.length - solvedCount;
        }
        if (advance()) return finishIt();
        return { state: s };
      }
      return fail("Ação inválida.");
    }
  }
  return fail("Jogo desconhecido.");
}
