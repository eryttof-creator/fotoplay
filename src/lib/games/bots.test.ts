import { describe, expect, it } from "vitest";
import { botIdsToRemove } from "./bots";

const human = (user_id: string) => ({ user_id, is_bot: false });
const bot = (user_id: string) => ({ user_id, is_bot: true });

describe("solo bot counts", () => {
  it("keeps one robot for tic-tac-toe", () => {
    expect(
      botIdsToRemove("tictactoe", [human("me"), bot("bot-1"), bot("bot-2"), bot("bot-3")]),
    ).toEqual(["bot-2", "bot-3"]);
  });

  it("keeps three robots in a game that supports four players", () => {
    expect(
      botIdsToRemove("memory", [human("me"), bot("bot-1"), bot("bot-2"), bot("bot-3")]),
    ).toEqual([]);
  });

  it("does not remove human players when bots cannot cover the excess", () => {
    expect(
      botIdsToRemove("tictactoe", [human("me"), human("friend"), human("guest"), bot("bot-1")]),
    ).toEqual([]);
  });
});

import { botMove, mimeHint } from "./bots";
describe("hangman and mime robots", () => {
  it("robot picks a secret word when it chooses in hangman", () => {
    const m = botMove("hangman", { presenter: "b", phase: "prepare" }, "b", {}, 0, () => 0);
    expect(m?.type).toBe("present");
  });
  it("robot guesses an unused letter on its turn", () => {
    const m = botMove("hangman", { presenter: "me", phase: "guessing", order: ["me", "b"], turn: 1, letters: ["a"] }, "b", {}, 0, () => 0);
    expect(m).toEqual({ type: "guessLetter", payload: { letter: "e" } });
  });
  it("mime hints never reveal the whole word", () => {
    for (let i = 0; i < 4; i++) expect(mimeHint("girafa", i).toLowerCase()).not.toContain("girafa");
  });
});
