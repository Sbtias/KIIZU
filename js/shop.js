import { supabase } from "./app.js";
import { bootShell } from "./nav.js";
import { toast, setBusy } from "./ui.js";

const state = await bootShell();
const grid = document.querySelector("#shop-grid");

async function loadShop() {
  if (!supabase) return;
  const { data, error } = await supabase.from("items").select("*").order("price");
  if (error) throw error;
  grid.innerHTML = "";
  for (const item of data || []) {
    const card = document.createElement("article");
    card.className = "item-card";
    card.innerHTML = `<div class="item-art">✦</div><div><span class="eyebrow">${item.category}</span><h3>${item.name}</h3><p>${Number(item.price).toLocaleString()} 🪙</p></div><button class="button button--small">Comprar</button>`;
    const button = card.querySelector("button");
    button.addEventListener("click", async () => {
      setBusy(button, true, "Comprando...");
      try {
        const { error } = await supabase.rpc("purchase_item", { p_item_id: item.id });
        if (error) throw error;
        toast(`${item.name} añadido al inventario.`, "success");
        window.location.reload();
      } catch (e) {
        toast(e.message || "Compra rechazada.", "error");
        setBusy(button, false);
      }
    });
    grid.appendChild(card);
  }
}
if (state) loadShop().catch(e => toast(e.message, "error"));
