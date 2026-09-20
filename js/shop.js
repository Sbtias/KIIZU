import { supabase } from "./app.js";
import { bootShell } from "./nav.js?v=20260920-0330";
import { toast, setBusy } from "./ui.js";

const state = await bootShell();
const isPremium = () => Boolean(window.__kiizuProfile?.is_premium);
const grid = document.querySelector("#shop-grid");
const gamesGrid = document.querySelector("#market-games");
const filters = [...document.querySelectorAll(".filter-row .chip")];
const detailModal = document.querySelector("#clothing-detail");
const detailPreview = document.querySelector("#clothing-detail-preview");
const detailType = document.querySelector("#clothing-detail-type");
const detailCreator = document.querySelector("#clothing-detail-creator");
const detailTitle = document.querySelector("#clothing-detail-title");
const detailDescription = document.querySelector("#clothing-detail-description");
const detailPrice = document.querySelector("#clothing-detail-price");
const detailLikes = document.querySelector("#clothing-detail-likes");
const detailCommentCount = document.querySelector("#clothing-detail-comment-count");
const detailActions = document.querySelector("#clothing-detail-actions");
const commentsList = document.querySelector("#clothing-comments-list");
const commentForm = document.querySelector("#clothing-comment-form");
const commentInput = document.querySelector("#clothing-comment-input");
const commentStatus = document.querySelector("#clothing-comments-status");
let filter = "all";
let catalog = { official: [], clothing: [] };
let activeClothing = null;
let commentCache = new Map();

filters.forEach(chip => chip.addEventListener("click", () => {
  filters.forEach(c => c.classList.remove("active"));
  chip.classList.add("active");
  filter = normalizeFilter(chip.textContent);
  render();
  loadGames();
}));

function normalizeFilter(label) {
  const value = label.trim().toLowerCase();
  if (value === "ropa") return "clothing";
  if (value === "accesorios") return "accessories";
  if (value === "efectos") return "effects";
  if (value === "emotes") return "emotes";
  return "all";
}

async function load() {
  if (!state || !grid) return;

  grid.innerHTML = '<div class="empty-state"><h3>Cargando marketplace...</h3><p>Estamos buscando artículos disponibles.</p></div>';

  const [{ data: items, error: itemError }, { data: clothing, error: clothingError }, { data: inventory, error: inventoryError }, { data: comments, error: commentsError }] = await Promise.all([
    supabase.from("items").select("id,slug,name,category,price,metadata,created_at").order("created_at", { ascending: false }),
    supabase.from("clothing_items")
      .select("id,creator_id,name,description,type,price,design_data,thumbnail,created_at,profiles!clothing_items_creator_id_fkey(username)")
      .eq("is_published", true)
      .order("created_at", { ascending: false }),
    supabase.from("inventory").select("item_id").eq("user_id", state.session.user.id),
    supabase.from("clothing_comments").select("id,clothing_id,user_id,body,created_at,profiles!clothing_comments_user_id_fkey(username,avatar_url)").order("created_at", { ascending: false })
  ]);

  if (clothingError) throw clothingError;
  // El catálogo oficial puede estar vacío o tener RLS sin afectar las creaciones de la comunidad.
  // La sesión autenticada debe poder leer el inventario propio para marcar lo comprado.
  if (inventoryError) throw inventoryError;
  if (commentsError) console.warn("No se pudieron cargar los comentarios:", commentsError);
  if (itemError) console.warn("No se pudo cargar el catálogo oficial:", itemError);

  commentCache = new Map();
  if (!commentsError) {
    for (const row of comments || []) {
      if (!commentCache.has(row.clothing_id)) commentCache.set(row.clothing_id, []);
      commentCache.get(row.clothing_id).push(row);
    }
  }

  const clothingIds = (clothing || []).map(c => c.id);
  const likes = new Map();
  const purchasedClothing = new Set();

  if (clothingIds.length) {
    const [{ data: allLikes, error: likesError }, { data: mineLikes, error: mineLikesError }, { data: myClothing, error: myClothingError }] = await Promise.all([
      supabase.from("clothing_likes").select("clothing_id"),
      supabase.from("clothing_likes").select("clothing_id").eq("user_id", state.session.user.id),
      supabase.from("clothing_purchases").select("clothing_id").eq("buyer_id", state.session.user.id)
    ]);
    if (likesError) throw likesError;
    if (mineLikesError) throw mineLikesError;
    if (myClothingError) console.warn("No se pudieron marcar las compras de ropa:", myClothingError);

    for (const row of allLikes || []) {
      const current = likes.get(row.clothing_id) || { count: 0, mine: false };
      current.count++;
      likes.set(row.clothing_id, current);
    }
    for (const row of mineLikes || []) {
      const current = likes.get(row.clothing_id) || { count: 0, mine: false };
      current.mine = true;
      likes.set(row.clothing_id, current);
    }
    for (const row of myClothing || []) purchasedClothing.add(row.clothing_id);
  }

  catalog = {
    official: (items || []).map(item => ({
      ...item,
      owned: (inventory || []).some(row => row.item_id === item.id)
    })),
    clothing: (clothing || []).map(item => ({
      ...item,
      like: likes.get(item.id) || { count: 0, mine: false },
      commentCount: (commentCache.get(item.id) || []).length,
      purchased: purchasedClothing.has(item.id)
    }))
  };

  render();
}

async function loadGames(){if(!gamesGrid)return;const{data,error}=await supabase.from("games").select("slug,name,description,min_players,max_players,thumbnail_url,profiles!games_creator_id_fkey(username)").eq("is_published",true).order("created_at",{ascending:false});if(error){gamesGrid.innerHTML='<div class="empty-state"><h3>No se pudieron cargar los juegos.</h3></div>';return;}gamesGrid.innerHTML=(data||[]).map(x=>'<article class="discover-card">'+(x.thumbnail_url?'<img src="'+escapeHtml(x.thumbnail_url)+'" alt="">':'<div class="discover-art">KIIZU</div>')+'<div class="discover-card-body"><span class="eyebrow">por '+escapeHtml(x.profiles?.username||"Creador")+'</span><h3>'+escapeHtml(x.name)+'</h3><p>'+escapeHtml(x.description||"Sin descripción")+'</p><small>'+x.min_players+'–'+x.max_players+' jugadores</small><a class="button button--small" href="game.html?game='+encodeURIComponent(x.slug)+'">Jugar</a></div></article>').join("")||'<div class="empty-state"><h3>No hay juegos publicados todavía.</h3></div>';}

function render() {
  if (!grid) return;

  const official = catalog.official.filter(item => filter === "all" || filter === normalizeCategory(item.category));
  const clothing = catalog.clothing.filter(item => filter === "all" || filter === "clothing" || filter === normalizeCategory(item.type));

  grid.innerHTML = "";

  if (!official.length && !clothing.length) {
    grid.innerHTML = '<div class="empty-state"><h3>No hay artículos en esta categoría</h3><p>Cuando haya creaciones publicadas, aparecerán aquí.</p></div>';
    return;
  }

  for (const item of official) grid.appendChild(officialCard(item));
  for (const item of clothing) grid.appendChild(clothingCard(item));
}

function officialCard(item) {
  const card = document.createElement("article");
  card.className = "item-card";
  const owned = item.owned;

  card.innerHTML =
    '<div class="item-art">✦</div>' +
    '<div><span class="eyebrow">' + escapeHtml(item.category) + '</span>' +
    '<h3>' + escapeHtml(item.name) + '</h3>' +
    '<p>' + priceMarkup(item.price, false) + '</p></div>' +
    '<button class="button button--small buy-btn" ' + (owned ? "disabled" : "") + '>' +
    (owned ? "En inventario" : "Comprar") + '</button>';

  const button = card.querySelector(".buy-btn");
  if (owned) return card;

  button.addEventListener("click", async () => {
    setBusy(button, true, "Comprando...");
    try {
      const { error } = await supabase.rpc("purchase_item", { p_item_id: item.id });
      if (error) throw error;
      item.owned = true;
      toast(item.name + " añadido al inventario.", "success");
      render();
    } catch (error) {
      toast(readableError(error), "error");
      setBusy(button, false);
    }
  });

  return card;
}

function clothingCard(item) {
  const card = document.createElement("article");
  card.className = "item-card clothing-card";
  const mine = item.creator_id === state.session.user.id;
  const like = item.like || { count: 0, mine: false };

  card.innerHTML =
    '<div class="item-art clothing-preview"></div>' +
    '<div><span class="eyebrow">' + escapeHtml(item.type) + ' · por ' + escapeHtml(item.profiles?.username || "Usuario") + '</span>' +
    '<h3>' + escapeHtml(item.name) + '</h3>' +
    '<p>' + priceMarkup(item.price, true) + ' · <span class="like-count">' + like.count + '</span> likes</p></div>' +
    '<div class="tool-row">' +
      '<button class="button button--small detail-btn" type="button">Ver más</button>' +
      '<button class="button button--small like-btn" type="button" aria-label="Me gusta">' + (like.mine ? "♥" : "♡") + '</button>' +
      '<button class="button button--small buy-btn ' + (item.purchased ? "is-purchased" : "") + '" type="button" ' + (mine || item.purchased ? "disabled" : "") + '>' + (mine ? "Tu creación" : item.purchased ? "YA COMPRADO" : "Comprar") + '</button>' +
    '</div>';

  const preview = card.querySelector(".clothing-preview");
  const image = item.thumbnail || item.design_data?.layers?.find(layer => layer?.data)?.data;
  if (image) preview.style.backgroundImage = "url(" + image + ")";

  const detailButton = card.querySelector(".detail-btn");
  if (detailButton) detailButton.addEventListener("click", () => openClothingDetail(item));
  card.querySelector(".like-btn").addEventListener("click", async event => {
    const button = event.currentTarget;
    setBusy(button, true, "...");
    try {
      const { data, error } = await supabase.rpc("toggle_clothing_like", { p_clothing_id: item.id });
      if (error) throw error;
      like.mine = data;
      like.count = Math.max(0, like.count + (data ? 1 : -1));
      button.textContent = data ? "♥" : "♡";
      card.querySelector(".like-count").textContent = like.count;
    } catch (error) {
      toast(readableError(error), "error");
    } finally {
      setBusy(button, false);
    }
  });

  const buyButton = card.querySelector(".buy-btn");
  if (!mine) {
    buyButton.addEventListener("click", async () => {
      setBusy(buyButton, true, "Comprando...");
      try {
        const { error } = await supabase.rpc("purchase_clothing", { p_clothing_id: item.id });
        if (error) throw error;
        toast(item.name + " añadido a tu inventario.", "success");
        await load();
      } catch (error) {
        toast(readableError(error), "error");
        setBusy(buyButton, false);
      }
    });
  }

  return card;
}

function openClothingDetail(item) {
  if (!detailModal) return;
  activeClothing = item;
  const like = item.like || { count: 0, mine: false };
  if (detailType) detailType.textContent = String(item.type || "ropa").toUpperCase();
  if (detailCreator) detailCreator.textContent = "por " + (item.profiles?.username || "Usuario");
  if (detailTitle) detailTitle.textContent = item.name || "Creación";
  if (detailDescription) detailDescription.textContent = item.description || "Esta creación todavía no tiene una descripción.";
  if (detailPrice) detailPrice.innerHTML = priceMarkup(item.price, false);
  if (detailLikes) detailLikes.textContent = Number(like.count || 0);
  if (detailCommentCount) detailCommentCount.textContent = String((commentCache.get(item.id) || []).length);
  if (detailPreview) {
    detailPreview.style.backgroundImage = "";
    const image = item.thumbnail || item.design_data?.layers?.find(layer => layer?.data)?.data;
    detailPreview.innerHTML = image ? "" : '<span>KIIZU</span>';
    if (image) detailPreview.style.backgroundImage = "url(" + image + ")";
  }
  if (detailActions) {
    const mine = item.creator_id === state.session.user.id;
    detailActions.innerHTML =
      '<button class="button like-detail-btn" type="button">' + (like.mine ? "♥ Me gusta" : "♡ Me gusta") + '</button>' +
      '<button class="button button--ghost buy-detail-btn" type="button"' + (mine ? " disabled" : "") + '>' + (mine ? "Tu creación" : "Comprar") + '</button>';
    detailActions.querySelector(".like-detail-btn")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      setBusy(button, true, "...");
      try {
        const { data, error } = await supabase.rpc("toggle_clothing_like", { p_clothing_id: item.id });
        if (error) throw error;
        like.mine = data;
        like.count = Math.max(0, like.count + (data ? 1 : -1));
        if (detailLikes) detailLikes.textContent = like.count;
        button.textContent = data ? "♥ Me gusta" : "♡ Me gusta";
        const cardLike = [...grid.querySelectorAll(".clothing-card")].find(card => card.querySelector(".detail-btn") && card.querySelector("h3")?.textContent === item.name);
        if (cardLike) {
          cardLike.querySelector(".like-btn").textContent = data ? "♥" : "♡";
          cardLike.querySelector(".like-count").textContent = like.count;
        }
      } catch (error) {
        toast(readableError(error), "error");
      } finally {
        setBusy(button, false);
      }
    });
    detailActions.querySelector(".buy-detail-btn")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      setBusy(button, true, "Comprando...");
      try {
        const { error } = await supabase.rpc("purchase_clothing", { p_clothing_id: item.id });
        if (error) throw error;
        toast(item.name + " añadido a tu inventario.", "success");
        closeClothingDetail();
        await load();
      } catch (error) {
        toast(readableError(error), "error");
        setBusy(button, false);
      }
    });
  }
  renderComments(item.id);
  detailModal.hidden = false;
  document.body.classList.add("marketplace-detail-open");
  requestAnimationFrame(() => detailModal.classList.add("is-open"));
}

function closeClothingDetail() {
  if (!detailModal) return;
  detailModal.classList.remove("is-open");
  document.body.classList.remove("marketplace-detail-open");
  window.setTimeout(() => {
    if (!detailModal.classList.contains("is-open")) detailModal.hidden = true;
  }, 180);
  activeClothing = null;
}

function renderComments(clothingId) {
  if (!commentsList) return;
  const comments = commentCache.get(clothingId) || [];
  if (commentStatus) commentStatus.textContent = comments.length ? comments.length + (comments.length === 1 ? " comentario" : " comentarios") : "";
  if (!comments.length) {
    commentsList.innerHTML = '<div class="clothing-comments-empty"><strong>Sé el primero en comentar.</strong><span>Comparte qué te parece esta creación.</span></div>';
    return;
  }
  commentsList.innerHTML = comments.map(comment => {
    const username = comment.profiles?.username || "Usuario";
    const name = escapeHtml(username);
    const profileId = encodeURIComponent(comment.user_id || "");
    const avatarUrl = comment.profiles?.avatar_url || "";
    const body = escapeHtml(comment.body);
    const date = formatCommentDate(comment.created_at);
    const mine = comment.user_id === state.session.user.id;
    return '<article class="clothing-comment">' +
      '<div class="clothing-comment-avatar">' + (avatarUrl ? '<img src="' + escapeHtml(avatarUrl) + '" alt="Foto de perfil de ' + name + '">' : escapeHtml(username.slice(0,1).toUpperCase())) + '</div>' +
      '<div class="clothing-comment-body"><div class="clothing-comment-author"><div><strong>' + name + '</strong><a href="public-profile.html?user=' + profileId + '" class="comment-profile-link">Ver perfil</a></div><time>' + date + '</time></div><p>' + body + '</p>' +
      (mine ? '<button class="comment-delete" type="button" data-comment-id="' + escapeHtml(comment.id) + '">Eliminar</button>' : '') +
      '</div></article>';
  }).join("");
}

function formatCommentDate(value) {
  try {
    return new Intl.DateTimeFormat("es-PR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return "";
  }
}

commentForm?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!activeClothing || !commentInput) return;
  const body = commentInput.value.trim();
  if (!body) return;
  const submit = commentForm.querySelector("button[type=submit]");
  setBusy(submit, true, "Publicando...");
  try {
    const { data, error } = await supabase.from("clothing_comments").insert({
      clothing_id: activeClothing.id,
      user_id: state.session.user.id,
      body
    }).select("id,clothing_id,user_id,body,created_at,profiles!clothing_comments_user_id_fkey(username,avatar_url)").single();
    if (error) throw error;
    if (!commentCache.has(activeClothing.id)) commentCache.set(activeClothing.id, []);
    commentCache.get(activeClothing.id).unshift(data);
    activeClothing.commentCount = commentCache.get(activeClothing.id).length;
    if (detailCommentCount) detailCommentCount.textContent = String(activeClothing.commentCount);
    commentInput.value = "";
    renderComments(activeClothing.id);
    toast("Comentario publicado.", "success");
  } catch (error) {
    toast(readableError(error), "error");
  } finally {
    setBusy(submit, false);
  }
});

commentsList?.addEventListener("click", async event => {
  const button = event.target.closest("[data-comment-id]");
  if (!button || !activeClothing) return;
  const id = button.dataset.commentId;
  setBusy(button, true, "...");
  try {
    const { error } = await supabase.from("clothing_comments").delete().eq("id", id).eq("user_id", state.session.user.id);
    if (error) throw error;
    commentCache.set(activeClothing.id, (commentCache.get(activeClothing.id) || []).filter(comment => comment.id !== id));
    activeClothing.commentCount = commentCache.get(activeClothing.id).length;
    if (detailCommentCount) detailCommentCount.textContent = String(activeClothing.commentCount);
    renderComments(activeClothing.id);
  } catch (error) {
    toast(readableError(error), "error");
  }
});

detailModal?.addEventListener("click", event => {
  if (event.target.closest("[data-detail-close]")) closeClothingDetail();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && detailModal && !detailModal.hidden) closeClothingDetail();
});

function priceMarkup(value, compact) {
  const base = Number(value || 0);
  if (!isPremium() || base <= 0) return base.toLocaleString() + " 🪙";
  const discounted = Math.floor(base * 0.9);
  return '<span class="price-original">' + base.toLocaleString() + ' 🪙</span> <strong class="premium-discount-price">' + discounted.toLocaleString() + ' 🪙</strong> <span class="premium-discount-badge">-10% PREMIUM</span>';
}

function normalizeCategory(value) {
  const v = String(value || "").trim().toLowerCase();
  if (["camiseta", "camisa", "pantalon", "sudadera", "gorra"].includes(v)) return "clothing";
  if (["accesorio", "accessory", "accessories"].includes(v)) return "accessories";
  if (["efecto", "effect", "effects"].includes(v)) return "effects";
  if (["emote", "emotes"].includes(v)) return "emotes";
  return v;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function readableError(error) {
  const message = error?.message || "No se pudo completar la operación.";
  if (message.includes("INSUFFICIENT_COINS")) return "No tienes suficientes Coins.";
  if (message.includes("ITEM_ALREADY_OWNED")) return "Ya tienes este objeto.";
  if (message.includes("CLOTHING_ALREADY_OWNED")) return "Ya tienes esta creación.";
  if (message.includes("CANNOT_BUY_OWN_ITEM")) return "No puedes comprar tu propia creación.";
  if (message.includes("AUTH_REQUIRED")) return "Tu sesión ha expirado. Inicia sesión otra vez.";
  return message;
}

load().catch(error => {
  if (grid) grid.innerHTML = '<div class="empty-state"><h3>No se pudo cargar el marketplace</h3><p>Revisa la conexión y vuelve a intentarlo.</p></div>';
  toast(readableError(error), "error");
});