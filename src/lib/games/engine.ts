// Pure, server-authoritative game rules. Every move is validated here before being saved.
export type GameId = "tictactoe" | "memory" | "rps" | "guess" | "whoami" | "reaction" | "stop" | "quiz" | "draw" | "truth" | "mime" | "hangman";

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
  stop: { min: 2, max: 8 },
  quiz: { min: 2, max: 8 },
  draw: { min: 2, max: 8 },
  truth: { min: 2, max: 8 },
  mime: { min: 2, max: 8 },
  hangman: { min: 2, max: 8 },
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
export const STOP_CATEGORIES = ["Nome", "Animal", "Fruta", "Cidade", "Objeto"];
export const QUIZ_PROMPTS = ["Quem é mais provável de esquecer o próprio aniversário?", "Quem sobreviveria numa ilha deserta?", "Quem é mais provável de virar famoso?", "Quem contaria a melhor piada?", "Quem toparia uma viagem de última hora?"];
export const MIME_PROMPTS = ["abacaxi", "cachorro", "jogar futebol", "escovar os dentes", "andar de bicicleta", "voar de avião", "tomar banho", "tocar violão", "dormir", "fazer bolo", "nadar", "lavar louça", "dançar samba", "morder limão", "procurar as chaves", "tirar uma selfie", "montar uma barraca", "cortar cabelo", "abrir um guarda-chuva", "perder o ônibus"];
const stopLetter = () => "ABCDEFGHIJKLMNOPRSTUV"[Math.floor(Math.random() * 21)];
const partyFinish = (s: any, ps: PlayerRef[], title: string): Result => {
  const winners = topScorers(s.scores);
  s.finished = { winners: winners.length === ps.length ? [] : winners, summary: `${title}: ${winners.map((id) => nameOf(ps, id)).join(" e ")} no topo!` };
  return { state: s, finish: s.finished };
};
function stopAnswers(payload: any) {
  if (!Array.isArray(payload?.answers) || payload.answers.length !== STOP_CATEGORIES.length) fail("Preencha as categorias.");
  return payload.answers.map((v: unknown) => String(v ?? "").trim().slice(0, 40));
}
export function initGame(game: GameId, ctx: Omit<Ctx, "state"> & { prev?: any }): Result {
  const ps = ctx.players;
  const lim = GAME_LIMITS[game];
  if (ps.length < lim.min) fail(`Este jogo precisa de pelo menos ${lim.min} jogadores.`);
  if (ps.length > lim.max) fail(`Este jogo aceita no máximo ${lim.max} jogadores.`);
  const round = (ctx.prev?.round ?? 0) + 1;

  switch (game) {
    case "stop":
      return { state: { round, game: 1, maxGames: 3, phase: "writing", letter: stopLetter(), endsAt: ctx.now + 90_000, submitted: {}, answers: {}, points: {}, scores: zeroScores(ps) } };
    case "quiz":
      return { state: { round, game: 1, phase: "voting", prompt: QUIZ_PROMPTS[0], voted: {}, votes: {}, leaders: [], scores: zeroScores(ps) } };
    case "mime": {
      const order = shuffle(ps.map((p) => p.id));
      const presenter = order[0]!;
      const word = MIME_PROMPTS[Math.floor(Math.random() * MIME_PROMPTS.length)]!;
      return {
        state: { round, turn: 0, order, presenter, phase: "acting", endsAt: ctx.now + 60_000, answer: null, feed: [], scores: zeroScores(ps) },
        secrets: { [presenter + ":mime"]: { word } },
      };
    }
    case "hangman": {
      const order = shuffle(ps.map((p) => p.id));
      return { state: { round, roundIndex: 0, turn: 0, order, presenter: order[0], phase: "prepare", pattern: "", wrong: 0, letters: [], answer: null, scores: zeroScores(ps) } };
    }
    case "draw":
    case "truth": {
      const order = shuffle(ps.map((p) => p.id));
      return { state: { round, turn: 0, order, presenter: order[0], phase: "prepare", statement: "", answer: null, voted: {}, votes: {}, strokes: [], endsAt: 0, guessed: {}, feed: [], scores: zeroScores(ps) } };
    }
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
    case "stop": {
      if (type === "save" || type === "stop") {
        if (s.phase !== "writing") fail("A rodada já encerrou.");
        if (ctx.now >= s.endsAt) fail("O tempo acabou.");
        const answers = stopAnswers(payload);
        const secrets = { [`${uid}:stop`]: { answers } };
        s.submitted[uid] = true;
        if (type === "save") return { state: s, secrets };
        if (!answers.every((a: string) => normalize(a).startsWith(s.letter.toLowerCase()))) fail("Complete todas as categorias com a letra sorteada antes de pedir Stop.");
        return revealStop(s, ps, { ...ctx.secrets, ...secrets }, secrets);
      }
      if (type === "timeout") {
        if (s.phase !== "writing" || ctx.now < s.endsAt) fail("Ainda há tempo.");
        return revealStop(s, ps, ctx.secrets);
      }
      if (type === "next") {
        if (s.phase !== "result") fail("A rodada ainda não acabou.");
        if (s.game >= s.maxGames) return partyFinish(s, ps, "Stop");
        s.game++; s.phase = "writing"; s.letter = stopLetter(); s.endsAt = ctx.now + 90_000;
        s.submitted = {}; s.answers = {}; s.points = {};
        return { state: s, secrets: Object.fromEntries(ps.map((p) => [`${p.id}:stop`, null])) };
      }
      return fail("Ação inválida.");
    }
    case "quiz": {
      if (type === "vote") {
        if (s.phase !== "voting" || s.voted[uid]) fail("Você já votou ou a votação terminou.");
        const target = String(payload?.target ?? "");
        if (!ps.some((p) => p.id === target)) fail("Jogador inválido.");
        const secrets = { [`${uid}:quiz`]: { target } };
        s.voted[uid] = true;
        if (ps.every((p) => s.voted[p.id])) {
          const all = { ...ctx.secrets, ...secrets };
          s.votes = Object.fromEntries(ps.map((p) => [p.id, (all[`${p.id}:quiz`] as any)?.target]));
          const counts: Record<string, number> = zeroScores(ps);
          Object.values(s.votes).forEach((id: any) => { counts[id] = (counts[id] ?? 0) + 1; });
          s.leaders = topScorers(counts);
          ps.forEach((p) => { if (s.leaders.includes(s.votes[p.id])) s.scores[p.id] += 1; });
          s.phase = "result";
        }
        return { state: s, secrets };
      }
      if (type === "next") {
        if (s.phase !== "result") fail("A votação ainda não acabou.");
        if (s.game >= QUIZ_PROMPTS.length) return partyFinish(s, ps, "Quiz da Galera");
        s.game++; s.prompt = QUIZ_PROMPTS[s.game - 1]; s.phase = "voting"; s.voted = {}; s.votes = {}; s.leaders = [];
        return { state: s, secrets: Object.fromEntries(ps.map((p) => [`${p.id}:quiz`, null])) };
      }
      return fail("Ação inválida.");
    }
    case "mime": {
      const presenter = s.presenter === uid;
      if (type === "guess") {
        if (presenter || s.phase !== "acting" || ctx.now >= s.endsAt) fail("Você não pode dar um palpite agora.");
        const text = String(payload?.text ?? "").trim().slice(0, 60);
        if (!text) fail("Escreva seu palpite.");
        const answer = (ctx.secrets[s.presenter + ":mime"] as any)?.word ?? "";
        const ok = normalize(text) === normalize(answer);
        s.feed.push({ uid, text: ok ? "acertou!" : text, ok });
        s.feed = s.feed.slice(-30);
        if (ok) { s.scores[uid] += 3; s.scores[s.presenter]++; s.phase = "reveal"; s.answer = answer; }
        return { state: s };
      }
      if (type === "timeout") {
        if (s.phase !== "acting" || ctx.now < s.endsAt) fail("Ainda há tempo.");
        s.phase = "reveal"; s.answer = (ctx.secrets[s.presenter + ":mime"] as any)?.word ?? "";
        return { state: s };
      }
      if (type === "next") {
        if (s.phase !== "reveal") fail("A rodada ainda não acabou.");
        s.turn++;
        if (s.turn >= s.order.length) return partyFinish(s, ps, "Mímica");
        s.presenter = s.order[s.turn]; s.phase = "acting"; s.endsAt = ctx.now + 60_000; s.answer = null; s.feed = [];
        const word = MIME_PROMPTS[Math.floor(Math.random() * MIME_PROMPTS.length)]!;
        const secrets: Secrets = Object.fromEntries(ps.map((p) => [p.id + ":mime", null]));
        secrets[s.presenter + ":mime"] = { word };
        return { state: s, secrets };
      }
      return fail("Ação inválida.");
    }
    case "hangman": {
      const presenter = s.presenter === uid;
      if (type === "present") {
        if (!presenter || s.phase !== "prepare") fail("Só quem escolhe a palavra pode começar.");
        const answer = normalize(String(payload?.word ?? "").slice(0, 40)).replace(/[^a-z ]/g, "").replace(/ +/g, " ").trim();
        if (answer.replace(/ /g, "").length < 3) fail("Escolha uma palavra com pelo menos três letras.");
        s.phase = "guessing"; s.pattern = answer.replace(/[a-z]/g, "_"); s.wrong = 0; s.letters = []; s.answer = null;
        s.turn = (s.roundIndex + 1) % s.order.length;
        return { state: s, secrets: { [uid + ":hangman"]: { word: answer } } };
      }
      if (type === "guessLetter") {
        if (presenter || s.phase !== "guessing" || s.order[s.turn] !== uid) fail("Não é a sua vez de chutar.");
        const letter = normalize(String(payload?.letter ?? ""));
        if (!/^[a-z]$/.test(letter)) fail("Escolha uma única letra.");
        if (s.letters.includes(letter)) fail("Essa letra já foi usada.");
        const answer = (ctx.secrets[s.presenter + ":hangman"] as any)?.word ?? "";
        if (!answer) fail("A palavra secreta não foi encontrada.");
        s.letters.push(letter);
        if (answer.includes(letter)) {
          s.pattern = Array.from(answer).map((char: string, i: number) => char === letter ? letter : s.pattern[i]).join("");
          s.scores[uid]++;
        } else s.wrong++;
        if (s.pattern === answer) { s.scores[uid] += 2; s.phase = "reveal"; s.answer = answer; }
        else if (s.wrong >= 6) { s.phase = "reveal"; s.answer = answer; }
        else {
          s.turn = (s.turn + 1) % s.order.length;
          if (s.order[s.turn] === s.presenter) s.turn = (s.turn + 1) % s.order.length;
        }
        return { state: s };
      }
      if (type === "next") {
        if (s.phase !== "reveal") fail("A rodada ainda não acabou.");
        s.roundIndex++;
        if (s.roundIndex >= s.order.length) return partyFinish(s, ps, "Forca");
        s.presenter = s.order[s.roundIndex]; s.turn = (s.roundIndex + 1) % s.order.length;
        s.phase = "prepare"; s.pattern = ""; s.wrong = 0; s.letters = []; s.answer = null;
        return { state: s, secrets: Object.fromEntries(ps.map((p) => [p.id + ":hangman", null])) };
      }
      return fail("Ação inválida.");
    }
    case "truth":
    case "draw": {
      const presenter = s.presenter === uid;
      if (type === "present") {
        if (!presenter || s.phase !== "prepare") fail("Só quem apresenta pode iniciar esta rodada.");
        if (game === "truth") {
          const statement = String(payload?.statement ?? "").trim().slice(0, 180);
          if (statement.length < 5 || typeof payload?.truth !== "boolean") fail("Escreva a história e escolha verdade ou mentira.");
          s.statement = statement; s.phase = "voting";
          return { state: s, secrets: { [`${uid}:truth`]: { truth: payload.truth } } };
        }
        const answer = String(payload?.word ?? "").trim().slice(0, 40);
        if (normalize(answer).length < 2) fail("Escolha uma palavra.");
        s.phase = "drawing"; s.endsAt = ctx.now + 60_000;
        return { state: s, secrets: { [`${uid}:draw`]: { answer } } };
      }
      if (game === "truth" && type === "vote") {
        if (presenter || s.phase !== "voting" || s.voted[uid]) fail("Você não pode votar agora.");
        if (typeof payload?.truth !== "boolean") fail("Voto inválido.");
        s.voted[uid] = true;
        const secrets = { [`${uid}:vote`]: { truth: payload.truth } };
        if (ps.filter((p) => p.id !== s.presenter).every((p) => s.voted[p.id])) {
          const all = { ...ctx.secrets, ...secrets };
          s.answer = (all[`${s.presenter}:truth`] as any)?.truth;
          s.votes = Object.fromEntries(ps.filter((p) => p.id !== s.presenter).map((p) => [p.id, (all[`${p.id}:vote`] as any)?.truth]));
          Object.entries(s.votes).forEach(([id, vote]) => { if (vote === s.answer) s.scores[id]++; else s.scores[s.presenter]++; });
          s.phase = "reveal";
        }
        return { state: s, secrets };
      }
      if (game === "draw" && (type === "stroke" || type === "erase")) {
        if (!presenter || s.phase !== "drawing" || ctx.now >= s.endsAt) fail("Você não pode desenhar agora.");
        if (type === "erase") { s.strokes = []; return { state: s }; }
        if (s.strokes.length >= 400) fail("Limite de traços atingido. Limpe o desenho.");
        const points = payload?.points;
        if (!Array.isArray(points) || points.length < 1 || points.length > 100 || !points.every((p) => Array.isArray(p) && p.length === 2 && p.every((n: any) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1))) fail("Traço inválido.");
        const color = payload?.color;
        if (!["ink", "coral", "sky", "lime"].includes(color)) fail("Cor inválida.");
        s.strokes.push({ points, color });
        return { state: s };
      }
      if (game === "draw" && type === "guess") {
        if (presenter || s.phase !== "drawing" || s.guessed[uid] || ctx.now >= s.endsAt) fail("Você não pode dar um palpite agora.");
        const text = String(payload?.text ?? "").trim().slice(0, 40);
        if (!text) fail("Escreva seu palpite.");
        const answer = (ctx.secrets[`${s.presenter}:draw`] as any)?.answer ?? "";
        const ok = normalize(text) === normalize(answer);
        if (ok) { s.guessed[uid] = true; s.scores[uid] += 3; s.scores[s.presenter]++; }
        s.feed.push({ uid, text: ok ? "acertou!" : text, ok }); s.feed = s.feed.slice(-30);
        if (ps.filter((p) => p.id !== s.presenter).every((p) => s.guessed[p.id])) { s.phase = "reveal"; s.answer = answer; }
        return { state: s };
      }
      if (game === "draw" && type === "timeout") {
        if (s.phase !== "drawing" || ctx.now < s.endsAt) fail("Ainda há tempo.");
        s.phase = "reveal"; s.answer = (ctx.secrets[`${s.presenter}:draw`] as any)?.answer;
        return { state: s };
      }
      if (type === "next") {
        if (s.phase !== "reveal") fail("A rodada ainda não acabou.");
        s.turn++;
        if (s.turn >= s.order.length) return partyFinish(s, ps, game === "draw" ? "Desenhe e Adivinhe" : "Verdade ou Mentira");
        s.presenter = s.order[s.turn]; s.phase = "prepare"; s.statement = ""; s.answer = null; s.voted = {}; s.votes = {}; s.strokes = []; s.guessed = {}; s.feed = []; s.endsAt = 0;
        return { state: s, secrets: Object.fromEntries(ps.flatMap((p) => ["truth", "vote", "draw"].map((k) => [`${p.id}:${k}`, null]))) };
      }
      return fail("Ação inválida.");
    }
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

function revealStop(s: any, ps: PlayerRef[], all: Secrets, secrets?: Secrets): Result {
  s.answers = Object.fromEntries(ps.map((p) => [p.id, (all[`${p.id}:stop`] as any)?.answers ?? STOP_CATEGORIES.map(() => "")]));
  s.points = {};
  ps.forEach((p) => {
    s.points[p.id] = s.answers[p.id].map((a: string, i: number) => {
      const n = normalize(a);
      if (!n.startsWith(s.letter.toLowerCase())) return 0;
      return ps.some((other) => other.id !== p.id && normalize(s.answers[other.id][i]) === n) ? 5 : 10;
    });
    s.scores[p.id] += s.points[p.id].reduce((a: number, b: number) => a + b, 0);
  });
  s.phase = "result";
  return { state: s, ...(secrets ? { secrets } : {}) };
}
