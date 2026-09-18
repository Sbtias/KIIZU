import { supabase } from "./app.js";

export async function getLandingStats() {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("get_landing_stats");
  if (error) throw error;
  return {
    minutes: Number(data?.minutes ?? 0),
    clothing: Number(data?.clothing ?? 0),
    games: Number(data?.games ?? 0)
  };
}
