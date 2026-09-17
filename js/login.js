import { supabase } from "./app.js";
import { signIn, signUp } from "./auth.js";
import { setBusy, toast } from "./ui.js";

const form = document.querySelector("#auth-form");
const modeButton = document.querySelector("#toggle-mode");
const title = document.querySelector("#auth-title");
const submit = document.querySelector("#auth-submit");
const username = document.querySelector("#username");
const usernameWrap = document.querySelector("#username-wrap");
const email = document.querySelector("#email");
const password = document.querySelector("#password");
let mode = "login";

modeButton?.addEventListener("click", () => {
  mode = mode === "login" ? "signup" : "login";
  title.textContent = mode === "login" ? "Bienvenido de vuelta" : "Crea tu identidad";
  submit.textContent = mode === "login" ? "Entrar a KIIZU" : "Crear cuenta";
  username.hidden = mode === "login";
  usernameWrap.hidden = mode === "login";
  modeButton.textContent = mode === "login" ? "Crear cuenta" : "Ya tengo cuenta";
});

form?.addEventListener("submit", async event => {
  event.preventDefault();
  setBusy(submit, true, mode === "login" ? "Entrando..." : "Creando...");
  try {
    if (!supabase) throw new Error("Configura js/config.js con tu URL y anon key de Supabase.");
    if (mode === "login") {
      await signIn(email.value.trim(), password.value);
      window.location.href = "lobby.html";
    } else {
      const name = username.value.trim();
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(name)) throw new Error("Username: 3-20 caracteres, letras, números o _.");
      const data = await signUp({ email: email.value.trim(), password: password.value, username: name });
      if (!data.session) toast("Cuenta creada. Revisa tu correo para confirmar.", "success");
      else window.location.href = "lobby.html";
    }
  } catch (error) {
    toast(error.message || "No se pudo completar la operación.", "error");
  } finally {
    setBusy(submit, false);
  }
});
