import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { applyAction, initGame, GameError, GAME_LIMITS, type GameId, type PlayerRef, type Secrets } from "@/lib/games/engine";

const GAMES = ["tictactoe", "memory", "rps", "guess", "whoami", "reaction"] as const;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}
const profileInput = z.object({
  nickname: z.string().trim().min(1, "Escolha um apelido").max(20),
  avatar: z.string().max(10),
  photo_path: z.string().max(200).nullable(),
});

async function loadRoom(db: any, roomId: string) {
  const { data: room } = await db.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (!room) throw new Error("Sala não encontrada.");
  const { data: players } = await db.from("room_players").select("*").eq("room_id", roomId).order("joined_at");
  return { room, players: (players ?? []) as any[] };
}
function checkPhoto(uid: string, path: string | null) {
  if (path && !path.startsWith(`${uid}/`)) throw new Error("Foto inválida.");
}

export const createRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => profileInput.parse(d))
  .handler(async ({ data, context }) => {
    checkPhoto(context.userId, data.photo_path);
    const db = await admin();
    for (let i = 0; i < 6; i++) {
      const code = newCode();
      const { data: room, error } = await db
        .from("rooms")
        .insert({ code, host_id: context.userId })
        .select()
        .single();
      if (error) continue;
      await db.from("room_players").insert({ room_id: room.id, user_id: context.userId, ...data });
      return { code };
    }
    throw new Error("Não foi possível criar a sala. Tente de novo.");
  });

export const joinRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => profileInput.extend({ code: z.string().trim().toUpperCase().regex(CODE_RE, "Código inválido") }).parse(d))
  .handler(async ({ data, context }) => {
    checkPhoto(context.userId, data.photo_path);
    const db = await admin();
    const { data: room } = await db.from("rooms").select("*").eq("code", data.code).maybeSingle();
    if (!room) throw new Error("Nenhuma sala com esse código.");
    const { players } = await loadRoom(db, room.id);
    const already = players.some((p) => p.user_id === context.userId);
    if (!already) {
      if (players.length >= 8) throw new Error("A sala está cheia (8 jogadores).");
      if (room.status === "playing") throw new Error("A partida já começou. Aguarde terminar.");
    }
    const { code, ...profile } = data;
    await db.from("room_players").upsert({ room_id: room.id, user_id: context.userId, ...profile, last_seen: new Date().toISOString() });
    return { code };
  });

export const getRoomByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().toUpperCase().regex(CODE_RE) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: room } = await context.supabase.from("rooms").select("id").eq("code", data.code).maybeSingle();
    return { roomId: room?.id ?? null, serverNow: Date.now() };
  });

export const updateMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => profileInput.extend({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    checkPhoto(context.userId, data.photo_path);
    const db = await admin();
    const { roomId, ...rest } = data;
    await db.from("room_players").update(rest).eq("room_id", roomId).eq("user_id", context.userId);
    return { ok: true };
  });

export const setReady = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().uuid(), ready: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    await db.from("room_players").update({ ready: data.ready }).eq("room_id", data.roomId).eq("user_id", context.userId);
    return { ok: true };
  });

export const heartbeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    await db.from("room_players").update({ last_seen: new Date().toISOString() }).eq("room_id", data.roomId).eq("user_id", context.userId);
    return { serverNow: Date.now() };
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { room, players } = await loadRoom(db, data.roomId);
    await db.from("room_players").delete().eq("room_id", room.id).eq("user_id", context.userId);
    const rest = players.filter((p) => p.user_id !== context.userId);
    if (!rest.length) {
      await db.from("rooms").delete().eq("id", room.id);
      return { ok: true };
    }
    const patch: any = { updated_at: new Date().toISOString(), version: room.version + 1 };
    if (room.host_id === context.userId) patch.host_id = rest[0].user_id;
    if (room.status === "playing" && room.state?.playerIds?.includes(context.userId)) {
      patch.status = "lobby";
      patch.state = { aborted: `Um jogador saiu da partida.` };
      await db.from("room_players").update({ ready: false }).eq("room_id", room.id);
    }
    await db.from("rooms").update(patch).eq("id", room.id);
    return { ok: true };
  });

export const selectGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().uuid(), game: z.enum(GAMES) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { room } = await loadRoom(db, data.roomId);
    if (room.host_id !== context.userId) throw new Error("Só o anfitrião escolhe o jogo.");
    if (room.status !== "lobby") throw new Error("Termine a partida primeiro.");
    await db.from("rooms").update({ game: data.game, version: room.version + 1 }).eq("id", room.id);
    return { ok: true };
  });

async function startFresh(db: any, room: any, players: any[], game: GameId, prev?: any) {
  const refs: PlayerRef[] = players.map((p) => ({ id: p.user_id, nickname: p.nickname, photo_path: p.photo_path, avatar: p.avatar }));
  const res = initGame(game, { players: refs, secrets: {}, now: Date.now(), prev });
  await db.from("room_secrets").delete().eq("room_id", room.id);
  await writeSecrets(db, room.id, res.secrets);
  const state = { ...res.state, playerIds: refs.map((r) => r.id) };
  const { error } = await db
    .from("rooms")
    .update({ status: "playing", game, state, version: room.version + 1, updated_at: new Date().toISOString() })
    .eq("id", room.id)
    .eq("version", room.version);
  if (error) throw new Error("Tente novamente.");
}
async function writeSecrets(db: any, roomId: string, secrets?: Secrets) {
  if (!secrets) return;
  for (const [key, val] of Object.entries(secrets)) {
    const [user_id, kind] = key.split(":");
    if (val === null) await db.from("room_secrets").delete().eq("room_id", roomId).eq("user_id", user_id).eq("kind", kind);
    else await db.from("room_secrets").upsert({ room_id: roomId, user_id, kind, data: val });
  }
}

export const startGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { room, players } = await loadRoom(db, data.roomId);
    if (room.host_id !== context.userId) throw new Error("Só o anfitrião inicia a partida.");
    if (room.status !== "lobby") throw new Error("A partida já está em andamento.");
    if (!players.every((p) => p.ready)) throw new Error("Todos precisam estar prontos.");
    const lim = GAME_LIMITS[room.game as GameId];
    if (players.length < lim.min || players.length > lim.max)
      throw new Error(lim.min === lim.max ? `Este jogo é para exatamente ${lim.min} jogadores.` : `Este jogo é para ${lim.min} a ${lim.max} jogadores.`);
    try {
      await startFresh(db, room, players, room.game as GameId);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Erro ao iniciar.");
    }
    return { ok: true };
  });

export const rematch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().uuid(), toLobby: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { room, players } = await loadRoom(db, data.roomId);
    if (!players.some((p) => p.user_id === context.userId)) throw new Error("Você não está nesta sala.");
    if (room.status !== "playing") return { ok: true };
    if (!room.state?.finished && context.userId !== room.host_id) throw new Error("Só o anfitrião pode reiniciar no meio da partida.");
    if (data.toLobby) {
      await db.from("room_players").update({ ready: false }).eq("room_id", room.id);
      await db.from("rooms").update({ status: "lobby", state: {}, version: room.version + 1 }).eq("id", room.id);
      return { ok: true };
    }
    const inGame = players.filter((p) => room.state?.playerIds?.includes(p.user_id));
    await startFresh(db, room, inGame, room.game as GameId, room.state);
    return { ok: true };
  });

export const gameAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ roomId: z.string().uuid(), type: z.string().max(20), payload: z.record(z.any()).default({}) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    for (let attempt = 0; attempt < 3; attempt++) {
      const { room, players } = await loadRoom(db, data.roomId);
      if (room.status !== "playing") throw new Error("Nenhuma partida em andamento.");
      const ids: string[] = room.state.playerIds ?? [];
      const refs: PlayerRef[] = ids
        .map((id) => players.find((p) => p.user_id === id))
        .filter(Boolean)
        .map((p: any) => ({ id: p.user_id, nickname: p.nickname, photo_path: p.photo_path, avatar: p.avatar }));
      const { data: secRows } = await db.from("room_secrets").select("*").eq("room_id", room.id);
      const secrets: Secrets = {};
      (secRows ?? []).forEach((r: any) => (secrets[`${r.user_id}:${r.kind}`] = r.data));
      let res;
      try {
        res = applyAction(room.game as GameId, { players: refs, state: room.state, secrets, now: Date.now() }, context.userId, data.type, data.payload);
      } catch (e) {
        if (e instanceof GameError) return { ok: false, error: e.message };
        throw e;
      }
      const { data: updated } = await db
        .from("rooms")
        .update({ state: { ...res.state, playerIds: ids }, version: room.version + 1, updated_at: new Date().toISOString() })
        .eq("id", room.id)
        .eq("version", room.version)
        .select("id");
      if (!updated?.length) continue; // someone else moved first — retry with fresh state
      await writeSecrets(db, room.id, res.secrets);
      if (res.finish) await recordFinish(db, room, ids, res.finish);
      return { ok: true, error: null };
    }
    return { ok: false, error: "Muitas jogadas ao mesmo tempo, tente de novo." };
  });

async function recordFinish(db: any, room: any, ids: string[], finish: { winners: string[]; summary: string }) {
  await db.from("room_history").insert({ room_id: room.id, game: room.game, summary: finish.summary, winner_ids: finish.winners });
  for (const id of ids) {
    const won = finish.winners.includes(id);
    if (won) {
      const { data: rp } = await db.from("room_players").select("wins").eq("room_id", room.id).eq("user_id", id).maybeSingle();
      if (rp) await db.from("room_players").update({ wins: rp.wins + 1 }).eq("room_id", room.id).eq("user_id", id);
    }
    const { data: prof } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
    const base = prof ?? { id, matches: 0, wins: 0, losses: 0, game_counts: {} };
    const counts = { ...(base.game_counts ?? {}) };
    counts[room.game] = (counts[room.game] ?? 0) + 1;
    const lost = finish.winners.length > 0 && !won;
    await db.from("profiles").upsert({
      id,
      matches: base.matches + 1,
      wins: base.wins + (won ? 1 : 0),
      losses: base.losses + (lost ? 1 : 0),
      game_counts: counts,
    });
  }
}
