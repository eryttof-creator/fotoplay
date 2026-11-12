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
