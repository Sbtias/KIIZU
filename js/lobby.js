import { bootShell } from "./nav.js";
import { toast } from "./ui.js";

const state = await bootShell();
if (state) {
  document.querySelector("#welcome-name").textContent = state.profile.username;
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
