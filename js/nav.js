import { requireAuth, signOut } from "./auth.js";
import { getProfile } from "./profile.js";
import { supabase } from "./app.js";
import { toast } from "./ui.js";

let heartbeatTimer = null;

async function updatePresence(status = "online") {
  try { await supabase.rpc("set_presence", { p_status: status }); } catch {}
}

async function startPresence() {
  await updatePresence("online");
  clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => updatePresence("online"), 30000);
  window.addEventListener("pagehide", () => { updatePresence("offline"); });
}

export async function getPublicStats() {
  const [{ count: total }, { count: online }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true })
      .eq("status", "online")
      .gt("last_seen", new Date(Date.now() - 90000).toISOString())
  ]);
  return { total: total ?? 0, online: online ?? 0 };
}

export async function bootShell() {
  const session = await requireAuth();
  if (!session) return null;
  const profile = await getProfile(session.user.id);
  document.querySelectorAll("[data-username]").forEach(el => el.textContent = profile.username);
  document.querySelectorAll("[data-coins]").forEach(el => el.textContent = Number(profile.coins).toLocaleString());
  document.querySelectorAll("[data-signout]").forEach(el => el.addEventListener("click", async () => {
    await updatePresence("offline");
    try { await signOut(); } catch { toast("No se pudo cerrar sesión.", "error"); }
  }));
  await startPresence();
  return { session, profile };
}
