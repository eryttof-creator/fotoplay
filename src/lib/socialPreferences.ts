// Favorite friends are stored per account (RLS: only the owner reads/writes them).
// Blocks go through the blockAction server function so they are enforced for both people.
import { supabase } from "@/integrations/supabase/client";

export async function setFavorite(userId: string, friendId: string, favorite: boolean): Promise<void> {
  const { error } = favorite
    ? await supabase.from("favorite_friends").upsert({ user_id: userId, friend_id: friendId })
    : await supabase.from("favorite_friends").delete().eq("user_id", userId).eq("friend_id", friendId);
  if (error) throw new Error("Não foi possível atualizar os favoritos.");
}
