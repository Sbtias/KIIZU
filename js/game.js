import { supabase } from "./app.js";
import { bootShell } from "./nav.js?v=20260918-1335";
import { toast } from "./ui.js";
import { Kiizu2D, buildWorld } from "./game-engine.js";

const params = new URLSearchParams(location.search);
const gameSlug = params.get("game");
const state = await bootShell();

const status = document.querySelector("#match-status");
const detail = document.querySelector("#match-detail");
const playersEl = document.querySelector("#players");
const scoreEl = document.querySelector("#game-score");
const gameName = document.querySelector("#game-name");
const healthEl = document.querySelector("#health");
const coinsEl = document.querySelector("#world-coins");
const objectiveEl = document.querySelector("#objective");
const canvas = document.querySelector("#game-canvas");

let match = null, channel = null, game = null, engine = null;
let score = 0, coins = 0, health = 100;
let running = false, finished = false, countdownRunning = false;
let roundTimer = null, positionTimer = null;

const fallbackGames = {
  reaction: { world: "adventure", objective: "Llega a la meta" },
  quickclick: { world: "race", objective: "Corre hasta la meta" },
  memory: { world: "adventure", objective: "Explora y encuentra objetos" },
  obstacle: { world: "adventure", objective: "Supera los obstáculos" },
  race: { world: "race", objective: "Llega primero a la meta" },
  survival: { world: "mine", objective: "Recolecta recursos y llega a la meta" }
};

async function loadGame() {
  if (!gameSlug) throw new Error("Falta seleccionar un juego.");
  const { data, error } = await supabase.from("games")
    .select("id,slug,name,description,min_players,max_players,is_published,unlocked_by_default,game_config")
    .eq("slug", gameSlug).maybeSingle();
  if (error) throw error;
  if (!data || (!data.unlocked_by_default && !data.is_published)) throw new Error("Este juego no está disponible.");
  game = data;
  gameName.textContent = data.name;
  objectiveEl.textContent = data.game_config?.objective || fallbackGames[gameSlug]?.objective || "Completa el mundo";
}
function worldType() { return game?.game_config?.world || fallbackGames[gameSlug]?.world || "adventure"; }
function timeLimit() { return Math.max(20, Number(game?.game_config?.time_limit) || 120); }
function setScore(value) { score = Math.max(0, Math.floor(value)); scoreEl.textContent = score.toLocaleString(); }
function setHealth(value) { health = Math.max(0, Math.min(100, value)); healthEl.textContent = String(health); }
function setCoins(value) { coins = Math.max(0, value); coinsEl.textContent = String(coins); }

async function begin() {
  if (!state || !supabase) return;
  await loadGame();
  status.innerHTML = 'Buscando jugadores<span class="dots">...</span>';
  detail.textContent = "Creando o encontrando una sala disponible.";

  const { data, error } = await supabase.rpc("create_match", { p_game_slug: gameSlug });
  if (error) throw error;
  match = data;

  channel = supabase.channel(`match:${match.id}`, { config: { presence: { key: state.session.user.id } } });
  channel
    .on("presence", { event: "sync" }, () => {
      playersEl.textContent = String(Object.keys(channel.presenceState()).length);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "match_players", filter: `match_id=eq.${match.id}` }, () => syncMatchState().catch(() => {}))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${match.id}` }, payload => {
      match = payload.new;
      if ((match.status === "starting" || match.status === "playing") && !countdownRunning && !finished) startCountdown();
      if (match.status === "finished" && !finished) {
        running = false;
        engine?.stop();
        status.textContent = "PARTIDA TERMINADA";
        detail.textContent = "La sala ha cerrado y los resultados fueron registrados.";
      }
    })
    .on("broadcast", { event: "player_move" }, ({ payload }) => {
      if (!engine || !payload?.user_id || payload.user_id === state.session.user.id) return;
      const current = Array.from(engine.remotePlayers.values()).filter(p => p.user_id !== payload.user_id);
      engine.setRemotePlayers([...current, payload]);
    })
    .subscribe(async value => {
      if (value !== "SUBSCRIBED") return;
      await channel.track({ user_id: state.session.user.id, username: state.profile.username });
      await syncMatchState();
    });

  if (match.status === "waiting" && match.host_id === state.session.user.id && Number(game?.min_players || 1) <= 1) {
    const started = await supabase.rpc("start_match", { p_match_id: match.id });
    if (started.error) throw started.error;
    match = started.data;
  }
  if (match.status === "starting" || match.status === "playing") startCountdown();
  else await syncMatchState();
}

async function syncMatchState() {
  if (!match?.id) return;
  const { data, error } = await supabase.rpc("get_match_state", { p_match_id: match.id });
  if (error) throw error;
  if (data?.match) match = data.match;
  const rows = Array.isArray(data?.players) ? data.players : [];
  playersEl.textContent = String(rows.length);

  if (match.status === "starting" || match.status === "playing") {
    if (!countdownRunning && !finished) startCountdown();
    return;
  }
  if (match.status === "waiting" && match.host_id === state.session.user.id && rows.length >= Number(game?.min_players || 1)) {
    const started = await supabase.rpc("start_match", { p_match_id: match.id });
    if (started.error) throw started.error;
    match = started.data;
    startCountdown();
  }
}

async function startCountdown() {
  if (countdownRunning || finished) return;
  countdownRunning = true;
  for (const n of [3, 2, 1]) {
    status.textContent = String(n);
    detail.textContent = "Prepárate.";
    await new Promise(resolve => setTimeout(resolve, 650));
  }
  status.textContent = "GO!";
  detail.textContent = "Explora, salta, recoge objetos y alcanza la meta.";
  buildGame();
  countdownRunning = false;
}

function buildGame() {
  engine?.stop();
  const built = buildWorld(worldType());
  const player = {
    user_id: state.session.user.id,
    username: state.profile.username || "Player",
    x: 150, y: 600, w: 34, h: 52, vx: 0, vy: 0,
    speed: 4.4, jump: 12, grounded: false, color: "#f0f2f5"
  };

  engine = new Kiizu2D(canvas, {
    world: built.world,
    entities: built.entities,
    player,
    onCollect: () => { setCoins(coins + 1); setScore(score + 10); },
    onHazard: () => {
      setHealth(health - 20);
      if (health <= 0) {
        setHealth(100);
        player.x = 150; player.y = 600;
      }
    },
    onGoal: () => { if (running && !finished) finishGame(); },
    onFrame: ({ player: p }) => {
      if (running) { player.x = p.x; player.y = p.y; }
    }
  });

  running = true;
  setScore(0); setCoins(0); setHealth(100);
  engine.start();

  clearTimeout(roundTimer);
  roundTimer = setTimeout(() => finishGame(), timeLimit() * 1000);
  clearInterval(positionTimer);
  positionTimer = setInterval(() => {
    if (!running || !channel || !engine) return;
    channel.send({
      type: "broadcast", event: "player_move",
      payload: { user_id: state.session.user.id, username: state.profile.username, x: engine.player.x, y: engine.player.y, color: engine.player.color }
    }).catch(() => {});
  }, 80);
}

async function finishGame() {
  if (finished) return;
  finished = true; running = false;
  clearTimeout(roundTimer); clearInterval(positionTimer); engine?.stop();
  status.textContent = "GUARDANDO RESULTADO...";
  detail.textContent = "Validando tu partida.";
  try {
    const finalScore = score + coins * 5;
    const { data, error } = await supabase.rpc("submit_match_score", { p_match_id: match.id, p_score: finalScore });
    if (error) throw error;
    match = data;
    status.textContent = "RESULTADO REGISTRADO";
    detail.textContent = match.status === "finished"
      ? "La partida terminó y los resultados fueron calculados."
      : "Tu resultado quedó guardado. Esperando a los demás jugadores.";
    toast("Resultado guardado.", "success");
  } catch (error) {
    finished = false; running = true;
    status.textContent = "NO SE PUDO GUARDAR";
    detail.textContent = error.message || "Error al registrar el resultado.";
    toast(detail.textContent, "error");
    engine?.start();
  }
}

window.addEventListener("pagehide", () => {
  clearInterval(positionTimer);
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
