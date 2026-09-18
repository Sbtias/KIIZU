import { bootShell, getPublicStats } from "./nav.js";
import { toast } from "./ui.js";

const state = await bootShell();
if (state) {
  document.querySelector("#welcome-name").textContent = state.profile.username;
  const totalEl = document.querySelector("[data-total-users]");
  const onlineEl = document.querySelector("[data-online-users]");

  async function refreshStats() {
    try {
      const stats = await getPublicStats();
      if (totalEl) totalEl.textContent = stats.total.toLocaleString();
      if (onlineEl) onlineEl.textContent = stats.online.toLocaleString();
    } catch {
      if (totalEl) totalEl.textContent = "—";
      if (onlineEl) onlineEl.textContent = "—";
    }
  }

  await refreshStats();
  setInterval(refreshStats, 15000);

  document.querySelectorAll("[data-play]").forEach(card => {
    card.addEventListener("click", () => {
      const game = card.dataset.play;
      if (game === "reaction") window.location.href = "game.html?game=reaction";
      else if (game === "quickclick") window.location.href = "game.html?game=quickclick";
      else if (game === "memory") window.location.href = "game.html?game=memory";
      else toast("Este mundo todavía está en construcción.", "info");
    });
  });
}
