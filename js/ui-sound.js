// KIIZU UI click feedback. Audio is created only after a user interaction.
(() => {
  let ctx = null;
  const playClick = () => {
    try {
      ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.035);
      gain.gain.setValueAtTime(0.018, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.045);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (_) {}
  };
  document.addEventListener("pointerdown", e => {
    if (e.target.closest("button, .button, .chip, .text-button, .account-trigger, .photo-upload")) playClick();
  }, {passive:true});
  document.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && document.activeElement?.matches("button, a, select, input[type=submit]")) playClick();
  }, {passive:true});
})();