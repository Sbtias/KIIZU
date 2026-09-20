import { bootShell } from "./nav.js?v=20260919-1426";
import { supabase } from "./app.js";
import { toast, setBusy } from "./ui.js";

const box = document.querySelector("#friends");
const esc = v => String(v ?? "").replace(/[&<>"]/g, m => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
}[m]));

let state = null;

function confirmInApp(title, message, dangerText = "Eliminar") {
  return new Promise(resolve => {
    const wrap = document.createElement("div");
    wrap.className = "kiizu-confirm-backdrop";
    wrap.innerHTML = '<div class="kiizu-confirm" role="dialog" aria-modal="true">' +
      '<div class="kiizu-confirm-icon">!</div>' +
      '<h3>' + esc(title) + '</h3>' +
      '<p>' + esc(message) + '</p>' +
      '<div class="kiizu-confirm-actions"><button type="button" class="kiizu-confirm-cancel">Cancelar</button><button type="button" class="kiizu-confirm-danger">' + esc(dangerText) + '</button></div></div>';
    document.body.appendChild(wrap);
    const finish = value => { wrap.remove(); resolve(value); };
    wrap.querySelector(".kiizu-confirm-cancel").onclick = () => finish(false);
    wrap.querySelector(".kiizu-confirm-danger").onclick = () => finish(true);
    wrap.addEventListener("click", e => { if (e.target === wrap) finish(false); });
  });
}

function closeFriendMenus() {
  document.querySelectorAll(".friend-menu").forEach(menu => { menu.hidden = true; });
  document.querySelectorAll(".friend-more").forEach(button => {
    button.setAttribute("aria-expanded", "false");
  });
}

async function load() {
  if (!state?.session?.user?.id) return;

  const userId = state.session.user.id;
  const { data, error } = await supabase
    .from("friendships")
    .select("requester_id,addressee_id,status,requester:profiles!friendships_requester_id_fkey(id,username,avatar_url,status,last_seen),addressee:profiles!friendships_addressee_id_fkey(id,username,avatar_url,status,last_seen)")
    .or("requester_id.eq." + userId + ",addressee_id.eq." + userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = data || [];
  if (!rows.length) {
    box.innerHTML = '<div class="empty-state"><h3>Aún no tienes amigos 👋</h3><p>Busca un username y manda una solicitud.</p></div>';
    return;
  }

  box.innerHTML = rows.map(r => {
    const mine = r.requester_id === userId;
    const u = mine ? r.addressee : r.requester;
    const pending = r.status === "pending";
    const avatar = u?.avatar_url
      ? '<img src="' + esc(u.avatar_url) + '" alt="Foto de perfil">'
      : esc((u?.username || "U").slice(0, 1).toUpperCase());

    let menu = "";
    if (r.status === "accepted") {
      menu =
        '<a href="public-profile.html?user=' + encodeURIComponent(u?.id || "") + '">Ver perfil</a>' +
        '<a href="chat.html">Chatear</a>' +
        '<button class="remove-friend">Eliminar amigo</button>';
    } else if (mine && pending) {
      menu = '<button class="cancel-request">Quitar solicitud de amistad</button>';
    }

    return '<article class="discover-card">' +
      '<div class="friend-profile-head">' +
        '<div class="friend-avatar">' + avatar + '</div>' +
        '<div><span class="eyebrow">' +
          (r.status === "accepted" ? "AMIGOS" : (mine ? "SOLICITUD ENVIADA" : "SOLICITUD RECIBIDA")) +
        '</span><h3>' + esc(u?.username || "Usuario") + '</h3></div>' +
        '<div class="friend-menu-wrap">' +
          '<button class="friend-more" type="button" aria-label="Más opciones" aria-expanded="false"><span aria-hidden="true">⋮</span></button>' +
          '<div class="friend-menu" hidden>' + menu + '</div>' +
        '</div>' +
      '</div>' +
      '<p>' +
        ((u?.status === "online" && u?.last_seen && Date.now() - new Date(u.last_seen).getTime() < 90000)
          ? "En línea 🟢" : "Desconectado") +
      '</p>' +
      (pending && !mine
        ? '<div class="tool-row"><button class="button button--small accept">Aceptar</button><button class="button button--small button--ghost reject">Rechazar</button></div>'
        : "") +
    '</article>';
  }).join("");

  rows.forEach((r, i) => {
    const card = box.children[i];
    if (!card) return;

    if (r.status === "pending" && r.addressee_id === userId) {
      card.querySelector(".accept")?.addEventListener("click", () => respond(r.requester_id, true));
      card.querySelector(".reject")?.addEventListener("click", () => respond(r.requester_id, false));
    }

    if (r.status === "accepted") {
      card.querySelector(".remove-friend")?.addEventListener("click", e => removeFriend(r, e.currentTarget));
    }

    if (r.status === "pending" && r.requester_id === userId) {
      card.querySelector(".cancel-request")?.addEventListener("click", e => cancelRequest(r, e.currentTarget));
    }

    const more = card.querySelector(".friend-more");
    const menu = card.querySelector(".friend-menu");

    more?.addEventListener("click", event => {
      event.stopPropagation();
      const wasOpen = !menu.hidden;
      closeFriendMenus();
      menu.hidden = wasOpen;
      more.setAttribute("aria-expanded", String(!wasOpen));
    });

    menu?.addEventListener("click", event => event.stopPropagation());
  });
}

async function respond(id, accept) {
  try {
    const { error } = await supabase.rpc("respond_friend_request", {
      p_requester_id: id,
      p_accept: accept
    });
    if (error) throw error;
    toast(accept ? "Solicitud aceptada 🎉" : "Solicitud rechazada.", "success");
    await load();
  } catch (e) {
    toast(e.message || "No se pudo responder.", "error");
  }
}

async function cancelRequest(friendship, btn) {
  if (!await confirmInApp("Quitar solicitud", "La solicitud se eliminará y podrás enviar otra más adelante.", "Quitar solicitud")) return;
  setBusy(btn, true, "Quitando...");
  try {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("requester_id", friendship.requester_id)
      .eq("addressee_id", friendship.addressee_id);
    if (error) throw error;
    toast("Solicitud eliminada.", "success");
    await load();
  } catch (e) {
    toast(e.message || "No se pudo quitar la solicitud.", "error");
    setBusy(btn, false);
  }
}

async function removeFriend(friendship, btn) {
  if (!await confirmInApp("Eliminar amigo", "Esta persona dejará de aparecer en tu lista de amigos.", "Eliminar amigo")) return;
  setBusy(btn, true, "Quitando...");
  try {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("requester_id", friendship.requester_id)
      .eq("addressee_id", friendship.addressee_id);
    if (error) throw error;
    toast("Amigo eliminado de tu lista.", "success");
    await load();
  } catch (e) {
    toast(e.message || "No se pudo quitar.", "error");
    setBusy(btn, false);
  }
}

async function init() {
  try {
    state = await bootShell();
    if (!state) return;

    document.querySelector("#add").onclick = async e => {
      const input = document.querySelector("#username");
      setBusy(e.currentTarget, true, "Enviando...");
      try {
        const { error } = await supabase.rpc("send_friend_request", {
          p_username: input.value.trim()
        });
        if (error) throw error;
        toast("Solicitud enviada ✨", "success");
        input.value = "";
        await load();
      } catch (err) {
        toast(err.message || "No se pudo enviar.", "error");
      } finally {
        setBusy(e.currentTarget, false);
      }
    };

    await load();
  } catch (e) {
    console.error("KIIZU friends:", e);
    box.innerHTML = '<div class="empty-state"><h3>No se pudo cargar tu red.</h3><p>' +
      esc(e.message || "Error inesperado.") + '</p></div>';
    toast(e.message || "No se pudo cargar tu red.", "error");
  }
}

document.addEventListener("click", closeFriendMenus);
init();
