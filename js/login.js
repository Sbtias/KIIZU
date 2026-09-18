import { supabase } from "./app.js";
import { signInWithUsername, signUp } from "./auth.js";
import { setBusy, toast } from "./ui.js";

const form = document.querySelector("#auth-form");
const loginButton = document.querySelector("#mode-login");
const signupButton = document.querySelector("#mode-signup");
const title = document.querySelector("#auth-title");
const subtitle = document.querySelector("#auth-subtitle");
const submit = document.querySelector("#auth-submit");
const username = document.querySelector("#username");
const usernameWrap = document.querySelector("#username-wrap");
const email = document.querySelector("#email");
const emailWrap = document.querySelector("#email-wrap");
const password = document.querySelector("#password");
const forgot = document.querySelector("#forgot-password");
const securityNote = document.querySelector("#security-note");

let mode = "login";

function setMode(nextMode) {
  mode = nextMode;
  const signup = mode === "signup";

  title.textContent = signup ? "Crea tu cuenta" : "Bienvenido de vuelta";
  subtitle.textContent = signup
    ? "Crea tu cuenta de KIIZU para jugar, crear y guardar tu progreso."
    : "Entra para continuar tu aventura.";
  submit.textContent = signup ? "Crear cuenta" : "Entrar a KIIZU";

  usernameWrap.hidden = false;
  username.hidden = false;
  username.required = true;

  emailWrap.hidden = !signup;
  email.required = signup;
  password.autocomplete = signup ? "new-password" : "current-password";
  forgot.hidden = signup;
  securityNote.hidden = !signup;

  loginButton.classList.toggle("button--ghost", signup);
  signupButton.classList.toggle("button--ghost", !signup);
  loginButton.setAttribute("aria-selected", String(!signup));
  signupButton.setAttribute("aria-selected", String(signup));
}

loginButton?.addEventListener("click", () => setMode("login"));
signupButton?.addEventListener("click", () => setMode("signup"));


forgot?.addEventListener("click", async () => {
  if (mode === "signup") {
    setMode("login");
    return;
  }

  const currentEmail = window.prompt("Escribe el correo asociado a tu cuenta de KIIZU:");
  const recoveryEmail = currentEmail?.trim();

  if (!recoveryEmail) return;

  setBusy(forgot, true, "Enviando...");
  try {
    const { resetPassword } = await import("./auth.js");
    await resetPassword(recoveryEmail);
    toast("Si el correo existe, recibirás un enlace para restablecer tu contraseña.", "success");
  } catch (error) {
    toast(error?.message || "No se pudo enviar el enlace de recuperación.", "error");
  } finally {
    setBusy(forgot, false);
  }
});

form?.addEventListener("submit", async event => {
  event.preventDefault();
  setBusy(submit, true, mode === "login" ? "Entrando..." : "Creando...");

  try {
    if (!supabase) throw new Error("Configura js/config.js con tu URL y publishable key de Supabase.");

    const name = username.value.trim();

    if (mode === "login") {
      await signInWithUsername(name, password.value);
      window.location.href = "lobby.html";
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(name)) {
      throw new Error("Username: 3-20 caracteres, letras, números o _.");
    }

    const data = await signUp({
      email: email.value.trim(),
      password: password.value,
      username: name
    });

    if (!data.session) {
      toast("Cuenta creada. Revisa tu correo si KIIZU solicita una verificación.", "success");
    } else {
      toast("Cuenta creada. Bienvenido a KIIZU.", "success");
      window.location.href = "lobby.html";
    }
  } catch (error) {
    const message = error?.message || "";
    if (message.includes("USERNAME_TAKEN") || message.includes("profiles_username_key")) {
      toast("Ese username ya está en uso. Elige otro.", "error");
    } else if (message.includes("User already registered")) {
      toast("Ese correo ya está registrado.", "error");
    } else {
      toast(message || "No se pudo completar la operación.", "error");
    }
  } finally {
    setBusy(submit, false);
  }
});

setMode("login");
