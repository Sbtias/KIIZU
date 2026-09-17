import { supabase } from "./app.js";
import { bootShell } from "./nav.js";
import { toast } from "./ui.js";

const params = new URLSearchParams(location.search);
const gameSlug = params.get("game") || "reaction";
const state = await bootShell();
const status = document.querySelector("#match-status");
const action = document.querySelector("#game-action");
const scoreEl = document.querySelector("#game-score");
let score = 0;

if (state && supabase) {
  status.textContent = `Listo para ${gameSlug === "quickclick" ? "Quick Click" : "Reaction Arena"}`;
  action.addEventListener("click", async () => {
    score++;
    scoreEl.textContent = score;
    action.textContent = "¡Sigue!";
    if (score >= 10) {
      action.disabled = true;
      toast("Partida local completada. El modo competitivo se conecta con Realtime en la siguiente capa.", "success");
    }
  });
}
