// KIIZU interface audio + rain ambience. Audio starts only after a user interaction.
(() => {
  const RAIN_ENABLED_KEY = "kiizu-rain-enabled";
  const RAIN_VOLUME_KEY = "kiizu-rain-volume";
  let ctx = null, rain = null, rainTimer = null, initialized = false;
  const getEnabled = () => { try { return localStorage.getItem(RAIN_ENABLED_KEY) !== "false"; } catch { return true; } };
  const getVolume = () => { try { const n=Number(localStorage.getItem(RAIN_VOLUME_KEY)); return Number.isFinite(n) ? Math.max(0,Math.min(1,n)) : .28; } catch { return .28; } };
  const ensureContext = () => { try { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); if(ctx.state === "suspended") ctx.resume(); return ctx; } catch { return null; } };
  const playTone = (freq=520, end=380, duration=.045, volume=.018) => {
    const ac=ensureContext(); if(!ac)return;
    try { const osc=ac.createOscillator(), gain=ac.createGain(); osc.type="sine"; osc.frequency.setValueAtTime(freq,ac.currentTime); osc.frequency.exponentialRampToValueAtTime(end,ac.currentTime+duration*.8); gain.gain.setValueAtTime(volume,ac.currentTime); gain.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+duration); osc.connect(gain).connect(ac.destination); osc.start(); osc.stop(ac.currentTime+duration+.005); } catch(_) {}
  };
  const rainCSS =
    '.kiizu-rain{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;background:linear-gradient(180deg,rgba(7,9,12,.04),rgba(7,9,12,.16))}' +
    '.kiizu-rain::before{content:"";position:absolute;inset:-12%;background:repeating-linear-gradient(102deg,transparent 0 26px,rgba(210,222,232,.075) 27px,transparent 29px 54px);filter:blur(.7px);animation:kiizuRainSheet 2.8s linear infinite;opacity:.55}' +
    '.kiizu-rain::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 20% 10%,rgba(255,255,255,.08),transparent 26%),radial-gradient(circle at 78% 78%,rgba(160,180,200,.06),transparent 30%);backdrop-filter:blur(1.4px);-webkit-backdrop-filter:blur(1.4px);border:1px solid rgba(255,255,255,.045);box-shadow:inset 0 0 80px rgba(0,0,0,.2)}' +
    '.kiizu-rain-drop{position:absolute;top:-12vh;width:1px;border-radius:999px;background:linear-gradient(180deg,transparent,rgba(225,235,245,.28),rgba(255,255,255,.04));filter:blur(.2px);animation:kiizuRainFall linear infinite;opacity:.5}' +
    '@keyframes kiizuRainFall{to{transform:translate3d(18vw,118vh,0)}}@keyframes kiizuRainSheet{to{transform:translate3d(11vw,8vh,0)}}' +
    'body.kiizu-rain-active>main{position:relative;z-index:1}' +
    '.settings-rain{display:flex;align-items:center;justify-content:space-between;gap:18px}.settings-rain-copy strong,.settings-rain-copy span{display:block}.settings-rain-copy span{margin-top:4px;color:var(--muted);font-size:9px}' +
    '.settings-toggle{position:relative;width:44px;height:24px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(255,255,255,.055);cursor:pointer;padding:0;flex:none}.settings-toggle i{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#777f87;transition:transform .2s,background .2s}.settings-toggle.is-on i{transform:translateX(20px);background:#e0e4e8}' +
    '.rain-volume{margin-top:13px;display:flex;align-items:center;gap:10px;color:#737b84;font-size:9px}.rain-volume input{flex:1;accent-color:#c9ced3}.rain-volume b{min-width:32px;text-align:right;color:#aeb4bb;font-size:8px}' +
    '@media(prefers-reduced-motion:reduce){.kiizu-rain::before,.kiizu-rain-drop{animation:none}.kiizu-rain-drop{display:none}}';
  const injectRainVisual=()=>{
    let el=document.querySelector(".kiizu-rain");
    if(!getEnabled()){el?.remove();document.body.classList.remove("kiizu-rain-active");return;}
    if(!document.querySelector("#kiizu-rain-style")){const s=document.createElement("style");s.id="kiizu-rain-style";s.textContent=rainCSS;document.head.appendChild(s);}
    if(el)return;
    el=document.createElement("div");el.className="kiizu-rain";el.setAttribute("aria-hidden","true");
    const count=window.matchMedia?.("(max-width:700px)").matches?24:42;
    for(let i=0;i<count;i++){const d=document.createElement("i");d.className="kiizu-rain-drop";d.style.left=(Math.random()*110-5)+"%";d.style.height=(14+Math.random()*55)+"px";d.style.animationDuration=(.7+Math.random()*1.35)+"s";d.style.animationDelay=(-Math.random()*2.2)+"s";d.style.opacity=(.18+Math.random()*.42).toFixed(2);el.appendChild(d);}
    document.body.prepend(el);document.body.classList.add("kiizu-rain-active");
  };
  const playDrop=()=>{
    const ac=ensureContext();if(!ac||!rain)return;
    try{const buffer=ac.createBuffer(1,ac.sampleRate*.055,ac.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,3);const src=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();src.buffer=buffer;filter.type="bandpass";filter.frequency.value=2600+Math.random()*1800;filter.Q.value=1.2;gain.gain.value=getVolume()*(.006+Math.random()*.012);src.connect(filter).connect(gain).connect(rain.master);src.start();}catch(_){}
  };
  const startRain=()=>{
    if(!getEnabled())return;const ac=ensureContext();if(!ac||rain)return;
    const master=ac.createGain();master.gain.value=getVolume();master.connect(ac.destination);
    const buffer=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.22;
    const src=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();src.buffer=buffer;src.loop=true;filter.type="lowpass";filter.frequency.value=1450;filter.Q.value=.35;gain.gain.value=.08;src.connect(filter).connect(gain).connect(master);src.start();rain={master,src};rainTimer=setInterval(playDrop,420);
  };
  const stopRain=()=>{if(rainTimer)clearInterval(rainTimer);rainTimer=null;if(rain){try{rain.master.gain.setTargetAtTime(0,ctx.currentTime,.08);rain.src.stop(ctx.currentTime+.18)}catch(_){}rain=null;}injectRainVisual();};
  const refreshRain=()=>{injectRainVisual();if(getEnabled())startRain();else stopRain();};
  window.KIIZURain={refresh:refreshRain,setEnabled(v){try{localStorage.setItem(RAIN_ENABLED_KEY,String(!!v));}catch(_){};if(v)injectRainVisual();else stopRain();if(v&&initialized)startRain();},setVolume(v){try{localStorage.setItem(RAIN_VOLUME_KEY,String(v));}catch(_){};if(rain&&ctx)rain.master.gain.setTargetAtTime(Number(v),ctx.currentTime,.08);}};
  const init=()=>{if(initialized)return;initialized=true;injectRainVisual();if(getEnabled())startRain();};
  const pressSelector="button, .button, .chip, .text-button, .account-trigger, .photo-upload";
  document.addEventListener("pointerdown",e=>{const target=e.target.closest(pressSelector);if(!target||target.disabled)return;init();playTone(target.classList.contains("danger")?280:520,target.classList.contains("danger")?220:380,target.classList.contains("danger")?.065:.045,target.classList.contains("danger")?.012:.018);target.classList.remove("ui-press");void target.offsetWidth;target.classList.add("ui-press");window.setTimeout(()=>target.classList.remove("ui-press"),460);},{passive:true});
  document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&document.activeElement?.matches("button,a,select,input[type=submit]")){init();playTone();}},{passive:true});
  injectRainVisual();
})();