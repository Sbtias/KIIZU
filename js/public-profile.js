import { supabase } from "./app.js";
import { bootShell } from "./nav.js?v=20260918-1335";
const state = await bootShell();
const id = new URLSearchParams(location.search).get("user");
const photo = document.querySelector("#public-photo");
if (!id) { document.querySelector("#public-username").textContent="Perfil no encontrado"; }
else {
  const { data, error } = await supabase.from("profiles").select("id,username,avatar_url,level,xp,games_played,wins,creator_points").eq("id",id).maybeSingle();
  if (error || !data) document.querySelector("#public-username").textContent="Perfil no encontrado";
  else {
    document.title = data.username + " · KIIZU";
    document.querySelector("#public-username").textContent=data.username || "Jugador";
    document.querySelector("#public-level").textContent="Nivel " + (data.level ?? 1);
    document.querySelector("#public-games").textContent=data.games_played ?? 0;
    document.querySelector("#public-wins").textContent=data.wins ?? 0;
    document.querySelector("#public-xp").textContent=Number(data.xp ?? 0).toLocaleString();
    document.querySelector("#public-points").textContent=Number(data.creator_points ?? 0).toLocaleString();
    photo.innerHTML=data.avatar_url ? '<img src="'+safe(data.avatar_url)+'" alt="Foto de perfil">' : safe((data.username||"K").slice(0,1).toUpperCase());
  }
}
function safe(v){return String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}