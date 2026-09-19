import { bootShell, getPublicStats } from "./nav.js?v=20260919-1426";
import { supabase } from "./app.js";

const state = await bootShell();
const totalEl = document.querySelector("[data-total-users]");
const onlineEl = document.querySelector("[data-online-users]");
const gamesEl = document.querySelector("[data-home-games]");
const clothingEl = document.querySelector("[data-home-clothing]");
const usersEl = document.querySelector("[data-home-users]");
const gamesGrid = document.querySelector("#home-games");
const safe = v => String(v ?? "").replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));

async function refreshStats() {
  try {
    const stats = await getPublicStats();
    if (totalEl) totalEl.textContent = stats.total.toLocaleString();
    if (onlineEl) onlineEl.textContent = stats.online.toLocaleString();
    if (usersEl) usersEl.textContent = stats.total.toLocaleString();
  } catch {
    if (totalEl) totalEl.textContent = "—";
    if (onlineEl) onlineEl.textContent = "—";
    if (usersEl) usersEl.textContent = "—";
  }
}

async function loadHomeContent() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from("games")
      .select("id,slug,name,description,min_players,max_players,thumbnail_url,created_at,profiles!games_creator_id_fkey(username)")
      .eq("is_published", true).order("created_at", { ascending:false }).limit(6);
    if (error) throw error;
    if (!data?.length) {
      gamesGrid.innerHTML = '<div class="empty-state"><h3>Aquí empieza la comunidad.</h3><p>Publica tu primer juego y aparecerá en esta sección.</p><a class="button button--small" href="game-creator.html">Crear juego</a></div>';
      if (gamesEl) gamesEl.textContent = "0";
      return;
    }
    if (gamesEl) gamesEl.textContent = data.length + (data.length === 6 ? "+" : "");
    gamesGrid.innerHTML = data.map(game => {
      const creator = game.profiles?.username || "Creador";
      const art = game.thumbnail_url
        ? '<img class="home-game-image" src="' + safe(game.thumbnail_url) + '" alt="">'
        : '<div class="discover-art">KIIZU</div>';
      return '<article class="discover-card home-game-card">' + art +
        '<div class="discover-card-body"><span class="eyebrow">por ' + safe(creator) + '</span><h3>' + safe(game.name) + '</h3><p>' + safe(game.description || "Un juego creado en KIIZU.") +
        '</p><small>' + Number(game.min_players || 1) + "–" + Number(game.max_players || 1) + ' jugadores</small><a class="button button--small" href="game.html?game=' + encodeURIComponent(game.slug) + '">Jugar →</a></div></article>';
    }).join("");
  } catch {
    gamesGrid.innerHTML = '<div class="empty-state"><h3>No pudimos cargar los juegos.</h3><p>La portada sigue aquí. Los servidores, como todos los humanos, a veces necesitan un segundo.</p></div>';
  }

  try {
    const { count } = await supabase.from("clothing_items").select("id", { count:"exact", head:true }).eq("is_published", true);
    if (clothingEl) clothingEl.textContent = Number(count || 0).toLocaleString();
  } catch {
    if (clothingEl) clothingEl.textContent = "—";
  }
}

if (state) {
  await refreshStats();
  await loadHomeContent();
  setInterval(refreshStats, 15000);
}
