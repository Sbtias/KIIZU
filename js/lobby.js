import { bootShell, getPublicStats } from "./nav.js?v=20260918-1335";

const state = await bootShell();
const totalEl = document.querySelector("[data-total-users]");
const onlineEl = document.querySelector("[data-online-users]");

if (state) {
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
}
