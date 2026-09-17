import { supabase } from "./app.js";

export async function getProfile(userId) {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export async function ensureProfile(user, username = "") {
  if (!supabase || !user) return null;
  const fallback = username || user.user_metadata?.username || user.email?.split("@")[0] || "Player";
  const { data, error } = await supabase.from("profiles")
    .upsert({ id: user.id, username: fallback }, { onConflict: "id", ignoreDuplicates: true })
    .select().single();
  if (error && error.code !== "23505") throw error;
  return data;
}
