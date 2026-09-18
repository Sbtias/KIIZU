import { supabase } from "./app.js";
import { bootShell } from "./nav.js";
import { toast, setBusy } from "./ui.js";

const state = await bootShell();
const grid = document.querySelector("#shop-grid");
const filters = [...document.querySelectorAll(".filter-row .chip")];
let filter = "all";
let catalog = { official: [], clothing: [] };

filters.forEach(chip => chip.addEventListener("click", () => {
  filters.forEach(c => c.classList.remove("active"));
  chip.classList.add("active");
  filter = normalizeFilter(chip.textContent);
  render();
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

  const [{ data: items, error: itemError }, { data: clothing, error: clothingError }, { data: inventory, error: inventoryError }] = await Promise.all([
    supabase.from("items").select("id,slug,name,category,price,metadata,created_at").order("created_at", { ascending: false }),
    supabase.from("clothing_items")
      .select("id,creator_id,name,description,type,price,design_data,thumbnail,created_at,profiles(username)")
      .eq("is_published", true)
      .order("created_at", { ascending: false }),
    supabase.from("inventory").select("item_id").eq("user_id", state.session.user.id)
  ]);

  if (itemError) throw itemError;
  if (clothingError) throw clothingError;
  if (inventoryError) throw inventoryError;

  const clothingIds = (clothing || []).map(c => c.id);
  const likes = new Map();

  if (clothingIds.length) {
    const [{ data: allLikes, error: likesError }, { data: mineLikes, error: mineLikesError }] = await Promise.all([
      supabase.from("clothing_likes").select("clothing_id"),
      supabase.from("clothing_likes").select("clothing_id").eq("user_id", state.session.user.id)
    ]);
    if (likesError) throw likesError;
    if (mineLikesError) throw mineLikesError;

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
  }

  catalog = {
    official: (items || []).map(item => ({
      ...item,
      owned: (inventory || []).some(row => row.item_id === item.id)
    })),
    clothing: (clothing || []).map(item => ({
      ...item,
      like: likes.get(item.id) || { count: 0, mine: false }
    }))
  };

  render();
}

function render() {
  if (!grid) return;

  const official = catalog.official.filter(item => filter === "all" || filter === normalizeCategory(item.category));
  const clothing = catalog.clothing.filter(item => filter === "all" || filter === "clothing" || filter === normalizeFilter(item.type));

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
    '<p>' + Number(item.price || 0).toLocaleString() + ' 🪙</p></div>' +
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
    '<p>' + Number(item.price || 0).toLocaleString() + ' 🪙 · <span class="like-count">' + like.count + '</span> likes</p></div>' +
    '<div class="tool-row">' +
      '<button class="button button--small like-btn" type="button" aria-label="Me gusta">' + (like.mine ? "♥" : "♡") + '</button>' +
      '<button class="button button--small buy-btn" type="button" ' + (mine ? "disabled" : "") + '>' + (mine ? "Tu creación" : "Comprar") + '</button>' +
    '</div>';

  const preview = card.querySelector(".clothing-preview");
  const image = item.thumbnail || item.design_data?.layers?.find(layer => layer?.data)?.data;
  if (image) preview.style.backgroundImage = "url(" + image + ")";

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