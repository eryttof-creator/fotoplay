import { describe, expect, it } from "vitest";
import { initGame, applyAction, type GameId, type Secrets, type PlayerRef } from "./engine";

const players: PlayerRef[] = ["a", "b"].map((id) => ({ id, nickname: id, avatar: "a1", photo_path: null }));
function match(game: GameId) {
  let { state, secrets: initial } = initGame(game, { players, secrets: {}, now: 1000 });
  let secrets: Secrets = initial ?? {};
  return { get state() { return state; }, get secrets() { return secrets; }, act(uid: string, type: string, payload: any = {}, now = 2000) {
    const result = applyAction(game, { players, state, secrets, now }, uid, type, payload);
    state = result.state; secrets = { ...secrets, ...result.secrets }; return result;
  } };
}
describe("Stop", () => {
  it("saves answers privately until someone calls Stop", () => {
    const m = match("stop"); const letter = m.state.letter;
    m.act("a", "save", { answers: Array(5).fill(letter + "a") });
    expect(m.state.answers).toEqual({});
    expect(m.secrets["a:stop"]).toEqual({ answers: Array(5).fill(letter + "a") });
    m.act("b", "stop", { answers: Array(5).fill(letter + "b") });
    expect(m.state.phase).toBe("result"); expect(m.state.scores).toEqual({ a: 50, b: 50 });
  });
  it("gives five points for duplicates and zero for another letter", () => {
    const m = match("stop"); const word = m.state.letter + "x";
    m.act("a", "save", { answers: [word, word, "123", word, ""] });
    m.act("b", "stop", { answers: Array(5).fill(word) });
    expect(m.state.points.a).toEqual([5, 5, 0, 5, 0]); expect(m.state.scores.b).toBe(35);
  });
  it("rejects incomplete Stop and early timeout", () => {
    const m = match("stop"); expect(() => m.act("a", "stop", { answers: Array(5).fill("") })).toThrow();
    expect(() => m.act("a", "timeout")).toThrow();
    m.act("a", "timeout", {}, 91_000); expect(m.state.phase).toBe("result");
  });
  it("finishes after three rounds and clears drafts between rounds", () => {
    const m = match("stop");
    for (let i = 0; i < 3; i++) {
      m.act("a", "stop", { answers: Array(5).fill(m.state.letter + "x") }); m.act("a", "next");
      if (i < 2) { expect(m.state.answers).toEqual({}); expect(m.secrets["a:stop"]).toBeNull(); }
    }
    expect(m.state.finished.winners).toEqual(["a"]);
  });
});
describe("Quiz da Galera", () => {
  it("keeps votes hidden, rejects duplicate votes, then scores consensus", () => {
    const m = match("quiz"); m.act("a", "vote", { target: "b" }); expect(m.state.votes).toEqual({});
    expect(() => m.act("a", "vote", { target: "a" })).toThrow();
    m.act("b", "vote", { target: "b" }); expect(m.state.votes).toEqual({ a: "b", b: "b" }); expect(m.state.scores).toEqual({ a: 1, b: 1 });
  });
  it("rejects invalid players and finishes five questions", () => {
    const m = match("quiz"); expect(() => m.act("a", "vote", { target: "intruder" })).toThrow();
    for (let i = 0; i < 5; i++) { m.act("a", "vote", { target: "b" }); m.act("b", "vote", { target: "b" }); m.act("a", "next"); }
    expect(m.state.finished.winners).toEqual([]); expect(m.state.scores.a).toBe(5);
  });
});
describe("Verdade ou Mentira", () => {
  it("hides the truth and scores correct votes at reveal", () => {
    const m = match("truth"); const presenter = m.state.presenter; const voter = presenter === "a" ? "b" : "a";
    m.act(presenter, "present", { statement: "Eu já viajei de barco", truth: false }); expect(m.state.answer).toBeNull();
    expect(() => m.act(presenter, "vote", { truth: false })).toThrow();
    m.act(voter, "vote", { truth: false }); expect(m.state.answer).toBe(false); expect(m.state.scores[voter]).toBe(1);
    m.act(voter, "next"); expect(m.state.presenter).toBe(voter); expect(m.state.answer).toBeNull();
  });
  it("awards presenter a point when fooling another player", () => {
    const m = match("truth"); const uid = m.state.presenter; const other = uid === "a" ? "b" : "a";
    m.act(uid, "present", { statement: "Uma história inventada", truth: false }); m.act(other, "vote", { truth: true });
    expect(m.state.scores[uid]).toBe(1); expect(m.state.scores[other]).toBe(0);
  });
});
describe("Desenhe e Adivinhe", () => {
  it("only lets presenter draw and keeps word secret until guessed", () => {
    const m = match("draw"); const uid = m.state.presenter; const other = uid === "a" ? "b" : "a";
    expect(() => m.act(other, "present", { word: "maçã" })).toThrow();
    m.act(uid, "present", { word: "maçã" }); expect(m.state.answer).toBeNull();
    const stroke = { color: "ink", points: [[0.1, 0.2], [0.4, 0.5]] };
    expect(() => m.act(other, "stroke", stroke)).toThrow(); m.act(uid, "stroke", stroke); expect(m.state.strokes).toHaveLength(1);
    m.act(other, "guess", { text: "maca" }); expect(m.state.answer).toBe("maçã"); expect(m.state.scores[other]).toBe(3); expect(m.state.scores[uid]).toBe(1);
  });
  it("bounds drawing payloads and enforces the countdown", () => {
    const m = match("draw"); const uid = m.state.presenter; m.act(uid, "present", { word: "casa" });
    expect(() => m.act(uid, "stroke", { color: "ink", points: [[-1, 0]] })).toThrow();
    expect(() => m.act(uid, "stroke", { color: "unknown", points: [[0, 0]] })).toThrow();
    expect(() => m.act(uid, "timeout")).toThrow(); m.act(uid, "timeout", {}, 62_000); expect(m.state.answer).toBe("casa");
  });
});
describe("Party membership", () => {
  for (const game of ["stop", "quiz", "draw", "truth", "mime", "hangman"] as const) {
    it(`${game} requires 2–8 players and rejects outsiders`, () => {
      expect(() => initGame(game, { players: players.slice(0, 1), secrets: {}, now: 0 })).toThrow();
      expect(() => initGame(game, { players: Array(9).fill(players[0]), secrets: {}, now: 0 })).toThrow();
      const m = match(game); expect(() => m.act("outsider", "next")).toThrow("Você não está nesta partida");
    });
  }
});
describe("Mímica", () => {
  it("keeps the prompt private and scores a correct guess", () => {
    const m = match("mime"); const presenter = m.state.presenter; const guesser = players.find((p) => p.id !== presenter)!.id;
    const word = (m.secrets[presenter + ":mime"] as any).word;
    expect(m.state.answer).toBeNull();
    m.act(guesser, "guess", { text: word });
    expect(m.state.answer).toBe(word); expect(m.state.scores[guesser]).toBe(3); expect(m.state.scores[presenter]).toBe(1);
  });
  it("ends on timeout and gives the next player a private prompt", () => {
    const m = match("mime"); const oldPresenter = m.state.presenter;
    m.act(oldPresenter, "timeout", {}, 61_001); expect(m.state.phase).toBe("reveal");
    m.act(oldPresenter, "next"); expect(m.state.presenter).not.toBe(oldPresenter); expect(m.state.phase).toBe("acting");
    expect(m.secrets[m.state.presenter + ":mime"]).toBeTruthy();
  });
});

describe("Forca", () => {
  it("keeps the word hidden and awards points for correct letters", () => {
    const m = match("hangman"); const presenter = m.state.presenter; const guesser = players.find((p) => p.id !== presenter)!.id;
    m.act(presenter, "present", { word: "casa" });
    expect(m.state.pattern).toBe("____"); expect(m.state.answer).toBeNull();
    expect(() => m.act(presenter, "guessLetter", { letter: "c" })).toThrow();
    m.act(guesser, "guessLetter", { letter: "c" }); expect(m.state.pattern).toBe("c___");
    m.act(guesser, "guessLetter", { letter: "a" }); expect(m.state.pattern).toBe("ca_a");
    m.act(guesser, "guessLetter", { letter: "s" });
    expect(m.state.phase).toBe("reveal"); expect(m.state.answer).toBe("casa"); expect(m.state.scores[guesser]).toBe(5);
  });
  it("reveals the word after six incorrect letters", () => {
    const m = match("hangman"); const presenter = m.state.presenter; const guesser = players.find((p) => p.id !== presenter)!.id;
    m.act(presenter, "present", { word: "casa" });
    for (const letter of ["b", "d", "e", "f", "g", "h"]) m.act(guesser, "guessLetter", { letter });
    expect(m.state.wrong).toBe(6); expect(m.state.phase).toBe("reveal"); expect(m.state.answer).toBe("casa");
  });
});