import { supabase } from "./app.js";
import { bootShell } from "./nav.js";
import { toast } from "./ui.js";

const params = new URLSearchParams(location.search);
const gameSlug = params.get("game") || "reaction";
const state = await bootShell();
const status = document.querySelector("#match-status");
const detail = document.querySelector("#match-detail");
const playersEl = document.querySelector("#players");
const action = document.querySelector("#game-action");
const scoreEl = document.querySelector("#game-score");
const gameName = document.querySelector("#game-name");

const names = { reaction:"REACTION ARENA", quickclick:"QUICK CLICK", memory:"MEMORY" };
gameName.textContent = names[gameSlug] || gameSlug.toUpperCase();

let match = null;
let channel = null;
let score = 0;
let running = false;

async function begin() {
  if (!state || !supabase) return;
  status.innerHTML = "Buscando jugadores<span class="dots">...</span>";
  detail.textContent = "Creando o encontrando una sala disponible.";
  const { data, error } = await supabase.rpc("create_match", { p_game_slug: gameSlug });
  if (error) throw error;
  match = data;
  channel = supabase.channel(`match:${match.id}`, { config: { presence: { key: state.session.user.id } } });

  channel.on("presence", { event: "sync" }, () => {
    const count = Object.keys(channel.presenceState()).length;
    playersEl.textContent = count;
    if (count >= 1 && !running) detail.textContent = "Sala sincronizada. Esperando el inicio...";
  }).on("postgres_changes", { event: "*", schema: "public", table: "match_players", filter: `match_id=eq.${match.id}` }, async () => {
    const { data: rows } = await supabase.from("match_players").select("user_id").eq("match_id", match.id);
    playersEl.textContent = rows?.length || 1;
    if (match.host_id === state.session.user.id && rows?.length >= 1 && match.status === "waiting") {
      const started = await supabase.rpc("start_match", { p_match_id: match.id });
      if (!started.error) match = started.data;
    }
  }).on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${match.id}` }, payload => {
    match = payload.new;
    if (match.status === "starting" && !running) startCountdown();
  }).on("broadcast", { event: "score" }, ({ payload }) => {
    if (payload.user_id !== state.session.user.id) detail.textContent = `${payload.name || "Player"} está jugando...`;
  }).subscribe(async statusValue => {
    if (statusValue !== "SUBSCRIBED") return;
    await channel.track({ user_id: state.session.user.id, username: state.profile.username });
  });

  if (match.status === "starting" || match.status === "playing") startCountdown();
}

async function startCountdown() {
  running = true;
  for (const n of [3,2,1]) {
    status.textContent = String(n);
    await new Promise(r => setTimeout(r, 650));
  }
  status.textContent = "GO!";
  detail.textContent = "Consigue la mayor puntuación.";
  action.textContent = gameSlug === "reaction" ? "REACCIONAR" : "CLICK";
  action.disabled = false;
}

action.addEventListener("click", async () => {
  if (!running) return;
  score += gameSlug === "reaction" ? Math.ceil(Math.random() * 5) : 1;
  scoreEl.textContent = score;
  if (channel) await channel.send({ type: "broadcast", event: "score", payload: { user_id: state.session.user.id, name: state.profile.username, score } });
  if (score >= 10) {
    running = false;
    action.disabled = true;
    status.textContent = "PARTIDA TERMINADA";
    detail.textContent = "La puntuación se sincronizó con la sala. Las recompensas competitivas requieren validación server-side.";
    toast("Resultado registrado en esta sesión.", "success");
  }
});

window.addEventListener("beforeunload", () => channel?.unsubscribe());

if (state) {
  try { await begin(); } catch (error) {
    status.textContent = "No se pudo crear la sala";
    detail.textContent = error.message || "Error de conexión.";
    toast(detail.textContent, "error");
  }
}