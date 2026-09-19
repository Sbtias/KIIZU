// KIIZU interface audio + rain ambience.
// La lluvia se activa tras una interacción real del usuario para respetar las políticas de autoplay del navegador.
(() => {
  const RAIN_ENABLED_KEY = "kiizu-rain-enabled";
  const RAIN_VOLUME_KEY = "kiizu-rain-volume";
  const THEME_KEY = "kiizu-theme";
  try {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (["dark", "aurora", "light"].includes(savedTheme)) document.documentElement.dataset.theme = savedTheme;
  } catch (_) {}

  let ctx = null;
  let rain = null;
  let rainTimer = null;
  let initialized = false;
  let startingRain = false;

  const getEnabled = () => {
    try { return localStorage.getItem(RAIN_ENABLED_KEY) !== "false"; }
    catch { return true; }
  };

  const getVolume = () => {
    try {
      const n = Number(localStorage.getItem(RAIN_VOLUME_KEY));
      return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.28;
    } catch {
      return 0.28;
    }
  };

  const ensureContext = () => {
    try {
      ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return ctx;
    } catch {
      return null;
    }
  };

  const playTone = (freq = 520, end = 380, duration = .045, volume = .018) => {
    const ac = ensureContext();
    if (!ac) return;
    try {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(end, ac.currentTime + duration * .8);
      gain.gain.setValueAtTime(volume, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + duration);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + duration + .005);
    } catch (_) {}
  };

  const rainCSS =
  const rainCSS =
    ".kiizu-rain{position:fixed;inset:0;z-index:9998;pointer-events:none;overflow:hidden;background:transparent;isolation:isolate}" +
    ".kiizu-rain::after{content:\"\";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 18% 12%,rgba(220,235,248,.035),transparent 32%),radial-gradient(circle at 82% 72%,rgba(170,205,232,.025),transparent 34%);box-shadow:inset 0 0 120px rgba(0,0,0,.10)}" +
    ".kiizu-rain-drop{position:absolute;top:-12vh;width:1.2px;height:30px;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,0),rgba(216,232,245,.52) 30%,rgba(238,247,253,.82) 68%,rgba(255,255,255,.08));box-shadow:0 0 7px rgba(210,232,248,.16);animation:kiizuRainDrop linear infinite;will-change:transform,opacity;transform:rotate(10deg)}" +
    "@keyframes kiizuRainDrop{0%{transform:translate3d(0,-12vh,0) rotate(10deg);opacity:0}8%{opacity:.78}55%{opacity:.62}88%{opacity:.42}100%{transform:translate3d(5vw,116vh,0) rotate(10deg);opacity:0}}" +
    ".settings-rain{display:flex;align-items:center;justify-content:space-between;gap:18px}.settings-rain-copy strong,.settings-rain-copy span{display:block}.settings-rain-copy span{margin-top:4px;color:var(--muted);font-size:9px}" +
    ".settings-toggle{position:relative;width:44px;height:24px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(255,255,255,.055);cursor:pointer;padding:0;flex:none}.settings-toggle i{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#777f87;transition:transform .2s,background .2s}.settings-toggle.is-on i{transform:translateX(20px);background:#e0e4e8}" +
    ".rain-volume{margin-top:13px;display:flex;align-items:center;gap:10px;color:#737b84;font-size:9px}.rain-volume input{flex:1;accent-color:#c9ced3}.rain-volume b{min-width:32px;text-align:right;color:#aeb4bb;font-size:8px}" +
    "@media(prefers-reduced-motion:reduce){.kiizu-rain-drop{animation:none;display:none}}";

  const injectRainVisual = () => {
    let el = document.querySelector(".kiizu-rain");
    if (!getEnabled()) {
      el?.remove();
      document.body.classList.remove("kiizu-rain-active");
      return;
    }

    if (!document.querySelector("#kiizu-rain-style")) {
      const style = document.createElement("style");
      style.id = "kiizu-rain-style";
      style.textContent = rainCSS;
      document.head.appendChild(style);
    }

    if (el) return;

    el = document.createElement("div");
    el.className = "kiizu-rain";
    el.setAttribute("aria-hidden", "true");

    const compact = window.matchMedia?.("(max-width:700px)").matches;
    const count = compact ? 14 : 28;

    for (let i = 0; i < count; i++) {
      const drop = document.createElement("i");
      drop.className = "kiizu-rain-drop";
      drop.style.left = (Math.random() * 110 - 5) + "%";
      drop.style.animationDuration = (3.1 + Math.random() * 3.8) + "s";
      drop.style.animationDelay = (-Math.random() * 6.5) + "s";
      drop.style.opacity = (0.18 + Math.random() * 0.45).toFixed(2);
      el.appendChild(drop);
    }

    
    document.body.prepend(el);
    document.body.classList.add("kiizu-rain-active");
  };

  const playDrop = () => {
    const ac = ensureContext();
    if (!ac || !rain) return;
    try {
      const buffer = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * .045)), ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
      }

      const source = ac.createBufferSource();
      const filter = ac.createBiquadFilter();
      const gain = ac.createGain();

      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.value = 2800 + Math.random() * 1600;
      filter.Q.value = 1.6;
      gain.gain.value = .12 * getVolume() * (.55 + Math.random() * .45);

      source.connect(filter).connect(gain).connect(rain.master);
      source.start();
    } catch (_) {}
  };

  const createRainAudio = ac => {
    if (rain || startingRain || !getEnabled()) return;
    startingRain = true;

    try {
      const master = ac.createGain();
      master.gain.value = 0;
      master.connect(ac.destination);

      const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 3), ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const low = Math.sin(i / 31) * .04;
        data[i] = (Math.random() * 2 - 1) * (.17 + Math.random() * .06) + low;
      }

      const source = ac.createBufferSource();
      const filter = ac.createBiquadFilter();
      const gain = ac.createGain();

      source.buffer = buffer;
      source.loop = true;
      filter.type = "lowpass";
      filter.frequency.value = 1500;
      filter.Q.value = .42;
      gain.gain.value = .18;

      source.connect(filter).connect(gain).connect(master);
      source.start();

      master.gain.setTargetAtTime(Math.max(.06, .52 * getVolume()), ac.currentTime, .22);
      rain = { master, source };
      rainTimer = window.setInterval(playDrop, 420);
    } catch (_) {
      startingRain = false;
      return;
    }

    startingRain = false;
  };

  const startRain = () => {
    if (!getEnabled()) return;
    const ac = ensureContext();
    if (!ac) return;

    injectRainVisual();

    const resume = ac.state === "suspended" ? ac.resume().catch(() => null) : Promise.resolve(true);
    resume.then(() => {
      if (ac.state !== "running" || !getEnabled()) return;
      createRainAudio(ac);
    });
  };

  const stopRain = () => {
    if (rainTimer) window.clearInterval(rainTimer);
    rainTimer = null;

    if (rain) {
      try {
        rain.master.gain.setTargetAtTime(0, ctx.currentTime, .08);
        rain.source.stop(ctx.currentTime + .18);
      } catch (_) {}
      rain = null;
    }

    startingRain = false;
    injectRainVisual();
  };

  const refreshRain = () => {
    injectRainVisual();
    if (getEnabled()) startRain();
    else stopRain();
  };

  window.KIIZURain = {
    refresh: refreshRain,
    setEnabled(value) {
      const enabled = Boolean(value);
      try { localStorage.setItem(RAIN_ENABLED_KEY, String(enabled)); } catch (_) {}

      if (enabled) {
        initialized = true;
        injectRainVisual();
        startRain();
      } else {
        stopRain();
      }
    },
    setVolume(value) {
      const volume = Math.max(0, Math.min(1, Number(value) || 0));
      try { localStorage.setItem(RAIN_VOLUME_KEY, String(volume)); } catch (_) {}
      if (rain && ctx) {
        rain.master.gain.setTargetAtTime(Math.max(.06, .52 * volume), ctx.currentTime, .08);
      }
    }
  };

  const init = () => {
    if (initialized) return;
    initialized = true;
    injectRainVisual();
    if (getEnabled()) startRain();
  };

  const pressSelector = "button, .button, .chip, .text-button, .account-trigger, .photo-upload";

  document.addEventListener("pointerdown", event => {
    const target = event.target.closest(pressSelector);
    if (!target || target.disabled) return;

    init();
    playTone(
      target.classList.contains("danger") ? 280 : 520,
      target.classList.contains("danger") ? 220 : 380,
      target.classList.contains("danger") ? .065 : .045,
      target.classList.contains("danger") ? .012 : .018
    );

    target.classList.remove("ui-press");
    void target.offsetWidth;
    target.classList.add("ui-press");
    window.setTimeout(() => target.classList.remove("ui-press"), 460);
  }, { passive: true });

  document.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") &&
        document.activeElement?.matches("button,a,select,input[type=submit]")) {
      init();
      playTone();
    }
  }, { passive: true });

  injectRainVisual();
})();