
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL DEFAULT '',
  avatar text NOT NULL DEFAULT 'a1',
  photo_path text,
  matches int NOT NULL DEFAULT 0,
  wins int NOT NULL DEFAULT 0,
  losses int NOT NULL DEFAULT 0,
  game_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  host_id uuid NOT NULL,
  game text NOT NULL DEFAULT 'tictactoe',
  status text NOT NULL DEFAULT 'lobby',
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  version int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.room_players (
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  nickname text NOT NULL,
  avatar text NOT NULL DEFAULT 'a1',
  photo_path text,
  ready boolean NOT NULL DEFAULT false,
  wins int NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
CREATE TABLE public.room_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  game text NOT NULL,
  summary text NOT NULL,
  winner_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.room_secrets (
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (room_id, user_id, kind)
);

GRANT SELECT ON public.rooms, public.room_players, public.room_history, public.room_secrets TO authenticated;
GRANT ALL ON public.rooms, public.room_players, public.room_history, public.room_secrets TO service_role;

CREATE OR REPLACE FUNCTION public.is_room_member(_room uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_players WHERE room_id = _room AND user_id = _user)
$$;
CREATE OR REPLACE FUNCTION public.shares_room(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _a = _b OR EXISTS (
    SELECT 1 FROM public.room_players p1 JOIN public.room_players p2 ON p1.room_id = p2.room_id
    WHERE p1.user_id = _a AND p2.user_id = _b)
$$;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read room" ON public.rooms FOR SELECT TO authenticated USING (public.is_room_member(id, auth.uid()));
CREATE POLICY "members read players" ON public.room_players FOR SELECT TO authenticated USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "members read history" ON public.room_history FOR SELECT TO authenticated USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "members read others whoami" ON public.room_secrets FOR SELECT TO authenticated
  USING (kind = 'whoami' AND user_id <> auth.uid() AND public.is_room_member(room_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_history;
ALTER TABLE public.room_players REPLICA IDENTITY FULL;

CREATE POLICY "photos read shared" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'photos' AND public.shares_room(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "photos insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "photos update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "photos delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
