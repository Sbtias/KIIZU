import { supabase } from "./app.js";
import { bootShell } from "./nav.js?v=20260918-1335";
const state = await bootShell();
const id = new URLSearchParams(location.search).get("user");
const photo = document.querySelector("#public-photo");
const title = document.querySelector("#public-username");
const achievementsBox = document.querySelector("#public-achievements");

if (!id) {
  title.textContent = "Perfil no encontrado";
} else {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,avatar_url,level,xp,games_played,wins,creator_points")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    title.textContent = "Perfil no encontrado";
  } else {
    document.title = (data.username || "Jugador") + " · KIIZU";
    title.textContent = data.username || "Jugador";
    document.querySelector("#public-level").textContent = "Nivel " + (data.level ?? 1);
    document.querySelector("#public-games").textContent = data.games_played ?? 0;
    document.querySelector("#public-wins").textContent = data.wins ?? 0;
    document.querySelector("#public-xp").textContent = Number(data.xp ?? 0).toLocaleString();
    document.querySelector("#public-points").textContent = Number(data.creator_points ?? 0).toLocaleString();
    photo.innerHTML = data.avatar_url
      ? '<img src="' + safe(data.avatar_url) + '" alt="Foto de perfil">'
      : safe((data.username || "K").slice(0, 1).toUpperCase());

    try {
      const { data: achievements, error: achievementsError } = await supabase
        .from("user_achievements")
        .select("unlocked_at,achievements(name,description,icon,xp_reward)")
        .eq("user_id", id)
        .order("unlocked_at", { ascending: false });
      if (achievementsError) throw achievementsError;

      achievementsBox.innerHTML = achievements?.length
        ? achievements.map(item => '<article class="achievement"><span>' +
            safe(item.achievements?.icon || "🏆") + '</span><div><b>' +
            safe(item.achievements?.name || "Logro") + '</b><small>' +
            safe(item.achievements?.description || "") + '</small></div></article>').join("")
        : '<div class="empty-state"><h3>Aún no tiene logros.</h3><p>Cuando desbloquee alguno aparecerá aquí.</p></div>';
    } catch {
      achievementsBox.innerHTML = '<div class="empty-state"><h3>No se pudieron cargar los logros.</h3></div>';
    }
  }
}

function safe(v) {
  return String(v ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
}