import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureSession } from "./session";

export interface MyProfile {
  id: string;
  nickname: string;
  avatar: string;
  photo_path: string | null;
  matches: number;
  wins: number;
  losses: number;
  game_counts: Record<string, number>;
}

export function useMyProfile() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const uid = await ensureSession();
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    setProfile(
      (data as MyProfile | null) ?? { id: uid, nickname: "", avatar: "a1", photo_path: null, matches: 0, wins: 0, losses: 0, game_counts: {} },
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const save = useCallback(async (p: { nickname: string; avatar: string; photo_path: string | null }) => {
    const uid = await ensureSession();
    const { error } = await supabase.from("profiles").upsert({ id: uid, ...p });
    if (error) throw error;
    setProfile((prev) => (prev ? { ...prev, ...p } : prev));
  }, []);

  return { profile, loading, save, reload: load };
}
