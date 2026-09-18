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

export async function getPublicStats() {
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
      '<a href="chat.html">Chat</a>' +
      '<button data-settings type="button">Ajustes</button>' +
      '<button class="danger" data-signout type="button">Cerrar sesión</button>' +
    '</div>';

  const trigger = host.querySelector(".account-trigger");
  const menu = host.querySelector(".account-menu");
  const settingsButton = host.querySelector("[data-settings]");

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

  settingsButton.addEventListener("click", () => openSettings());

  host.querySelector("[data-signout]").addEventListener("click", async () => {
    await updatePresence("offline");
    try { await signOut(); }
    catch { toast("No se pudo cerrar sesión.", "error"); }
  });
}

export async function bootShell() {
  const session = await requireAuth();
  if (!session || !supabase) return null;

  let profile;
  try {
    profile = await getProfile(session.user.id);
  } catch (error) {
    profile = {
      id: session.user.id,
      username: session.user.user_metadata?.username
        || session.user.email?.split("@")[0]
        || "Usuario",
      coins: 0
    };
    console.warn("No se pudo cargar el perfil desde la base de datos:", error);
  }

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

const THEME_KEY="kiizu-theme";
const THEMES=["dark","aurora","light"];
function applyTheme(theme){const selected=THEMES.includes(theme)?theme:"dark";document.documentElement.dataset.theme=selected;try{localStorage.setItem(THEME_KEY,selected)}catch{}return selected}
function initTheme(){try{applyTheme(localStorage.getItem(THEME_KEY)||"dark")}catch{applyTheme("dark")}}
function closeSettings(){const modal=document.querySelector("[data-settings-modal]");if(!modal)return;modal.classList.remove("is-open");document.body.classList.remove("settings-open");setTimeout(()=>{if(!modal.classList.contains("is-open"))modal.hidden=true},180)}
function updateThemeOptions(selected){document.querySelectorAll("[data-theme-option]").forEach(button=>{const active=button.dataset.themeOption===selected;button.classList.toggle("is-selected",active);button.setAttribute("aria-pressed",String(active))})}
function openSettings(){
  let modal=document.querySelector("[data-settings-modal]");
  if(!modal){
    modal=document.createElement("div");modal.className="settings-modal";modal.dataset.settingsModal="";modal.hidden=true;
    modal.innerHTML='<div class="settings-backdrop" data-settings-close></div><section class="settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabindex="-1"><header class="settings-head"><div><span class="eyebrow">PREFERENCIAS</span><h2 id="settings-title">Ajustes</h2></div><button class="settings-close" type="button" aria-label="Cerrar ajustes" data-settings-close>×</button></header><div class="settings-section"><div class="settings-section-title"><strong>Apariencia</strong><span>Elige cómo quieres ver KIIZU.</span></div><div class="theme-grid"><button type="button" class="theme-option" data-theme-option="dark"><span class="theme-preview theme-preview-dark"></span><span><strong>KIIZU Dark</strong><small>Minimalista y oscuro</small></span></button><button type="button" class="theme-option" data-theme-option="aurora"><span class="theme-preview theme-preview-aurora"></span><span><strong>KIIZU Aurora</strong><small>Tecnológico y ambiental</small></span></button><button type="button" class="theme-option" data-theme-option="light"><span class="theme-preview theme-preview-light"></span><span><strong>KIIZU Light</strong><small>Claro y limpio</small></span></button></div></div><div class="settings-section settings-info"><div><strong>Sonido de interfaz</strong><span>Los sonidos se reproducen solo al interactuar.</span></div><span class="settings-badge">ACTIVO</span></div><div class="settings-section settings-danger"><div class="settings-section-title"><strong>Cuenta</strong><span>Las acciones de cuenta pueden ser permanentes.</span></div><button class="button settings-delete-trigger" type="button">Eliminar mi cuenta</button></div></section></div>';
    document.body.appendChild(modal);
    modal.addEventListener("click",event=>{
      if(event.target.closest("[data-settings-close]"))closeSettings();
      const option=event.target.closest("[data-theme-option]");
      if(option)updateThemeOptions(applyTheme(option.dataset.themeOption));
      if(event.target.closest(".settings-delete-trigger"))openDeleteFlow();
    });
    modal.addEventListener("keydown",event=>{if(event.key==="Escape")closeSettings()});
  }
  updateThemeOptions(document.documentElement.dataset.theme||"dark");modal.hidden=false;
  requestAnimationFrame(()=>{modal.classList.add("is-open");document.body.classList.add("settings-open");modal.querySelector(".settings-close")?.focus()});
}
function openDeleteFlow(){
  const modal=document.querySelector("[data-settings-modal]");
  if(!modal)return;
  const card=modal.querySelector(".settings-card");
  card.innerHTML='<header class="settings-head"><div><span class="eyebrow">CUENTA</span><h2>Eliminar cuenta</h2></div><button class="settings-close" type="button" aria-label="Cancelar" data-delete-cancel>×</button></header><div class="delete-flow"><div class="delete-step is-active" data-delete-step="1"><span class="delete-number">1</span><div><h3>Primero, detente un segundo.</h3><p>Eliminar tu cuenta borra tu perfil y los datos asociados de KIIZU. Esta acción no se puede deshacer.</p></div><button class="button" data-delete-next="2">Continuar</button></div><div class="delete-step" data-delete-step="2"><span class="delete-number">2</span><div><h3>Confirma que lo entiendes.</h3><p>Tu progreso, amigos, mensajes y contenido asociado a la cuenta dejarán de estar disponibles.</p></div><label class="delete-check"><input type="checkbox" data-delete-check> He leído y entiendo esta advertencia.</label><button class="button" data-delete-next="3" disabled>Continuar</button></div><div class="delete-step" data-delete-step="3"><span class="delete-number">3</span><div><h3>Escribe ELIMINAR.</h3><p>Esto evita que una pulsación accidental borre la cuenta.</p></div><input class="delete-input" data-delete-word autocomplete="off" spellcheck="false" placeholder="ELIMINAR"><button class="button" data-delete-next="4" disabled>Continuar</button></div><div class="delete-step" data-delete-step="4"><span class="delete-number">4</span><div><h3>Última confirmación.</h3><p>Si continúas, KIIZU solicitará la eliminación definitiva de tu cuenta.</p></div><div class="tool-row"><button class="button button--ghost" data-delete-cancel type="button">Cancelar</button><button class="button settings-delete-final" data-delete-final type="button">Eliminar definitivamente</button></div><p class="form-status" data-delete-status></p></div></div>';
  const showStep=step=>{card.querySelectorAll(".delete-step").forEach(el=>el.classList.toggle("is-active",el.dataset.deleteStep===step));card.querySelector(`[data-delete-step="${step}"] button`)?.focus()};
  card.addEventListener("click",event=>{
    if(event.target.closest("[data-delete-cancel]")){document.querySelector("[data-settings-modal]")?.remove();document.body.classList.remove("settings-open");openSettings();return}
    const next=event.target.closest("[data-delete-next]");
    if(next&&!next.disabled){showStep(next.dataset.deleteNext)}
    if(event.target.closest("[data-delete-final]"))deleteAccount();
  });
  card.addEventListener("input",event=>{
    if(event.target.matches("[data-delete-check]"))card.querySelector(`[data-delete-next="3"]`).disabled=!event.target.checked;
    if(event.target.matches("[data-delete-word]"))card.querySelector(`[data-delete-next="4"]`).disabled=event.target.value.trim()!=="ELIMINAR";
  });
}
async function deleteAccount(){
  const status=document.querySelector("[data-delete-status]");
  const button=document.querySelector("[data-delete-final]");
  if(button)button.disabled=true;
  if(status)status.textContent="Eliminando cuenta...";
  try{
    const {error}=await supabase.rpc("delete_my_account");
    if(error)throw error;
    await supabase.auth.signOut();
    localStorage.removeItem(THEME_KEY);
    window.location.replace("index.html");
  }catch(error){
    if(status)status.textContent=error.message||"No se pudo eliminar la cuenta.";
    if(button)button.disabled=false;
  }
}
initTheme();
