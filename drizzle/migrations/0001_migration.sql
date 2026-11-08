REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
GRANT INSERT (id, nickname, avatar, photo_path) ON public.profiles TO authenticated;
GRANT UPDATE (nickname, avatar, photo_path) ON public.profiles TO authenticated;