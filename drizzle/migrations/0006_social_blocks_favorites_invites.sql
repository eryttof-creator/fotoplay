CREATE TABLE public.user_blocks (blocker_id uuid NOT NULL, blocked_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (blocker_id, blocked_id), CHECK (blocker_id <> blocked_id));
GRANT SELECT ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_blocks_read ON public.user_blocks FOR SELECT TO authenticated USING (blocker_id = auth.uid());

CREATE TABLE public.favorite_friends (user_id uuid NOT NULL, friend_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, friend_id), CHECK (user_id <> friend_id));
GRANT SELECT, INSERT, DELETE ON public.favorite_friends TO authenticated;
GRANT ALL ON public.favorite_friends TO service_role;
ALTER TABLE public.favorite_friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_favorites_read ON public.favorite_friends FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY own_favorites_insert ON public.favorite_friends FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY own_favorites_delete ON public.favorite_friends FOR DELETE TO authenticated USING (user_id = auth.uid());

INSERT INTO public.favorite_friends (user_id, friend_id)
SELECT p.id, f.value::uuid FROM public.profiles p, jsonb_array_elements_text(CASE WHEN jsonb_typeof(p.game_counts->'_favorites')='array' THEN p.game_counts->'_favorites' ELSE '[]'::jsonb END) f(value)
WHERE f.value ~ '^[0-9a-f-]{36}$' AND f.value::uuid <> p.id ON CONFLICT DO NOTHING;
INSERT INTO public.user_blocks (blocker_id, blocked_id)
SELECT p.id, b.value::uuid FROM public.profiles p, jsonb_array_elements_text(CASE WHEN jsonb_typeof(p.game_counts->'_blocked')='array' THEN p.game_counts->'_blocked' ELSE '[]'::jsonb END) b(value)
WHERE b.value ~ '^[0-9a-f-]{36}$' AND b.value::uuid <> p.id ON CONFLICT DO NOTHING;
UPDATE public.profiles SET game_counts = game_counts - '_favorites' - '_blocked' - '_isPrivate' WHERE game_counts ?| ARRAY['_favorites','_blocked','_isPrivate'];

CREATE OR REPLACE FUNCTION public.username_available(name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT lower(trim(name)) ~ '^[a-z0-9_]{3,20}$' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(trim(name))) $$;
REVOKE ALL ON FUNCTION public.username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.register_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE wanted text := lower(NEW.raw_user_meta_data->>'username');
BEGIN
  IF wanted IS NULL OR wanted !~ '^[a-z0-9_]{3,20}$' OR EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = wanted) THEN wanted := NULL; END IF;
  BEGIN
    INSERT INTO public.profiles(id, username, nickname) VALUES (NEW.id, wanted, left(coalesce(NEW.raw_user_meta_data->>'nickname', ''), 20)) ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public.profiles(id, username, nickname) VALUES (NEW.id, NULL, left(coalesce(NEW.raw_user_meta_data->>'nickname', ''), 20)) ON CONFLICT (id) DO NOTHING;
  END;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.search_players(term text) RETURNS TABLE(id uuid, username text, nickname text, avatar text, bio text, matches integer, wins integer, photo_path text, last_active timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.nickname, p.avatar, p.bio, p.matches, p.wins,
    CASE WHEN p.id = auth.uid() OR public.are_friends(p.id, auth.uid()) THEN p.photo_path ELSE NULL END,
    CASE WHEN p.id = auth.uid() OR public.are_friends(p.id, auth.uid()) THEN p.last_active ELSE NULL END
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.username IS NOT NULL AND length(trim(term)) > 0
    AND NOT EXISTS (SELECT 1 FROM public.user_blocks ub WHERE ub.blocker_id = p.id AND ub.blocked_id = auth.uid())
    AND (lower(p.username) = lower(replace(trim(term), '@', '')) OR p.username ILIKE '%' || left(replace(trim(term), '@', ''), 40) || '%' OR p.nickname ILIKE '%' || left(trim(term), 40) || '%')
  ORDER BY (lower(p.username) = lower(replace(trim(term), '@', ''))) DESC, p.username
  LIMIT 30
$$;

CREATE UNIQUE INDEX game_invites_one_pending ON public.game_invites (recipient_id, coalesce(room_id, session_id)) WHERE status = 'pending';

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_blocks, public.favorite_friends;