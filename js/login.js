import { supabase } from "./app.js";
import { signInWithUsername, signUp } from "./auth.js";
import { setBusy, toast } from "./ui.js";

const form = document.querySelector("#auth-form");
const modeButton = document.querySelector("#toggle-mode");
const title = document.querySelector("#auth-title");
const submit = document.querySelector("#auth-submit");
const username = document.querySelector("#username");
const usernameWrap = document.querySelector("#username-wrap");
const email = document.querySelector("#email");
const emailWrap = document.querySelector("#email-wrap");
const password = document.querySelector("#password");
const forgot = document.querySelector("#forgot-password");
let mode = "login";\nusername.hidden = false;\nusernameWrap.hidden = false;\nemailWrap.hidden = true;\nemail.required = false;\nusername.required = true;

modeButton?.addEventListener("click", () => {
  mode = mode === "login" ? "signup" : "login";
  title.textContent = mode === "login" ? "Bienvenido de vuelta" : "Crea tu cuenta";
  submit.textContent = mode === "login" ? "Entrar a KIIZU" : "Crear cuenta";
  username.hidden = false;
  usernameWrap.hidden = false;
  emailWrap.hidden = mode === "login";
  email.required = mode === "signup";
  modeButton.textContent = mode === "login" ? "Crear cuenta" : "Ya tengo cuenta";
});

form?.addEventListener("submit", async event => {
  event.preventDefault();
  setBusy(submit, true, mode === "login" ? "Entrando..." : "Creando...");
  try {
    if (!supabase) throw new Error("Configura js/config.js con tu URL y anon key de Supabase.");
    if (mode === "login") {
      await signInWithUsername(username.value.trim(), password.value);
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
