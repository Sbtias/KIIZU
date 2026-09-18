import { supabase } from "./app.js";
import { bootShell } from "./nav.js?v=20260918-1335";
import { toast } from "./ui.js";

const params = new URLSearchParams(location.search);
const gameSlug = params.get("game");
const state = await bootShell();
const status = document.querySelector("#match-status");
const detail = document.querySelector("#match-detail");
const playersEl = document.querySelector("#players");
const action = document.querySelector("#game-action");
const scoreEl = document.querySelector("#game-score");
const gameName = document.querySelector("#game-name");
const stage = document.querySelector("#game-stage");

let match = null;
let channel = null;
let game = null;
let score = 0;
let running = false;
let finished = false;
let roundTimer = null;
let memory = [];
let memoryOpen = [];
let memoryMatches = 0;

const fallbackGames = {
  reaction: { name: "Reaction Arena", mechanic: "reaction" },
  quickclick: { name: "Quick Click", mechanic: "click" },
  memory: { name: "Memory", mechanic: "memory" },
  obstacle: { name: "Obstacle Run", mechanic: "click" },
  race: { name: "Race", mechanic: "click" },
  survival: { name: "Survival", mechanic: "reaction" }
};

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function loadGame() {
  if (!gameSlug) throw new Error("Falta seleccionar un juego.");
  const { data, error } = await supabase
    .from("games")
    .select("id,slug,name,description,min_players,max_players,is_published,unlocked_by_default,game_config")
    .eq("slug", gameSlug)
    .maybeSingle();
  if (error) throw error;
  if (!data || (!data.unlocked_by_default && !data.is_published)) throw new Error("Este juego no está disponible.");
  game = data;
  gameName.textContent = data.name;
}

function mechanic() {
  return game?.game_config?.mechanic || fallbackGames[gameSlug]?.mechanic || "click";
}
function targetScore() {
  return Number(game?.game_config?.target_score) || (gameSlug === "race" ? 40 : 10);
}
function timeLimit() {
  return Math.max(5, Number(game?.game_config?.time_limit) || 30);
}
function startGameTimer() {
  clearTimeout(roundTimer);
  roundTimer = setTimeout(() => {
    if (running && !finished) finishGame();
  }, timeLimit() * 1000);
}

function setScore(value) {
  score = Math.max(0, Math.floor(value));
  scoreEl.textContent = score.toLocaleString();
}

function resetAction() {
  action.disabled = true;
  action.textContent = "LISTO";
  action.onclick = null;
}

async function begin() {
  if (!state || !supabase) return;
  await loadGame();

  status.innerHTML = "Buscando jugadores<span class="dots">...</span>";
  detail.textContent = "Creando o encontrando una sala disponible.";

  const { data, error } = await supabase.rpc("create_match", { p_game_slug: gameSlug });
  if (error) throw error;
  match = data;

  channel = supabase.channel(`match:${match.id}`, {
    config: { presence: { key: state.session.user.id } }
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const count = Object.keys(channel.presenceState()).length;
      playersEl.textContent = count;
    })
    .on("postgres_changes", {
      event: "*", schema: "public", table: "match_players",
      filter: `match_id=eq.${match.id}`
    }, async () => {
      try {
        await syncMatchState();
      } catch (error) {
        console.warn("No se pudo sincronizar la sala:", error);
      }
    })
    .on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "matches",
      filter: `id=eq.${match.id}`
    }, payload => {
      match = payload.new;
      if (match.status === "starting" && !running && !finished) startCountdown();
      if (match.status === "finished" && !finished) {
        running = false;
        status.textContent = "PARTIDA TERMINADA";
        detail.textContent = "Todos los resultados de la sala fueron registrados.";
        action.disabled = true;
      }
    })
    .on("broadcast", { event: "score" }, ({ payload }) => {
      if (payload.user_id !== state.session.user.id) {
        detail.textContent = `${payload.name || "Player"} lleva ${Number(payload.score || 0)} puntos.`;
      }
    })
    .subscribe(async value => {
      if (value !== "SUBSCRIBED") return;
      await channel.track({
        user_id: state.session.user.id,
        username: state.profile.username
      });
      await syncMatchState();
    });

  // Los juegos base permiten jugar con 1 jugador. Arrancamos directamente
  // después de crear la sala para que la pantalla no dependa de Realtime.
  if (match.status === "waiting" && match.host_id === state.session.user.id && Number(game?.min_players || 1) <= 1) {
    const started = await supabase.rpc("start_match", { p_match_id: match.id });
    if (started.error) throw started.error;
    match = started.data;
  }

  if (match.status === "starting" || match.status === "playing") {
    startCountdown();
  } else {
    await syncMatchState();
  }
}

async function syncMatchState() {
  if (!match?.id) return;

  // El estado de la partida se obtiene mediante una función segura del servidor.
  // Así el cliente no queda bloqueado por las políticas RLS de matches/match_players.
  const { data, error } = await supabase.rpc("get_match_state", { p_match_id: match.id });
  if (error) throw error;

  const freshMatch = data?.match;
  const rows = Array.isArray(data?.players) ? data.players : [];

  if (freshMatch) match = freshMatch;
  playersEl.textContent = String(rows.length);

  if (match.status === "starting" || match.status === "playing") {
    if (!running && !finished) startCountdown();
    return;
  }

  if (
    match.status === "waiting" &&
    match.host_id === state.session.user.id &&
    rows.length >= Number(game?.min_players || 1)
  ) {
    const started = await supabase.rpc("start_match", { p_match_id: match.id });
    if (started.error) throw started.error;
    match = started.data;
    if (match.status === "starting" && !running && !finished) startCountdown();
  }
}

async function startCountdown() {
  running = true;
  resetAction();
  setScore(0);
  for (const n of [3, 2, 1]) {
    status.textContent = String(n);
    await sleep(650);
  }
  status.textContent = "GO!";
  detail.textContent = "Completa el reto. Tu resultado se valida en el servidor.";
  buildGame();
  startGameTimer();
}

function buildGame() {
  const type = mechanic();
  if (type === "reaction") return buildReaction();
  if (type === "memory") return buildMemory();
  return buildClickGame();
}

function buildClickGame() {
  action.style.display = "";
  action.textContent = gameSlug === "race" ? "AVANZAR" : gameSlug === "obstacle" ? "SALTAR" : "CLICK";
  action.disabled = false;
  action.onclick = () => {
    if (!running) return;
    setScore(score + (gameSlug === "race" ? 2 : 1));
    if (score >= targetScore()) finishGame();
    else if (channel) channel.send({
      type: "broadcast", event: "score",
      payload: { user_id: state.session.user.id, name: state.profile.username, score }
    });
  };
}

async function buildReaction() {
  action.style.display = "";
  action.textContent = "ESPERA...";
  action.disabled = true;
  const wait = 900 + Math.floor(Math.random() * 2200);
  await sleep(wait);
  if (!running || finished) return;
  action.textContent = "¡AHORA!";
  action.disabled = false;
  const startedAt = performance.now();
  action.onclick = () => {
    if (!running) return;
    const reactionMs = Math.max(120, Math.round(performance.now() - startedAt));
    const points = Math.max(1, 11 - Math.floor(reactionMs / 100));
    setScore(score + points);
    if (score >= targetScore()) finishGame();
    else buildReaction();
  };
}

function buildMemory() {
  action.style.display = "none";
  const symbols = ["◆","●","▲","■","★","✦","⬟","○"];
  memory = [...symbols, ...symbols].sort(() => Math.random() - 0.5);
  memoryOpen = [];
  memoryMatches = 0;
  stage.querySelectorAll(".memory-grid").forEach(el => el.remove());

  const grid = document.createElement("div");
  grid.className = "memory-grid";
  memory.forEach((symbol, index) => {
    const card = document.createElement("button");
    card.className = "memory-card";
    card.type = "button";
    card.dataset.index = index;
    card.textContent = "?";
    card.addEventListener("click", () => revealMemory(card, symbol));
    grid.appendChild(card);
  });
  stage.appendChild(grid);
}

async function revealMemory(card, symbol) {
  if (!running || card.classList.contains("is-open") || card.classList.contains("is-match") || memoryOpen.length >= 2) return;
  card.classList.add("is-open");
  card.textContent = symbol;
  memoryOpen.push({ card, symbol });
  if (memoryOpen.length < 2) return;

  const [a, b] = memoryOpen;
  if (a.symbol === b.symbol) {
    a.card.classList.add("is-match");
    b.card.classList.add("is-match");
    memoryMatches++;
    setScore(score + 5);
    memoryOpen = [];
    if (memoryMatches === 8) finishGame();
  } else {
    await sleep(500);
    a.card.classList.remove("is-open");
    b.card.classList.remove("is-open");
    a.card.textContent = "?";
    b.card.textContent = "?";
    memoryOpen = [];
  }
}

async function finishGame() {
  if (finished) return;
  finished = true;
  running = false;
  clearTimeout(roundTimer);
  action.disabled = true;
  status.textContent = "ENVIANDO RESULTADO...";
  detail.textContent = "Validando tu puntuación.";
  try {
    const { data, error } = await supabase.rpc("submit_match_score", {
      p_match_id: match.id,
      p_score: score
    });
    if (error) throw error;
    match = data;
    if (channel) await channel.send({
      type: "broadcast", event: "score",
      payload: { user_id: state.session.user.id, name: state.profile.username, score }
    });
    status.textContent = "RESULTADO REGISTRADO";
    detail.textContent = match.status === "finished"
      ? "La partida terminó y los puestos fueron calculados."
      : "Tu resultado quedó guardado. Esperando a los demás jugadores.";
    toast("Resultado guardado.", "success");
  } catch (error) {
    finished = false;
    running = true;
    action.disabled = false;
    status.textContent = "NO SE PUDO GUARDAR";
    detail.textContent = error.message || "Error al registrar el resultado.";
    toast(detail.textContent, "error");
  }
}

window.addEventListener("pagehide", () => {
  if (match?.id && !finished) supabase.rpc("leave_match", { p_match_id: match.id }).catch(() => {});
  channel?.unsubscribe();
});

if (state) {
  try { await begin(); }
  catch (error) {
    status.textContent = "No se pudo crear la sala";
    detail.textContent = error.message || "Error de conexión.";
    toast(detail.textContent, "error");
  }
}