import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let pending: Promise<string> | null = null;

/** Every visitor plays with a lightweight anonymous account, created on first visit. */
export function ensureSession(): Promise<string> {
  if (!pending) {
    pending = (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return data.session.user.id;
      const { data: signed, error } = await supabase.auth.signInAnonymously();
      if (error || !signed.user) {
        pending = null;
        throw error ?? new Error("Falha ao entrar");
      }
      return signed.user.id;
    })();
  }
  return pending;
}

export function useUserId() {
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    ensureSession().then(setUid).catch((e) => setError(String(e?.message ?? e)));
  }, []);
  return { uid, error };
}
