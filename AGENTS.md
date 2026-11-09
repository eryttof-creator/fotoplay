<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Architecture
- Game rules live in `src/lib/games/engine.ts` as pure functions and run only inside server functions (`src/lib/api/rooms.functions.ts`); clients never write room/game tables directly — keeps turns and hidden choices server-authoritative.
- Hidden per-player data (picks, decks, answers, characters, Stop drafts and votes) goes in `room_secrets`, never in `rooms.state`, because room state is readable by every member.
- Game moves use the service-only `commit_game_move` RPC with optimistic version retry to commit state and secrets atomically, preventing simultaneous submissions from losing hidden answers.
- Players use anonymous auth; photos live in the private `photos` bucket under `{userId}/`, readable only by users who share a room (`shares_room`).
- Server function modules must not live under `src/server/` (import-protection blocks client imports from there).
- Party game views live in `PartyGames.tsx`; drawing sends bounded normalized strokes through server actions so reconnects retain the board.
- Sound effects use gesture-unlocked browser Web Audio with a persisted mute preference, avoiding downloads and blocked autoplay.
- Shared authentication state is owned by AuthProvider in the root; email accounts coexist with existing visitors, and sign-out clears protected query caches.
- Legal content uses dedicated public routes and the root Footer so credits remain consistent across pages.
