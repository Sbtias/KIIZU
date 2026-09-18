import { bootShell, getPublicStats } from "./nav.js";

const state = await bootShell();

if (state) {
  document.querySelector("#welcome-name").textContent = state.profile.username;

  const totalEl = document.querySelector("[data-total-users]");

  async function refreshStats() {
    try {
      const stats = await getPublicStats();
      totalEl.textContent = stats.total.toLocaleString();
    } catch {
      totalEl.textContent = "—";
    }
  }

  await refreshStats();
  setInterval(refreshStats, 15000);
}
