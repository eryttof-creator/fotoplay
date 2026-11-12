import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOwnGameSecret, heartbeat } from "@/lib/api/rooms.functions";

export interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  game: string;
  status: string;
  state: any;
  version: number;
}
export interface PlayerRow {
  room_id: string;
  user_id: string;
  nickname: string;
  avatar: string;
  photo_path: string | null;
  ready: boolean;
  wins: number;
  joined_at: string;
  last_seen: string;
  is_bot?: boolean;
}
export interface HistoryRow {
  id: string;
  game: string;
  summary: string;
  winner_ids: string[];
  created_at: string;
}

/** Live room state: initial fetch + realtime updates + heartbeat + refetch on reconnect/focus. */
export function useRoom(roomId: string | null) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [secrets, setSecrets] = useState<Record<string, any>>({});
  const [gone, setGone] = useState(false);
  const [connected, setConnected] = useState(true);
  const [offset, setOffset] = useState(0); // serverNow - clientNow
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    const [r, p, h, s, own] = await Promise.all([
      supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
      supabase.from("room_players").select("*").eq("room_id", roomId).order("joined_at"),
      supabase.from("room_history").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(20),
      supabase.from("room_secrets").select("user_id,data").eq("room_id", roomId).eq("kind", "whoami"),
      getOwnGameSecret({ data: { roomId } }).catch(() => null),
    ]);
    if (r.error) return;
    if (!r.data) {
      setGone(true);
      return;
    }
    setRoom(r.data as RoomRow);
    setPlayers((p.data ?? []) as PlayerRow[]);
    setHistory((h.data ?? []) as HistoryRow[]);
    const secretMap = Object.fromEntries((s.data ?? []).map((x: any) => [x.user_id, x.data]));
    const ownSecret = own?.secrets?.[r.data.game];
    if (ownSecret) secretMap[own.userId] = ownSecret;
    setSecrets(secretMap);
  }, [roomId]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(refresh, 60);
  }, [refresh]);

  useEffect(() => {
    if (!roomId) return;
    refresh();
    const channel = supabase
      .channel(`room-${roomId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, (payload) => {
        if (payload.eventType === "DELETE") return setGone(true);
        setRoom(payload.new as RoomRow);
        schedule();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` }, schedule)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_history", filter: `room_id=eq.${roomId}` }, schedule)
      .subscribe((status) => {
        const ok = status === "SUBSCRIBED";
        setConnected(ok);
        if (ok) refresh(); // catch up on anything missed while disconnected
      });

    const beat = async () => {
      try {
        const t0 = Date.now();
        const { serverNow } = await heartbeat({ data: { roomId } });
        setOffset(serverNow - (t0 + Date.now()) / 2);
      } catch {
        /* offline — retried next tick */
      }
    };
    beat();
    const hb = setInterval(beat, 20_000);
    const poll = setInterval(refresh, 15_000); // safety net if a realtime message is lost
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(hb);
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [roomId, refresh, schedule]);

  return { room, players, history, secrets, gone, connected, offset, refresh };
}

export const isOnline = (p: PlayerRow) => !!p.is_bot || Date.now() - new Date(p.last_seen).getTime() < 50_000;
