import { requireAuth, signOut } from "./auth.js";
import { supabase } from "./app.js";
import { toast } from "./ui.js";
import { initMotion } from "./animations.js";

let heartbeatTimer = null;

async function updatePresence(status = "online") {
  if (!supabase) return;
  try { await supabase.rpc("set_presence", { p_status: status }); } catch {}
}

async function startPresence() {
  await updatePresence("online");
  clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => updatePresence("online"), 30000);
  window.addEventListener("pagehide", () => updatePresence("offline"), { once: true });
}

export async function getLandingStats() {
  if (!supabase) throw new Error("Supabase no está configurado.");\n  const { data, error } = await supabase.rpc("get_landing_stats");\n  if (error) throw error;\n  return { minutes: Number(data?.minutes ?? 0), clothing: Number(data?.clothing ?? 0), games: Number(data?.games ?? 0) };\n}\n\nexport async function getPublicStats() {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const cutoff = new Date(Date.now() - 90000).toISOString();
  const [{ count: total, error: totalError }, { count: online, error: onlineError }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true })
      .eq("status", "online").gt("last_seen", cutoff)
  ]);
  if (totalError) throw totalError;
  if (onlineError) throw onlineError;
  return { total: total ?? 0, online: online ?? 0 };
}

async function getProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[char]));
}

function avatar(url, name) {
  return url
    ? '<img class="account-avatar" src="' + safe(url) + '" alt="">'
    : '<span class="account-avatar">' + safe((name || "K").slice(0, 1).toUpperCase()) + "</span>";
}

function setupAccount(profile) {
  const host = document.querySelector(".user-pill");
  if (!host) return;

  const name = profile.username || "Usuario";
  host.innerHTML =
    '<button class="account-trigger" type="button" aria-expanded="false">' +
      avatar(profile.avatar_url, name) +
      '<span class="account-name">' + safe(name) + '</span><span aria-hidden="true">⌄</span>' +
    '</button>' +
    '<div class="account-menu" hidden>' +
      '<div class="account-menu-head">' + avatar(profile.avatar_url, name) +
        '<div><strong>' + safe(name) + '</strong><small>🪙 ' +
        Number(profile.coins ?? 0).toLocaleString() + ' Coins</small></div></div>' +
      '<a href="profile.html">Mi perfil</a>' +
      '<button class="danger" data-signout type="button">Cerrar sesión</button>' +
    '</div>';

  const trigger = host.querySelector(".account-trigger");
  const menu = host.querySelector(".account-menu");

  trigger.addEventListener("click", event => {
    event.stopPropagation();
    const open = host.classList.toggle("is-open");
    trigger.setAttribute("aria-expanded", String(open));
    menu.hidden = !open;
  });

  menu.addEventListener("click", event => event.stopPropagation());
  document.addEventListener("click", () => {
    host.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  });

  host.querySelector("[data-signout]").addEventListener("click", async () => {
    await updatePresence("offline");
    try { await signOut(); }
    catch { toast("No se pudo cerrar sesión.", "error"); }
  });
}

export async function bootShell() {
  const session = await requireAuth();
  if (!session || !supabase) return null;

  const profile = await getProfile(session.user.id);
  document.querySelectorAll("[data-username]").forEach(el => el.textContent = profile.username);
  document.querySelectorAll("[data-coins]").forEach(el => {
    el.textContent = Number(profile.coins ?? 0).toLocaleString();
  });

  setupAccount(profile);
  await startPresence();
  try { await supabase.rpc("track_activity"); } catch {}
  clearInterval(window.__kiizuActivityTimer);
  window.__kiizuActivityTimer = setInterval(() => supabase.rpc("track_activity").catch(() => {}), 30000);
  initMotion();

  return { session, profile };
}
