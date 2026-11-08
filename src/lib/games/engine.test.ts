import { describe, expect, it } from "vitest";
import { applyAction, initGame, type PlayerRef } from "./engine";

const P = (id: string): PlayerRef => ({ id, nickname: id, photo_path: null, avatar: "a1" });
const two = [P("a"), P("b")];

describe("Jogo da Velha", () => {
  it("rejects a move outside your turn", () => {
    const { state } = initGame("tictactoe", { players: two, secrets: {}, now: 0 });
    const other = state.turn === "a" ? "b" : "a";
    expect(() => applyAction("tictactoe", { players: two, state, secrets: {}, now: 0 }, other, "move", { i: 0 })).toThrow("Não é a sua vez");
  });
  it("detects a win on a row", () => {
    let { state } = initGame("tictactoe", { players: two, secrets: {}, now: 0 });
    const x = state.xId, o = state.oId;
    const moves: [string, number][] = [[x, 0], [o, 3], [x, 1], [o, 4], [x, 2]];
    let finish;
    for (const [u, i] of moves) ({ state, finish } = applyAction("tictactoe", { players: two, state, secrets: {}, now: 0 }, u, "move", { i }));
    expect(finish?.winners).toEqual([x]);
  });
  it("needs exactly 2 players", () => {
    expect(() => initGame("tictactoe", { players: [...two, P("c")], secrets: {}, now: 0 })).toThrow();
  });
});

describe("Pedra, Papel e Tesoura", () => {
  it("reveals only when everyone picked and pedra beats tesoura", () => {
    let { state } = initGame("rps", { players: two, secrets: {}, now: 0 });
    const r1 = applyAction("rps", { players: two, state, secrets: {}, now: 0 }, "a", "pick", { c: "pedra" });
    expect(r1.state.last).toBeNull();
    const r2 = applyAction("rps", { players: two, state: r1.state, secrets: r1.secrets!, now: 0 }, "b", "pick", { c: "tesoura" });
    expect(r2.state.last.winners).toEqual(["a"]);
  });
});
