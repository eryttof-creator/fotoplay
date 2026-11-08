CREATE OR REPLACE FUNCTION public.commit_game_move(p_room_id uuid, p_version integer, p_state jsonb, p_secrets jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE entry record; secret_uid uuid; secret_kind text;
BEGIN
  UPDATE public.rooms SET state = p_state, version = version + 1, updated_at = now() WHERE id = p_room_id AND version = p_version AND status = 'playing';
  IF NOT FOUND THEN RETURN false; END IF;
  FOR entry IN SELECT key, value FROM jsonb_each(coalesce(p_secrets, '{}'::jsonb)) LOOP
    secret_uid := split_part(entry.key, ':', 1)::uuid;
    secret_kind := split_part(entry.key, ':', 2);
    IF entry.value = 'null'::jsonb THEN
      DELETE FROM public.room_secrets WHERE room_id = p_room_id AND user_id = secret_uid AND kind = secret_kind;
    ELSE
      INSERT INTO public.room_secrets(room_id, user_id, kind, data) VALUES(p_room_id, secret_uid, secret_kind, entry.value) ON CONFLICT(room_id,user_id,kind) DO UPDATE SET data = excluded.data;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.commit_game_move(uuid,integer,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_game_move(uuid,integer,jsonb,jsonb) TO service_role;