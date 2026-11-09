// Preferences for friends, favorites, blocked users, and privacy
import { supabase } from "@/integrations/supabase/client";

export interface SocialPreferences {
  favorites: string[]; // user IDs of favorite friends
  blocked: string[];   // user IDs of blocked users
  isPrivate: boolean;  // whether profile is private
}

const STORAGE_KEY_PREFIX = "fp_social_prefs_";

export function getLocalPreferences(userId?: string): SocialPreferences {
  if (typeof window === "undefined" || !userId) {
    return { favorites: [], blocked: [], isPrivate: false };
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { favorites: [], blocked: [], isPrivate: false };
}

export function saveLocalPreferences(userId: string, prefs: SocialPreferences) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(prefs));
  } catch {}
}

export async function toggleFavorite(userId: string, targetId: string): Promise<boolean> {
  const prefs = getLocalPreferences(userId);
  const exists = prefs.favorites.includes(targetId);
  const updatedFavorites = exists
    ? prefs.favorites.filter((id) => id !== targetId)
    : [...prefs.favorites, targetId];
  
  const updated: SocialPreferences = { ...prefs, favorites: updatedFavorites };
  saveLocalPreferences(userId, updated);
  
  // Persist to user profile if possible
  try {
    const { data: profile } = await supabase.from("profiles").select("game_counts").eq("id", userId).maybeSingle();
    const currentCounts = (profile?.game_counts as Record<string, any>) || {};
    await supabase.from("profiles").update({
      game_counts: { ...currentCounts, _favorites: updatedFavorites },
    }).eq("id", userId);
  } catch {}
  
  return !exists;
}

export async function blockUser(userId: string, targetId: string): Promise<void> {
  const prefs = getLocalPreferences(userId);
  if (prefs.blocked.includes(targetId)) return;
  const updatedBlocked = [...prefs.blocked, targetId];
  const updated: SocialPreferences = { ...prefs, blocked: updatedBlocked };
  saveLocalPreferences(userId, updated);

  try {
    const { data: profile } = await supabase.from("profiles").select("game_counts").eq("id", userId).maybeSingle();
    const currentCounts = (profile?.game_counts as Record<string, any>) || {};
    await supabase.from("profiles").update({
      game_counts: { ...currentCounts, _blocked: updatedBlocked },
    }).eq("id", userId);
  } catch {}
}

export async function unblockUser(userId: string, targetId: string): Promise<void> {
  const prefs = getLocalPreferences(userId);
  const updatedBlocked = prefs.blocked.filter((id) => id !== targetId);
  const updated: SocialPreferences = { ...prefs, blocked: updatedBlocked };
  saveLocalPreferences(userId, updated);

  try {
    const { data: profile } = await supabase.from("profiles").select("game_counts").eq("id", userId).maybeSingle();
    const currentCounts = (profile?.game_counts as Record<string, any>) || {};
    await supabase.from("profiles").update({
      game_counts: { ...currentCounts, _blocked: updatedBlocked },
    }).eq("id", userId);
  } catch {}
}

export async function setProfilePrivacy(userId: string, isPrivate: boolean): Promise<void> {
  const prefs = getLocalPreferences(userId);
  const updated: SocialPreferences = { ...prefs, isPrivate };
  saveLocalPreferences(userId, updated);

  try {
    const { data: profile } = await supabase.from("profiles").select("game_counts").eq("id", userId).maybeSingle();
    const currentCounts = (profile?.game_counts as Record<string, any>) || {};
    await supabase.from("profiles").update({
      game_counts: { ...currentCounts, _isPrivate: isPrivate },
    }).eq("id", userId);
  } catch {}
}
