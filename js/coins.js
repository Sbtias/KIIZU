import { supabase } from "./app.js";

export async function getCoinBalance(userId) {
  const { data, error } = await supabase.from("profiles").select("coins").eq("id", userId).single();
  if (error) throw error;
  return Number(data.coins || 0);
}

export function animateNumber(element, from, to, duration = 420) {
  if (!element) return;
  const start = performance.now();
  const tick = now => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    element.textContent = Math.round(from + (to - from) * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
