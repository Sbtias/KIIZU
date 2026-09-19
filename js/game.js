import { supabase } from "./app.js";
import { bootShell } from "./nav.js?v=20260919-1426";
import { toast } from "./ui.js";
import { Kiizu2D, buildWorld, buildWorldFromConfig } from "./game-engine.js";

const params = new URLSearchParams(location.search);
const gameSlug = params.get("game");
let state = null;
try {
  state = await bootShell();
} catch (error) {
  const bootStatus = document.querySelector("#match-status");
  const bootDetail = document.querySelector("#match-detail");
  if (bootStatus) bootStatus.textContent = "NO SE PUDO INICIAR";
  if (bootDetail) bootDetail.textContent = error?.message || "Error al cargar la partida.";
  console.error("KIIZU game boot error:", error);
}

const status = document.querySelector("#match-status");
const detail = document.querySelector("#match-detail");
const playersEl = document.querySelector("#players");
const scoreEl = document.querySelector("#game-score");
const gameName = document.querySelector("#game-name");
const healthEl = document.querySelector("#health");
const coinsEl = document.querySelector("#world-coins");
const objectiveEl = document.querySelector("#objective");
const canvas = document.querySelector("#game-canvas");
const playerList = document.querySelector("#room-players");
const chatList = document.querySelector("#room-chat-list");
const chatInput = document.querySelector("#room-chat-input");
const chatForm = document.querySelector("#room-chat-form");

let match = null, channel = null, game = null, engine = null, appearance = null;
let score = 0, coins = 0, health = 100;
let running = false, finished = false, countdownRunning = false, resultsShown = false;
let roundTimer = null, positionTimer = null, roomRefreshTimer = null, roomStateTimer = null;

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
  const { data: equippedRows } = await supabase.from("equipped_clothing").select("slot,clothing_items(type,thumbnail,design_data)").eq("user_id", state.session.user.id);
  const images = (equippedRows || []).map(r => ({ slot: r.slot, type: r.clothing_items?.type || r.slot, src: r.clothing_items?.thumbnail || r.clothing_items?.design_data?.thumbnail || r.clothing_items?.design_data?.layers?.find(l => l?.data)?.data })).filter(x => x.src);
  appearance = { images };
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
  await openRoomPicker();
}
async function openRoomPicker() {
  const picker = document.querySelector("#room-picker");
  const list = document.querySelector("#rooms-list");
  if (!picker || !list) return;
  picker.hidden = false;
  await refreshRooms();
  clearInterval(roomRefreshTimer);
  roomRefreshTimer = setInterval(() => {
    if (!picker.hidden) refreshRooms();
  }, 2500);
  document.querySelector("#refresh-rooms")?.addEventListener("click", refreshRooms, { once: false });
  document.querySelector("#create-room")?.addEventListener("click", async () => {
    const btn = document.querySelector("#create-room");
    btn.disabled = true;
    try {
      const { data, error } = await supabase.rpc("create_match_room", { p_game_slug: gameSlug });
      if (error) throw error;
      if (!data?.id) throw new Error("La sala no se creó correctamente.");
      clearInterval(roomRefreshTimer);
      picker.hidden = true;
      await enterMatch(data);
    } catch (e) {
      console.error("create_match_room:", e);
      toast(e.message || "No se pudo crear la sala.", "error");
    } finally { btn.disabled = false; }
  }, { once: true });
}
async function refreshRooms() {
  const list = document.querySelector("#rooms-list");
  if (!list) return;
  list.innerHTML = '<div class="room-empty">Buscando salas...</div>';
  if (!gameSlug) {
    list.innerHTML = '<div class="room-empty">No se encontró el juego.</div>';
    return;
  }
  const { data, error } = await supabase.rpc("get_game_rooms", { p_game_slug: gameSlug });
  if (error) {
    console.error("get_game_rooms:", error);
    list.innerHTML = '<div class="room-empty">No se pudieron cargar las salas.<br><small>' + escapeHtml(error.message || "Error desconocido") + '</small></div>';
    return;
  }
  const rooms = Array.isArray(data) ? data : [];
  if (!rooms.length) {
    list.innerHTML = '<div class="room-empty"><strong>No hay salas abiertas.</strong><br><small>Las salas nuevas aparecerán automáticamente aquí.</small></div>';
    return;
  }
  list.innerHTML = rooms.map(r => '<div class="room-row"><div><strong>Sala <span class="room-code">'+escapeHtml(r.code)+'</span></strong><small>'+escapeHtml(r.host_username)+' · '+Number(r.player_count)+'/'+Number(r.max_players)+' jugadores</small></div><button class="button button--small" data-room-id="'+r.id+'">Entrar</button></div>').join("");
  list.querySelectorAll("[data-room-id]").forEach(btn => btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      const { error } = await supabase.rpc("join_match", { p_match_id: btn.dataset.roomId });
      if (error) throw error;
      const { data: roomState, error: stateError } = await supabase.rpc("get_match_state", { p_match_id: btn.dataset.roomId });
      if (stateError) throw stateError;
      const joinedMatch = roomState?.match;
      if (!joinedMatch?.id) throw new Error("La sala ya no está disponible. Actualiza la lista.");
      clearInterval(roomRefreshTimer);
      document.querySelector("#room-picker").hidden = true;
      await enterMatch(joinedMatch);
    } catch (e) { toast(e.message || "No se pudo entrar a la sala.", "error"); btn.disabled = false; }
  }));
}
async function enterMatch(data) {
  status.innerHTML = 'Esperando jugadores<span class="dots">...</span>';
  detail.textContent = "La partida comenzará cuando la sala tenga los jugadores necesarios.";
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
      engine.updateRemotePlayer(payload);
    })
    .on("broadcast", { event: "room_chat" }, ({ payload }) => addRoomChatMessage(payload))
    .subscribe(async value => {
      if (value !== "SUBSCRIBED") return;
      await channel.track({ user_id: state.session.user.id, username: state.profile.username });
      await syncMatchState();
    });

  if (match.status === "starting" || match.status === "playing") startCountdown();
  else await syncMatchState();
  clearInterval(roomStateTimer);
  roomStateTimer = setInterval(() => {
    if (!finished && match?.status === "waiting") syncMatchState().catch(() => {});
  }, 2000);
  updateStartButton();
}

function renderRoomPlayers(rows) {
  if (!playerList) return;
  playerList.innerHTML = rows.map(p => {
    const avatar = p.avatar_url ? `<img src="${escapeHtml(p.avatar_url)}" alt="">` : `<span>${escapeHtml((p.username || "J").slice(0,1).toUpperCase())}</span>`;
    return `<a class="room-player" href="public-profile.html?user=${encodeURIComponent(p.user_id)}">${avatar}<strong>${escapeHtml(p.username || "Jugador")}</strong></a>`;
  }).join("");
}

function addRoomChatMessage(message) {
  if (!chatList || !message?.body) return;
  const item = document.createElement("a");
  item.className = "room-chat-message";
  item.href = "public-profile.html?user=" + encodeURIComponent(message.user_id || "");
  item.innerHTML = `<strong>${escapeHtml(message.username || "Jugador")}</strong><span>${escapeHtml(message.body)}</span>`;
  chatList.appendChild(item);
  chatList.scrollTop = chatList.scrollHeight;
}

async function syncMatchState() {
  if (!match?.id) return;
  const { data, error } = await supabase.rpc("get_match_state", { p_match_id: match.id });
  if (error) throw error;
  if (data?.match) match = data.match;
  const rows = Array.isArray(data?.players) ? data.players : [];
  playersEl.textContent = String(rows.length);
  renderRoomPlayers(rows);

  if (match.status === "starting" || match.status === "playing") {
    if (!countdownRunning && !finished) startCountdown();
    return;
  }
  updateStartButton(rows.length);
}


function updateStartButton(playerCount) {
  const btn = document.querySelector("#start-match");
  if (!btn || !match) return;
  const count = Number(playerCount ?? playersEl?.textContent ?? 0);
  const isHost = match.host_id === state.session.user.id;
  const waiting = match.status === "waiting";
  btn.hidden = !(isHost && waiting);
  btn.disabled = !waiting;
  if (waiting) {
    btn.textContent = count > 1 ? "Iniciar partida" : "Iniciar partida";
  }
}

async function startMatchManually() {
  if (!match || match.host_id !== state.session.user.id || match.status !== "waiting") return;
  const btn = document.querySelector("#start-match");
  if (btn) btn.disabled = true;
  try {
    const { data, error } = await supabase.rpc("start_match", { p_match_id: match.id });
    if (error) throw error;
    match = data;
    startCountdown();
  } catch (error) {
    toast(error.message || "No se pudo iniciar la partida.", "error");
    updateStartButton();
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
  const built = game?.game_config?.version >= 2 ? buildWorldFromConfig(game.game_config) : buildWorld(worldType());
  const spawn = built.spawn || built.entities.find(e => e.type === "spawn") || { x:150, y:600 };
  const player = {
    user_id: state.session.user.id,
    username: state.profile.username || "Player",
    x: spawn.x, y: spawn.y, w: 34, h: 52, vx: 0, vy: 0,
    speed: 4.4, jump: 12, grounded: false, color: "#f0f2f5", appearance
  };

  engine = new Kiizu2D(canvas, {
    world: built.world,
    entities: built.entities,
    player,
    spawn,
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
      payload: { user_id: state.session.user.id, username: state.profile.username, avatar_url: state.profile.avatar_url || null, x: engine.player.x, y: engine.player.y, color: engine.player.color, appearance }
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
    const { data: reward, error: rewardError } = await supabase.rpc("complete_game_run", { p_match_id: match.id });
    if (rewardError) throw rewardError;
    status.textContent = "RESULTADO REGISTRADO";
    detail.textContent = match.status === "finished"
      ? "La partida terminó y tus recompensas fueron calculadas."
      : "Tu resultado quedó guardado. Tus recompensas ya están registradas.";
    showResults(reward);
    toast("Resultado guardado.", "success");
  } catch (error) {
    finished = false; running = true;
    status.textContent = "NO SE PUDO GUARDAR";
    detail.textContent = error.message || "Error al registrar el resultado.";
    toast(detail.textContent, "error");
    engine?.start();
  }
}

function showResults(reward) {
  if (resultsShown) return;
  resultsShown = true;
  const modal = document.querySelector("#results-modal");
  if (!modal) return;
  document.querySelector("#result-score").textContent = Number(reward?.score || 0).toLocaleString();
  document.querySelector("#result-coins").textContent = "+" + Number(reward?.coins_earned || 0).toLocaleString();
  document.querySelector("#result-xp").textContent = "+" + Number(reward?.total_xp_earned || 0).toLocaleString();
  document.querySelector("#results-summary").textContent =
    "Posición #" + Number(reward?.placement || 0) + " · Nivel " + Number(reward?.new_level || 1);
  const list = document.querySelector("#results-achievements");
  const unlocked = Array.isArray(reward?.achievements_unlocked) ? reward.achievements_unlocked : [];
  list.innerHTML = unlocked.length
    ? unlocked.map(a => '<article class="result-achievement"><span>' + (a.icon || "🏆") + '</span><div><strong>' + escapeHtml(a.name || "Logro") + '</strong><small>' + escapeHtml(a.description || "Logro desbloqueado") + '</small></div><b>+' + Number(a.xp_reward || 0) + ' XP</b></article>').join("")
    : '<div class="result-achievement result-achievement--empty"><span>✓</span><div><strong>Sin logros nuevos</strong><small>Completa otro juego para desbloquear más.</small></div></div>';
  modal.hidden = false;
  modal.style.display = "grid";
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
window.addEventListener("pagehide", () => {
  clearInterval(positionTimer);
  clearInterval(roomRefreshTimer);
  clearInterval(roomStateTimer);
  channel?.unsubscribe();
});

document.querySelector("#start-match")?.addEventListener("click", startMatchManually);
chatForm?.addEventListener("submit", e => {
  e.preventDefault();
  const body = chatInput?.value?.trim();
  if (!body || !channel) return;
  channel.send({ type:"broadcast", event:"room_chat", payload:{ user_id:state.session.user.id, username:state.profile.username, body:body.slice(0,300) } }).catch(() => {});
  if (chatInput) chatInput.value = "";
});

if (state) {
  try { await begin(); }
  catch (error) {
    status.textContent = "No se pudo crear la sala";
    detail.textContent = error.message || "Error de conexión.";
    toast(detail.textContent, "error");
  }
}
