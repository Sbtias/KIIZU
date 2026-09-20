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
      const raw = localStorage.getItem(RAIN_VOLUME_KEY);
      // Migrate the previous built-in 28% default to the new stronger 62% baseline.
      if (raw === "0.28") {
        localStorage.setItem(RAIN_VOLUME_KEY, "0.62");
        return 0.62;
      }
      const n = Number(raw);
      return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.62;
    } catch {
      return 0.62;
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

  const rainCSS =
    ".kiizu-rain{position:fixed;inset:0;z-index:9998;pointer-events:none;overflow:hidden;background:transparent;isolation:isolate}" +
    ".kiizu-rain::after{content:\"\";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 18% 12%,rgba(220,235,248,.035),transparent 32%),radial-gradient(circle at 82% 72%,rgba(170,205,232,.025),transparent 34%);box-shadow:inset 0 0 120px rgba(0,0,0,.10)}" +
    ".kiizu-rain-drop{position:absolute;top:-14vh;width:1.5px;height:42px;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,0),rgba(208,229,248,.62) 24%,rgba(239,248,255,.96) 63%,rgba(255,255,255,.10));box-shadow:0 0 9px rgba(210,232,248,.28);animation:kiizuRainDrop linear infinite;will-change:transform,opacity;transform:rotate(11deg)}" +
    "@keyframes kiizuRainDrop{0%{transform:translate3d(0,-14vh,0) rotate(11deg);opacity:0}7%{opacity:.95}52%{opacity:.74}86%{opacity:.50}100%{transform:translate3d(7vw,120vh,0) rotate(11deg);opacity:0}}" +
    ".kiizu-rain::before{content:\"\";position:absolute;inset:0;background:linear-gradient(108deg,transparent 0 22%,rgba(205,226,244,.035) 44%,transparent 58%);mix-blend-mode:screen;opacity:.9;animation:kiizuRainSweep 8s linear infinite}" + ".settings-rain{display:flex;align-items:center;justify-content:space-between;gap:18px}.settings-rain-copy strong,.settings-rain-copy span{display:block}.settings-rain-copy span{margin-top:4px;color:var(--muted);font-size:9px}" +
    ".settings-toggle{position:relative;width:44px;height:24px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(255,255,255,.055);cursor:pointer;padding:0;flex:none}.settings-toggle i{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#777f87;transition:transform .2s,background .2s}.settings-toggle.is-on i{transform:translateX(20px);background:#e0e4e8}" +
    ".rain-volume{margin-top:13px;display:flex;align-items:center;gap:10px;color:#737b84;font-size:9px}.rain-volume input{flex:1;accent-color:#c9ced3}.rain-volume b{min-width:32px;text-align:right;color:#aeb4bb;font-size:8px}" +
    "@keyframes kiizuRainSweep{0%{transform:translateX(-24%);opacity:.2}50%{opacity:.55}100%{transform:translateX(24%);opacity:.2}}@media(prefers-reduced-motion:reduce){.kiizu-rain-drop,.kiizu-rain::before{animation:none;display:none}}";

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
    const count = compact ? 34 : 58;

    for (let i = 0; i < count; i++) {
      const drop = document.createElement("i");
      drop.className = "kiizu-rain-drop";
      drop.style.left = (Math.random() * 110 - 5) + "%";
      drop.style.height = (28 + Math.random() * 30).toFixed(1) + "px";
      drop.style.width = (1.1 + Math.random() * 0.9).toFixed(1) + "px";
      drop.style.animationDuration = (1.9 + Math.random() * 2.4) + "s";
      drop.style.animationDelay = (-Math.random() * 4.5) + "s";
      drop.style.opacity = (0.55 + Math.random() * 0.38).toFixed(2);
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
      filter.frequency.value = 3000 + Math.random() * 1800;
      filter.Q.value = 1.6;
      gain.gain.value = .22 * getVolume() * (.58 + Math.random() * .42);

      source.connect(filter).connect(gain).connect(rain.master);
      source.start();
    } catch (_) {}
  };

  const createRainAudio = ac => {
    if (rain || startingRain || !getEnabled()) return;
    startingRain = true;

    try {
      const master = ac.createGain();
      const compressor = ac.createDynamicsCompressor();
      master.gain.value = 0;

      compressor.threshold.value = -28;
      compressor.knee.value = 18;
      compressor.ratio.value = 7;
      compressor.attack.value = .004;
      compressor.release.value = .24;

      master.connect(compressor).connect(ac.destination);

      const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 4), ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const swell = Math.sin(i / 43) * .055 + Math.sin(i / 97) * .025;
        data[i] = (Math.random() * 2 - 1) * (.22 + Math.random() * .10) + swell;
      }

      const source = ac.createBufferSource();
      const filter = ac.createBiquadFilter();
      const gain = ac.createGain();
      const airFilter = ac.createBiquadFilter();
      const airGain = ac.createGain();

      source.buffer = buffer;
      source.loop = true;

      filter.type = "lowpass";
      filter.frequency.value = 1850;
      filter.Q.value = .52;
      gain.gain.value = .30;

      airFilter.type = "bandpass";
      airFilter.frequency.value = 3400;
      airFilter.Q.value = .72;
      airGain.gain.value = .085;

      source.connect(filter).connect(gain).connect(master);
      source.connect(airFilter).connect(airGain).connect(master);
      source.start();

      master.gain.setTargetAtTime(Math.max(.12, .92 * getVolume()), ac.currentTime, .20);
      rain = { master, source };
      rainTimer = window.setInterval(playDrop, 290);
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
        rain.master.gain.setTargetAtTime(Math.max(.06, .92 * volume), ctx.currentTime, .08);
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