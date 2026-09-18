import { supabase } from "./app.js";
import { bootShell } from "./nav.js?v=20260918-1335";
import { toast } from "./ui.js";

export async function getProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export async function ensureProfile(user, username = "") {
  if (!supabase || !user) return null;
  const fallback = username || user.user_metadata?.username || user.email?.split("@")[0] || "Player";
  const { data, error } = await supabase.from("profiles")
    .upsert({ id: user.id, username: fallback }, { onConflict: "id", ignoreDuplicates: true })
    .select().single();
  if (error && error.code !== "23505") throw error;
  return data;
}

const state = await bootShell();

if (state) {
  const profile = state.profile;
  const photo = document.querySelector("#profile-photo");
  const status = document.querySelector("#photo-status");

  photo.innerHTML = profile.avatar_url
    ? '<img class="profile-photo" src="' + safe(profile.avatar_url) + '" alt="Foto de perfil">'
    : safe((profile.username || "K").slice(0, 1).toUpperCase());

  document.querySelector("#level").textContent = profile.level ?? 1;
  document.querySelector("#xp").textContent = (profile.xp ?? 0).toLocaleString();
  document.querySelector("#wins").textContent = profile.wins ?? 0;
  document.querySelector("#losses").textContent = profile.losses ?? 0;
  document.querySelector("#games").textContent = profile.games_played ?? 0;
  document.querySelector("#coins").textContent = Number(profile.coins ?? 0).toLocaleString();
  document.querySelector("#xpbar").style.width = Math.min(100, (profile.xp ?? 0) % 100) + "%";

  document.querySelector("#avatar-file").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      status.textContent = "Usa PNG, JPG o WebP.";
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      status.textContent = "La imagen debe pesar menos de 3 MB.";
      return;
    }

    status.textContent = "Subiendo...";
    try {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = state.session.user.id + "/avatar." + ext;

      const { error: uploadError } = await supabase.storage.from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = publicData.publicUrl + "?v=" + Date.now();

      const { error: updateError } = await supabase.from("profiles")
        .update({ avatar_url: url }).eq("id", state.session.user.id);
      if (updateError) throw updateError;

      photo.innerHTML = '<img class="profile-photo" src="' + safe(url) + '" alt="Foto de perfil">';
      status.textContent = "Foto actualizada.";
    } catch (error) {
      status.textContent = "No se pudo subir la foto.";
      toast(error.message || "Error al subir la foto.", "error");
    }
  });

  try {
    const { data, error } = await supabase.from("user_achievements")
      .select("unlocked_at,achievements(name,description,icon,xp_reward)")
      .eq("user_id", state.session.user.id).order("unlocked_at", { ascending: false });
    if (error) throw error;

    const box = document.querySelector("#achievements");
    box.innerHTML = data?.length
      ? data.map(item =>
          '<article class="achievement"><span>' + safe(item.achievements.icon) +
          '</span><div><b>' + safe(item.achievements.name) + '</b><small>' +
          safe(item.achievements.description) + '</small></div></article>'
        ).join("")
      : '<div class="empty-state"><h3>Aún no tienes logros.</h3><p>Cuando desbloquees alguno aparecerá aquí.</p></div>';
  } catch {
    toast("No se pudieron cargar los logros.", "error");
  }
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[char]));
}
