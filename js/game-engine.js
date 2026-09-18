export class Kiizu2D {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.world = options.world || { width: 3600, height: 900, gravity: 0.72 };
    this.player = options.player || { x: 150, y: 600, w: 34, h: 52, vx: 0, vy: 0, speed: 4.4, jump: 12 };
    this.entities = options.entities || [];
    this.remotePlayers = new Map();
    this.keys = new Set();
    this.camera = { x: 0, y: 0 };
    this.running = false;
    this.last = 0;
    this.onCollect = options.onCollect || (() => {});
    this.onHazard = options.onHazard || (() => {});
    this.onGoal = options.onGoal || (() => {});
    this.onFrame = options.onFrame || (() => {});
    this.spawn = options.spawn || null;
    this.appearanceImages = new Map();
    this.checkpoint = options.spawn || null;
    this.hazardCooldown = 0;
    this.bindInput();
    this.resize();
    addEventListener("resize", () => this.resize());
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.view = { width: rect.width, height: rect.height };
  }

  bindInput() {
    addEventListener("keydown", e => {
      if (["ArrowLeft","ArrowRight","ArrowUp"," ","a","d","w"].includes(e.key)) e.preventDefault();
      this.keys.add(e.key.toLowerCase());
    });
    addEventListener("keyup", e => this.keys.delete(e.key.toLowerCase()));
    document.querySelectorAll("[data-game-key]").forEach(button => {
      const key = button.dataset.gameKey;
      const down = e => { e.preventDefault(); this.keys.add(key); };
      const up = e => { e.preventDefault(); this.keys.delete(key); };
      button.addEventListener("pointerdown", down);
      button.addEventListener("pointerup", up);
      button.addEventListener("pointercancel", up);
      button.addEventListener("pointerleave", up);
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(t => this.loop(t));
  }

  stop() { this.running = false; }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(2, (now - this.last) / 16.67);
    this.last = now;
    this.update(dt);
    this.render();
    requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    const p = this.player;
    this.hazardCooldown = Math.max(0, this.hazardCooldown - dt);
    const left = this.keys.has("a") || this.keys.has("arrowleft");
    const right = this.keys.has("d") || this.keys.has("arrowright");
    const jump = this.keys.has("w") || this.keys.has("arrowup") || this.keys.has(" ");
    p.vx += (right ? 0.8 : 0) - (left ? 0.8 : 0);
    p.vx *= Math.pow(0.78, dt);
    p.vx = Math.max(-p.speed, Math.min(p.speed, p.vx));
    p.vy += this.world.gravity * dt;
    if (jump && p.grounded) { p.vy = -p.jump; p.grounded = false; }
    p.x += p.vx * dt;
    this.collideHorizontal();
    p.y += p.vy * dt;
    this.collideVertical();

    for (const e of this.entities) {
      if (e.collected || e.type === "platform" || e.type === "spawn") continue;
      if (this.overlap(p, e)) {
        if (e.type === "coin") { e.collected = true; this.onCollect(e); }
        if (e.type === "checkpoint") this.checkpoint = { x:e.x, y:e.y + e.h - p.h, w:p.w, h:p.h };
        if (e.type === "spring" && p.vy >= 0) { p.vy = -(Number(e.power) || 15); p.grounded = false; }
        if ((e.type === "hazard" || e.type === "water" || e.type === "enemy") && this.hazardCooldown <= 0) { this.hazardCooldown = 35; this.onHazard(e); }
        if (e.type === "goal") this.onGoal(e);
      }
    }

    p.x = Math.max(0, Math.min(this.world.width - p.w, p.x));
    this.camera.x += ((p.x + p.w / 2) - (this.camera.x + this.view.width / 2)) * 0.12;
    this.camera.y = Math.max(0, Math.min(this.world.height - this.view.height, p.y - this.view.height * 0.56));
    this.camera.x = Math.max(0, Math.min(this.world.width - this.view.width, this.camera.x));
    this.onFrame({ player: p, camera: this.camera });
  }

  respawn() {
    const s = this.checkpoint || this.spawn || { x:150, y:600 };
    this.player.x = s.x;
    this.player.y = s.y;
    this.player.vx = 0;
    this.player.vy = 0;
  }

  collideHorizontal() {
    const p = this.player;
    for (const e of this.entities) {
      if (!["platform","moving"].includes(e.type) || !this.overlap(p, e)) continue;
      if (p.vx > 0) p.x = e.x - p.w;
      else if (p.vx < 0) p.x = e.x + e.w;
      p.vx = 0;
    }
  }

  collideVertical() {
    const p = this.player;
    p.grounded = false;
    for (const e of this.entities) {
      if (e.type !== "platform" || !this.overlap(p, e)) continue;
      if (p.vy >= 0) { p.y = e.y - p.h; p.vy = 0; p.grounded = true; }
      else { p.y = e.y + e.h; p.vy = 0; }
    }
    if (p.y > this.world.height + 120) {
      this.respawn();
      this.onHazard({ type: "fall" });
    }
  }

  overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  setRemotePlayers(players) {
    this.remotePlayers = new Map(players.map(p => [p.user_id, p]));
  }

  render() {
    const ctx = this.ctx, v = this.view, c = this.camera;
    ctx.clearRect(0, 0, v.width, v.height);
    const g = ctx.createLinearGradient(0, 0, 0, v.height);
    g.addColorStop(0, "#090b10");
    g.addColorStop(1, "#11161c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, v.width, v.height);

    ctx.save();
    ctx.translate(-c.x, -c.y);
    this.drawBackground(ctx);
    for (const e of this.entities) {
      if (e.collected) continue;
      if (e.type === "platform" || e.type === "moving") this.drawPlatform(ctx, e);
      
      if (e.type === "enemy") this.drawEnemy(ctx, e);
      if (e.type === "checkpoint") this.drawCheckpoint(ctx, e);
      if (e.type === "spring") this.drawSpring(ctx, e);
      if (e.type === "water") this.drawWater(ctx, e);
      if (e.type === "coin") this.drawCoin(ctx, e);
      if (e.type === "hazard") this.drawHazard(ctx, e);
      if (e.type === "goal") this.drawGoal(ctx, e);
      if (e.type === "tree") this.drawTree(ctx, e);
      if (e.type === "rock") this.drawRock(ctx, e);
    }
    for (const p of this.remotePlayers.values()) {
      if (p.user_id !== this.player.user_id) this.drawCharacter(ctx, p.x, p.y, p.color || "#aeb8c7", p.username || "Player", p.appearance);
    }
    this.drawCharacter(ctx, this.player.x, this.player.y, this.player.color || "#f0f2f5", this.player.username || "Tú", this.player.appearance);
    ctx.restore();
  }

  drawBackground(ctx) {
    const ground = this.world.height - 90;
    ctx.fillStyle = "#151b20";
    ctx.fillRect(0, ground, this.world.width, 90);
    ctx.strokeStyle = "rgba(255,255,255,.035)";
    for (let x = 0; x < this.world.width; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, ground); ctx.lineTo(x, this.world.height); ctx.stroke();
    }
    for (let y = ground; y < this.world.height; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.world.width, y); ctx.stroke();
    }
  }

  drawSpawn(ctx,e) { ctx.strokeStyle="rgba(220,226,233,.18)"; ctx.setLineDash([5,4]); ctx.strokeRect(e.x,e.y,e.w,e.h); ctx.setLineDash([]); }
  drawEnemy(ctx,e) { ctx.fillStyle="#777f89"; ctx.beginPath(); ctx.roundRect(e.x,e.y,e.w,e.h,9); ctx.fill(); ctx.fillStyle="#171b20"; ctx.fillRect(e.x+8,e.y+12,6,5); ctx.fillRect(e.x+24,e.y+12,6,5); }
  drawCheckpoint(ctx,e) { ctx.strokeStyle="#dce2e9"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(e.x+8,e.y+e.h); ctx.lineTo(e.x+8,e.y); ctx.stroke(); ctx.strokeRect(e.x+8,e.y,25,18); }
  drawSpring(ctx,e) { ctx.fillStyle="#8b949e"; ctx.fillRect(e.x,e.y+e.h-5,e.w,5); ctx.strokeStyle="#dce2e8"; ctx.beginPath(); ctx.moveTo(e.x+5,e.y+e.h-5); ctx.lineTo(e.x+12,e.y+4); ctx.lineTo(e.x+23,e.y+e.h-5); ctx.lineTo(e.x+34,e.y+4); ctx.lineTo(e.x+41,e.y+e.h-5); ctx.stroke(); }
  drawWater(ctx,e) { ctx.fillStyle="rgba(112,133,151,.5)"; ctx.fillRect(e.x,e.y,e.w,e.h); }

  drawPlatform(ctx, e) {
    ctx.fillStyle = e.variant === "stone" ? "#424a53" : "#343d37";
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.fillRect(e.x, e.y, e.w, 3);
  }

  drawCoin(ctx, e) {
    ctx.beginPath();
    ctx.arc(e.x + e.w / 2, e.y + e.h / 2, e.w * .38, 0, Math.PI * 2);
    ctx.fillStyle = "#d7dce4";
    ctx.fill();
    ctx.fillStyle = "#11151a";
    ctx.font = '700 11px "Space Grotesk"';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("K", e.x + e.w / 2, e.y + e.h / 2 + 1);
  }

  drawHazard(ctx, e) {
    ctx.fillStyle = "#7d4b52";
    ctx.beginPath();
    ctx.moveTo(e.x, e.y + e.h);
    ctx.lineTo(e.x + e.w / 2, e.y);
    ctx.lineTo(e.x + e.w, e.y + e.h);
    ctx.closePath();
    ctx.fill();
  }

  drawGoal(ctx, e) {
    ctx.strokeStyle = "#dce2e9";
    ctx.lineWidth = 3;
    ctx.strokeRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = "#fff";
    ctx.font = '600 10px "Space Grotesk"';
    ctx.textAlign = "center";
    ctx.fillText("META", e.x + e.w / 2, e.y + e.h / 2 + 3);
  }

  drawTree(ctx, e) {
    ctx.fillStyle = "#5b473b";
    ctx.fillRect(e.x + e.w * .42, e.y + e.h * .4, e.w * .16, e.h * .6);
    ctx.fillStyle = "#3b5145";
    ctx.beginPath();
    ctx.arc(e.x + e.w / 2, e.y + e.h * .32, e.w * .42, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRock(ctx, e) {
    ctx.fillStyle = "#505861";
    ctx.beginPath();
    ctx.roundRect(e.x, e.y, e.w, e.h, 8);
    ctx.fill();
  }

  drawCharacter(ctx, x, y, color, name, appearance) {
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.ellipse(x + 17, y + 52, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cuerpo base con zonas separadas para que la ropa se adapte al personaje.
    ctx.fillStyle = "#e4e7eb";
    ctx.beginPath();
    ctx.arc(x + 17, y + 10, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x + 7, y + 18, 20, 27, 6);
    ctx.fill();
    ctx.fillRect(x + 9, y + 43, 7, 9);
    ctx.fillRect(x + 18, y + 43, 7, 9);

    ctx.fillStyle = "#14181d";
    ctx.fillRect(x + 11, y + 7, 4, 3);
    ctx.fillRect(x + 20, y + 7, 4, 3);

    const layers = Array.isArray(appearance?.images) ? appearance.images : [];
    for (const layer of layers) {
      const src = typeof layer === "string" ? layer : layer?.src;
      const type = String(typeof layer === "string" ? "full" : (layer?.type || layer?.slot || "full")).toLowerCase();
      if (!src) continue;

      let image = this.appearanceImages.get(src);
      if (!image) {
        image = new Image();
        image.src = src;
        this.appearanceImages.set(src, image);
      }
      if (!image.complete || !image.naturalWidth) continue;

      let box = { x:x + 4, y:y + 4, w:26, h:48, clip:null };
      if (type.includes("camis") || type === "shirt") box = { x:x + 5, y:y + 17, w:24, h:29, clip:[x + 6,y + 17,x + 28,y + 46] };
      else if (type.includes("pantal") || type === "pants") box = { x:x + 7, y:y + 40, w:20, h:13, clip:[x + 7,y + 39,x + 27,y + 53] };
      else if (type.includes("sombr") || type === "hat") box = { x:x + 3, y:y - 1, w:28, h:18, clip:[x + 2,y - 3,x + 32,y + 16] };
      else if (type.includes("cara") || type === "face") box = { x:x + 6, y:y + 1, w:22, h:20, clip:[x + 5,y,x + 27,y + 21] };
      else if (type.includes("acces") || type === "accessory") box = { x:x + 3, y:y + 20, w:28, h:22, clip:[x + 2,y + 18,x + 32,y + 44] };

      ctx.save();
      if (box.clip) {
        ctx.beginPath();
        ctx.rect(box.clip[0],box.clip[1],box.clip[2]-box.clip[0],box.clip[3]-box.clip[1]);
        ctx.clip();
      }
      ctx.drawImage(image, box.x, box.y, box.w, box.h);
      ctx.restore();
    }

    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.font = '600 9px "Space Grotesk"';
    ctx.textAlign = "center";
    ctx.fillText(name, x + 17, y - 6);
  }}

export function buildWorld(type = "adventure") {
  const world = { width: 3600, height: 900, gravity: .72 };
  const entities = [];
  const ground = 810;
  entities.push({ type: "platform", x: 0, y: ground, w: 3600, h: 90 });

  const addPlatform = (x, y, w, h = 24, variant = "") => entities.push({ type: "platform", x, y, w, h, variant });
  const addCoin = (x, y) => entities.push({ type: "coin", x, y, w: 24, h: 24 });
  const addHazard = (x, y, w = 40, h = 30) => entities.push({ type: "hazard", x, y, w, h });
  const addGoal = (x, y) => entities.push({ type: "goal", x, y, w: 70, h: 90 });
  const addTree = (x, y) => entities.push({ type: "tree", x, y, w: 80, h: 180 });
  const addRock = (x, y) => entities.push({ type: "rock", x, y, w: 70, h: 45 });

  for (let x = 300; x < 3300; x += 430) addTree(x, ground - 180);
  for (let x = 180; x < 3400; x += 360) addRock(x, ground - 45);

  if (type === "race") {
    for (let x = 280; x < 3200; x += 220) {
      const y = ground - 120 - (x % 3) * 25;
      addPlatform(x, y, 130);
      addCoin(x + 50, y - 45);
    }
  } else if (type === "mine") {
    for (let x = 250; x < 3200; x += 260) {
      addPlatform(x, ground - 120, 150, 24, "stone");
      addRock(x + 45, ground - 165);
      addCoin(x + 100, ground - 205);
    }
  } else {
    for (let x = 220; x < 3200; x += 300) {
      const y = ground - 120 - (x % 4) * 18;
      addPlatform(x, y, 170);
      addCoin(x + 70, y - 45);
    }
  }

  for (let x = 600; x < 3300; x += 510) addHazard(x, ground - 30);
  addGoal(3400, ground - 90);
  return { world, entities };
}

export function buildWorldFromConfig(config = {}) {
  const world = config.world || { width: 3600, height: 900, gravity: .72 };
  const entities = Array.isArray(config.entities) ? config.entities.map(e => ({...e})) : [];
  const spawn = config.spawn || entities.find(e => e.type === "spawn") || { x:150, y:600, w:34, h:52 };
  return { world, entities, spawn };
}
