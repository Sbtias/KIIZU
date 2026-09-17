import { requireAuth, signOut } from "./auth.js";
import { getProfile } from "./profile.js";
import { toast } from "./ui.js";

export async function bootShell() {
  const session = await requireAuth();
  if (!session) return null;
  const profile = await getProfile(session.user.id);
  document.querySelectorAll("[data-username]").forEach(el => el.textContent = profile.username);
  document.querySelectorAll("[data-coins]").forEach(el => el.textContent = Number(profile.coins).toLocaleString());
  document.querySelectorAll("[data-signout]").forEach(el => el.addEventListener("click", async () => {
    try { await signOut(); } catch { toast("No se pudo cerrar sesión.", "error"); }
  }));
  return { session, profile };
}
