import { bootShell, getPublicStats } from "./nav.js";

const state = await bootShell();

if (state) {
  document.querySelector("#welcome-name").textContent = state.profile.username;

  const totalEl = document.querySelector("[data-total-users]");
  const onlineEl = document.querySelector("[data-online-users]");

  async function refreshStats() {
    try {
      const stats = await getPublicStats();
      totalEl.textContent = stats.total.toLocaleString();
      onlineEl.textContent = stats.online.toLocaleString();
    } catch {
      totalEl.textContent = "—";
      onlineEl.textContent = "—";
    }
  }

  await refreshStats();
  setInterval(refreshStats, 15000);
}
