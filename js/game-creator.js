import{bootShell}from"./nav.js?v=20260919-1426";import{supabase}from"./app.js";import{toast,setBusy}from"./ui.js";
let state=null;
try{state=await bootShell();}catch(error){console.error("KIIZU Studio boot error:",error);}
const $=s=>document.querySelector(s),canvas=$("#studio-canvas");
const ctx=canvas?.getContext("2d");
if(!canvas||!ctx){
  const status=document.querySelector("#status");
  if(status) status.textContent="No se pudo iniciar el lienzo del Studio.";
  toast("El editor no pudo iniciar correctamente.","error");
  throw new Error("KIIZU Studio: canvas unavailable");
}
if(!state){
  const status=document.querySelector("#status");
  if(status) status.textContent="Inicia sesión para guardar y publicar juegos.";
}
let gameId=null,tool="select",selected=null,drag=null,zoom=.8,grid=true,space=false,pan={x:0,y:0},cameraDrag=null,hasBuilt=false;const deleteGameButton=document.querySelector("#delete-game");
const helper=$("#drag-helper"),helperSub=$("#drag-helper-sub");
let helperTimer=null;
function showDragHelper(){
 if(!helper||selected===null)return;
 const e=entities[selected]; if(!e)return;
 helper.classList.add("show");
 helperSub.textContent=labels[e.type] ? labels[e.type]+" seleccionado. Ajusta tamaño, posición o copia sin complicarte." : "Objeto seleccionado. Ajusta lo que necesites.";
 clearTimeout(helperTimer); helperTimer=setTimeout(()=>helper.classList.remove("show"),7000);
}
function hideDragHelper(){if(helper)helper.classList.remove("show")}
function resizeSelected(factor){
 if(selected===null)return;
 const e=entities[selected],min=8,max=900;
 const cx=e.x+e.w/2,cy=e.y+e.h/2;
 e.w=clamp(Math.round(e.w*factor),min,max); e.h=clamp(Math.round(e.h*factor),min,max);
 e.x=clamp(snap(cx-e.w/2),0,world.width-e.w); e.y=clamp(snap(cy-e.h/2),0,world.height-e.h);
 renderList();draw();showDragHelper();
}
function helperAction(action){
 if(selected===null)return;
 const e=entities[selected];
 if(action==="grow")resizeSelected(1.2);
 else if(action==="shrink")resizeSelected(.83);
 else if(action==="center"){e.x=clamp(snap((world.width-e.w)/2),0,world.width-e.w);e.y=clamp(snap((world.height-e.h)/2),0,world.height-e.h);renderList();draw();showDragHelper()}
 else if(action==="snap"){e.x=clamp(snap(e.x),0,world.width-e.w);e.y=clamp(snap(e.y),0,world.height-e.h);renderList();draw();showDragHelper()}
 else if(action==="duplicate"){const copy={...e,x:clamp(snap(e.x+40),0,world.width-e.w),y:clamp(snap(e.y+40),0,world.height-e.h)};entities.push(copy);selected=entities.length-1;renderList();draw();showDragHelper()}
 else if(action==="delete"){entities.splice(selected,1);selected=null;renderList();draw();hideDragHelper()}
 else if(action==="done")hideDragHelper();
}
document.querySelectorAll("[data-helper]").forEach(b=>b.addEventListener("click",()=>helperAction(b.dataset.helper)));

const world={width:3600,height:900,gravity:.72,background:"night"};let entities=[];
const defs={spawn:{w:36,h:54},platform:{w:180,h:24},hazard:{w:70,h:30},enemy:{w:38,h:42},checkpoint:{w:38,h:58},spring:{w:46,h:20},moving:{w:170,h:24},coin:{w:24,h:24},goal:{w:70,h:90},water:{w:220,h:70},tree:{w:80,h:180},rock:{w:70,h:45}};
const labels={spawn:"Aparición",platform:"Plataforma",hazard:"Obstáculo",enemy:"Enemigo",checkpoint:"Checkpoint",spring:"Impulso",moving:"Plataforma móvil",coin:"Moneda",goal:"Meta",water:"Agua",tree:"Árbol",rock:"Roca"};
const base=()=>[];entities=base();
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,r.width*d);canvas.height=Math.max(1,r.height*d);ctx.setTransform(d,0,0,d,0,0);draw()}addEventListener("resize",resize);
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}function snap(v){return grid?Math.round(v/20)*20:v}function screenToWorld(x,y){const r=canvas.getBoundingClientRect();return{x:(x-r.left)/zoom+pan.x,y:(y-r.top)/zoom+pan.y}}function hit(x,y){for(let i=entities.length-1;i>=0;i--){const e=entities[i];if(x>=e.x&&x<=e.x+e.w&&y>=e.y&&y<=e.y+e.h)return i}return-1}
function add(type,x,y){if(!hasBuilt) hasBuilt=true;if(type==="spawn")entities=entities.filter(e=>e.type!=="spawn");const d=defs[type]||defs.platform;const e={type,x:clamp(snap(x),0,world.width-d.w),y:clamp(snap(y),0,world.height-d.h),w:d.w,h:d.h};if(type==="moving"){e.range=220;e.speed=1.2}if(type==="spring")e.power=15;if(type==="platform")e.variant="";entities.push(e);selected=entities.length-1;tool="select";document.querySelectorAll("[data-tool]").forEach(b=>b.classList.toggle("active",b.dataset.tool==="select"));renderList();draw()}
function colorFor(){return getComputedStyle(document.documentElement).getPropertyValue("--text")||"#fff"}
function draw(){const r=canvas.getBoundingClientRect(),w=r.width,h=r.height;ctx.clearRect(0,0,w,h);const bg={night:["#080b10","#151b23"],dusk:["#171217","#2a2522"],forest:["#0b1310","#18221c"],cave:["#07090c","#15181d"]}[world.background]||["#080b10","#151b23"];const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,bg[0]);g.addColorStop(1,bg[1]);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.save();ctx.scale(zoom,zoom);ctx.translate(-pan.x,-pan.y);if(grid){ctx.strokeStyle="rgba(255,255,255,.045)";ctx.lineWidth=1/zoom;for(let x=0;x<=world.width;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,world.height);ctx.stroke()}for(let y=0;y<=world.height;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(world.width,y);ctx.stroke()}}ctx.strokeStyle="rgba(255,255,255,.16)";ctx.strokeRect(0,0,world.width,world.height);for(let i=0;i<entities.length;i++)drawEntity(entities[i],i===selected);ctx.restore();$("#object-count").textContent=entities.length+" objetos"}
function drawEntity(e,sel){const x=e.x,y=e.y,w=e.w,h=e.h;ctx.save();if(e.type==="platform"||e.type==="moving"){ctx.fillStyle=e.type==="moving"?"#56616d":e.variant==="stone"?"#555e68":"#3c4941";ctx.fillRect(x,y,w,h);ctx.fillStyle="rgba(255,255,255,.18)";ctx.fillRect(x,y,w,3)}else if(e.type==="spawn"){ctx.strokeStyle="#e5e9ee";ctx.setLineDash([5,4]);ctx.strokeRect(x,y,w,h);ctx.setLineDash([]);ctx.fillStyle="#fff";ctx.font='700 9px "Space Grotesk"';ctx.textAlign="center";ctx.fillText("START",x+w/2,y-7)}else if(e.type==="hazard"){ctx.fillStyle="#985962";ctx.beginPath();for(let i=0;i<4;i++){ctx.moveTo(x+i*w/4,y+h);ctx.lineTo(x+(i+.5)*w/4,y);ctx.lineTo(x+(i+1)*w/4,y+h)}ctx.fill()}else if(e.type==="enemy"){ctx.fillStyle="#777f89";ctx.beginPath();ctx.roundRect(x,y,w,h,9);ctx.fill();ctx.fillStyle="#171b20";ctx.fillRect(x+8,y+12,6,5);ctx.fillRect(x+24,y+12,6,5)}else if(e.type==="checkpoint"){ctx.strokeStyle="#dce2e8";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+8,y+h);ctx.lineTo(x+8,y);ctx.stroke();ctx.strokeRect(x+8,y,25,18)}else if(e.type==="spring"){ctx.fillStyle="#8b949e";ctx.fillRect(x,y+h-5,w,5);ctx.strokeStyle="#dce2e8";ctx.beginPath();ctx.moveTo(x+5,y+h-5);ctx.lineTo(x+12,y+4);ctx.lineTo(x+23,y+h-5);ctx.lineTo(x+34,y+4);ctx.lineTo(x+41,y+h-5);ctx.stroke()}else if(e.type==="coin"){ctx.fillStyle="#d9dee5";ctx.beginPath();ctx.arc(x+w/2,y+h/2,10,0,Math.PI*2);ctx.fill()}else if(e.type==="goal"){ctx.strokeStyle="#eef1f4";ctx.lineWidth=3;ctx.strokeRect(x,y,w,h);ctx.fillStyle="#fff";ctx.font='600 9px "Space Grotesk"';ctx.textAlign="center";ctx.fillText("META",x+w/2,y+h/2+3)}else if(e.type==="water"){ctx.fillStyle="rgba(112,133,151,.5)";ctx.fillRect(x,y,w,h);ctx.strokeStyle="rgba(220,228,236,.5)";for(let i=0;i<w;i+=30){ctx.beginPath();ctx.moveTo(x+i,y+12);ctx.quadraticCurveTo(x+i+8,y+4,x+i+16,y+12);ctx.stroke()}}else if(e.type==="tree"){ctx.fillStyle="#5b473b";ctx.fillRect(x+34,y+70,12,110);ctx.fillStyle="#405748";ctx.beginPath();ctx.arc(x+40,y+60,38,0,Math.PI*2);ctx.fill()}else if(e.type==="rock"){ctx.fillStyle="#5a626b";ctx.beginPath();ctx.roundRect(x,y,w,h,8);ctx.fill()}if(sel){ctx.strokeStyle="#fff";ctx.lineWidth=2/zoom;ctx.setLineDash([6/zoom,4/zoom]);ctx.strokeRect(x-5,y-5,w+10,h+10);ctx.setLineDash([])}ctx.restore()}
function renderList(){const list=$("#object-list");list.innerHTML="";entities.forEach((e,i)=>{const row=document.createElement("div");row.className="object-row"+(i===selected?" selected":"");const text=document.createElement("span");text.textContent=(i+1)+". "+(labels[e.type]||e.type);const b=document.createElement("button");b.textContent="↗";row.append(text,b);row.onclick=()=>{selected=i;renderList();renderInspector();draw()};list.appendChild(row)});renderInspector()}
function renderInspector(){const box=$("#inspector"),e=entities[selected];if(!e){box.textContent="Selecciona un objeto para editarlo.";return}box.innerHTML="";const form=document.createElement("div");form.className="fields";form.innerHTML='<label>Tipo<input id="i-type" disabled></label><div class="row2"><label>X<input id="i-x" type="number"></label><label>Y<input id="i-y" type="number"></label></div><div class="row2"><label>Ancho<input id="i-w" type="number" min="8"></label><label>Alto<input id="i-h" type="number" min="8"></label></div><div id="extra"></div><button class="button button--ghost button--full danger" id="delete-selected">Eliminar objeto</button>';box.appendChild(form);$("#i-type").value=labels[e.type]||e.type;$("#i-x").value=Math.round(e.x);$("#i-y").value=Math.round(e.y);$("#i-w").value=Math.round(e.w);$("#i-h").value=Math.round(e.h);const extra=$("#extra");if(e.type==="moving")extra.innerHTML='<label>Distancia<input id="i-range" type="number" min="20" max="1000" value="'+(e.range||220)+'"></label>';if(e.type==="spring")extra.innerHTML='<label>Fuerza<input id="i-power" type="number" min="5" max="25" value="'+(e.power||15)+'"></label>';["x","y","w","h"].forEach(k=>$("#i-"+k).addEventListener("input",()=>{e[k]=Number($("#i-"+k).value)||0;e.x=clamp(e.x,0,world.width-e.w);e.y=clamp(e.y,0,world.height-e.h);renderList();draw()}));if(e.type==="moving")$("#i-range").addEventListener("input",()=>e.range=clamp(Number($("#i-range").value)||220,20,1000));if(e.type==="spring")$("#i-power").addEventListener("input",()=>e.power=clamp(Number($("#i-power").value)||15,5,25));$("#delete-selected").onclick=()=>{entities.splice(selected,1);selected=null;renderList();draw()}}
function setTool(v){tool=v;document.querySelectorAll("[data-tool]").forEach(b=>b.classList.toggle("active",b.dataset.tool===v))}
canvas.addEventListener("pointerdown",e=>{if(e.button!==0)return;if(space){cameraDrag={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};canvas.setPointerCapture(e.pointerId);return}const p=screenToWorld(e.clientX,e.clientY);if(tool==="select"){const i=hit(p.x,p.y);selected=i>=0?i:null;if(i>=0){drag={i,dx:p.x-entities[i].x,dy:p.y-entities[i].y};canvas.setPointerCapture(e.pointerId);showDragHelper()}else hideDragHelper();renderList();draw()}else if(tool==="erase"){const i=hit(p.x,p.y);if(i>=0){entities.splice(i,1);selected=null;renderList();draw()}}else add(tool,p.x,p.y)});
canvas.addEventListener("pointermove",e=>{if(cameraDrag){pan.x=Math.max(0,Math.min(world.width-100,cameraDrag.px-(e.clientX-cameraDrag.x)/zoom));pan.y=Math.max(0,Math.min(world.height-100,cameraDrag.py-(e.clientY-cameraDrag.y)/zoom));draw();return}if(!drag)return;const p=screenToWorld(e.clientX,e.clientY),o=entities[drag.i];o.x=clamp(snap(p.x-drag.dx),0,world.width-o.w);o.y=clamp(snap(p.y-drag.dy),0,world.height-o.h);renderList();draw()});canvas.addEventListener("pointerup",()=>{drag=null;cameraDrag=null});canvas.addEventListener("pointercancel",()=>{drag=null;cameraDrag=null});canvas.addEventListener("wheel",e=>{e.preventDefault();zoom=clamp(zoom+(e.deltaY<0?.08:-.08),.35,2);draw()},{passive:false});
addEventListener("keydown",e=>{if(e.code==="Space"){space=true;e.preventDefault()}if((e.key==="Delete"||e.key==="Backspace")&&selected!==null){entities.splice(selected,1);selected=null;renderList();draw();hideDragHelper()}if(selected!==null&&!e.target.matches("input,textarea,select,button")){if(e.key==="+"){e.preventDefault();resizeSelected(1.2)}if(e.key==="-"){e.preventDefault();resizeSelected(.83)}}});addEventListener("keyup",e=>{if(e.code==="Space")space=false});
document.querySelectorAll("[data-tool]").forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
function template(type){
 const maps={
  obby:[["spawn",140,720],["platform",80,780],["platform",340,700],["platform",620,620],["hazard",500,750],["platform",900,540],["checkpoint",1080,480],["platform",1220,620],["hazard",1400,750],["goal",1600,690]],
  coins:[["spawn",140,720],["platform",80,780],["coin",350,650],["coin",600,560],["platform",420,700],["platform",760,620],["coin",900,520],["checkpoint",1120,560],["platform",1240,680],["coin",1450,590],["goal",1650,690]],
  arena:[["spawn",180,700],["platform",100,780],["platform",420,780],["platform",740,780],["enemy",560,735],["enemy",880,735],["platform",1080,650],["checkpoint",1180,590],["goal",1450,690]],
  empty:[]
 };
 entities=[];selected=null;hasBuilt=type!=="empty";
 (maps[type]||[]).forEach(([t,x,y])=>{
  const d=defs[t]||defs.platform;
  const e={type:t,x,y,w:d.w,h:d.h};
  if(t==="moving"){e.range=220;e.speed=1.2}
  if(t==="spring")e.power=15;
  if(t==="platform")e.variant="";
  entities.push(e);
 });
 const names={obby:"Mi Obby",coins:"Caza de monedas",arena:"Arena KIIZU"};
 const descriptions={obby:"Supera los obstáculos y llega a la meta.",coins:"Recoge monedas y llega al final.",arena:"Supera a los enemigos y alcanza la meta."};
 if(type==="empty"){$("#name").value="";$("#description").value="";$("#objective").value="Llega a la meta"}
 else {$("#name").value=names[type];$("#description").value=descriptions[type];$("#objective").value=type==="coins"?"Recoge monedas y llega a la meta":"Llega a la meta"}
 renderList();zoom=.8;pan={x:0,y:0};draw();
 toast(type==="empty"?"Mapa limpio. Ya puedes construir.":"Plantilla cargada. Personalízala y guárdala.","success");
}
document.querySelectorAll("[data-template]").forEach(b=>b.onclick=()=>template(b.dataset.template));
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));$("#objects-panel").hidden=b.dataset.tab!=="objects";$("#world-panel").hidden=b.dataset.tab!=="world"});
$("#grid-toggle").onclick=()=>{grid=!grid;$("#grid-toggle").classList.toggle("active",grid);draw()};$("#zoom-in").onclick=()=>{zoom=clamp(zoom+.1,.35,2);draw()};$("#zoom-out").onclick=()=>{zoom=clamp(zoom-.1,.35,2);draw()};$("#zoom-reset").onclick=()=>{zoom=.8;pan={x:0,y:0};draw()};$("#reset-world").onclick=()=>{entities=base();hasBuilt=false;selected=null;pan={x:0,y:0};zoom=.8;renderList();draw()};$("#apply-world").onclick=()=>{world.width=clamp(Number($("#world-width").value)||3600,1200,10000);world.height=clamp(Number($("#world-height").value)||900,600,2500);world.gravity=clamp(Number($("#gravity").value)||.72,.2,1.5);world.background=$("#background").value;entities.forEach(e=>{e.x=clamp(e.x,0,world.width-e.w);e.y=clamp(e.y,0,world.height-e.h)});draw();toast("Configuración del mundo aplicada.","success")};$("#test-game").onclick=()=>{toast(entities.some(e=>e.type==="spawn")&&entities.some(e=>e.type==="goal")?"Modo prueba preparado. Guarda y publica para jugarlo desde Jugar.":"Coloca spawn y meta antes de probar.","info")};
async function save(publish=false){if(!state)return;const btn=$(publish?"#publish":"#save");setBusy(btn,true,publish?"Publicando...":"Guardando...");try{const name=$("#name").value.trim(),description=$("#description").value.trim(),max=Number($("#max").value),time=Number($("#time").value);if(name.length<2||name.length>60)throw Error("El nombre debe tener entre 2 y 60 caracteres.");if(!entities.some(e=>e.type==="spawn"))throw Error("Coloca un punto de aparición para el personaje.");if(!entities.some(e=>e.type==="goal"))throw Error("Coloca una meta para terminar el juego.");const config={engine:"kiizu-2d",version:3,world:{...world},entities:entities.map(e=>({...e})),spawn:entities.find(e=>e.type==="spawn")||null,objective:$("#objective").value.trim()||"Llega a la meta",time_limit:time};
let thumbnail_url=null; const imageFile=$("#game-image")?.files?.[0]; if(imageFile){ if(imageFile.size>4*1024*1024) throw Error("La imagen debe pesar menos de 4 MB."); const ext=imageFile.type==="image/png"?"png":imageFile.type==="image/webp"?"webp":"jpg"; const path=state.session.user.id+"/"+(gameId||"new")+"."+ext; const {error:uploadError}=await supabase.storage.from("game-media").upload(path,imageFile,{upsert:true,contentType:imageFile.type,cacheControl:"3600"}); if(uploadError) throw uploadError; thumbnail_url=supabase.storage.from("game-media").getPublicUrl(path).data.publicUrl+"?v="+Date.now(); }if(gameId){deleteGameButton?.removeAttribute("hidden");const{error}=await supabase.from("games").update({name,description,max_players:max,game_config:config,...(thumbnail_url?{thumbnail_url}:{})}).eq("id",gameId).eq("creator_id",state.session.user.id);if(error)throw error}else{const{data,error}=await supabase.rpc("create_game",{p_name:name,p_description:description,p_mechanic:"world2d",p_min:1,p_max:max});
if(error)throw error;
const createdGame=Array.isArray(data)?data[0]:data;
gameId=createdGame?.id;
if(!gameId)throw Error("KIIZU no devolvió el juego creado. Inténtalo de nuevo.");deleteGameButton?.removeAttribute("hidden");const{error:e}=await supabase.from("games").update({game_config:config,...(thumbnail_url?{thumbnail_url}:{})}).eq("id",gameId).eq("creator_id",state.session.user.id);if(e)throw e}if(publish){const{error}=await supabase.rpc("publish_game",{p_game_id:gameId});if(error)throw error;$("#status").textContent="Publicado en Jugar."}else $("#status").textContent="Guardado en tus proyectos.";toast($("#status").textContent,"success")}catch(e){$("#status").textContent=e.message||"No se pudo guardar.";toast($("#status").textContent,"error")}finally{setBusy(btn,false)}}$("#save").onclick=()=>save(false);$("#publish").onclick=()=>save(true);
const achievementBox=document.querySelector("#achievement-status");
const achievementList=document.querySelector("#achievement-list");
async function loadAchievements(){
 if(!achievementList||!gameId||!state?.session?.user?.id)return;
 const {data,error}=await supabase.from("game_achievements").select("id,name,description,icon,xp_reward,created_at").eq("game_id",gameId).eq("creator_id",state.session.user.id).order("created_at",{ascending:true});
 if(error){achievementList.innerHTML=""; return;}
 achievementList.innerHTML=data?.length?data.map(a=>`<div class="achievement-row"><span>${a.icon||"🏆"}</span><div><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.description||"")}</small></div><b>+${Number(a.xp_reward||0)} XP</b></div>`).join(""):`<div class="status">Todavía no hay logros creados.</div>`;
}

async function loadGameById(id){
  if(!state?.session?.user?.id || !id) return;
  const {data,error}=await supabase.from("games")
    .select("id,name,description,max_players,game_config,thumbnail_url,is_published")
    .eq("id",id)
    .eq("creator_id",state.session.user.id)
    .maybeSingle();
  if(error) throw error;
  if(!data) throw new Error("No se encontró el juego.");
  const config=data.game_config||{};
  gameId=data.id;
  world.width=clamp(Number(config.world?.width)||3600,1200,10000);
  world.height=clamp(Number(config.world?.height)||900,600,2500);
  world.gravity=clamp(Number(config.world?.gravity)||.72,.2,1.5);
  world.background=config.world?.background||"night";
  entities=Array.isArray(config.entities)?config.entities.map(e=>({...e})): [];
  hasBuilt=entities.length>0;
  selected=null;
  zoom=.8;
  pan={x:0,y:0};
  $("#name").value=data.name||"";
  $("#description").value=data.description||"";
  $("#max").value=clamp(Number(data.max_players)||8,1,8);
  $("#time").value=clamp(Number(config.time_limit)||180,20,900);
  $("#objective").value=config.objective||"Llega a la meta";
  $("#world-width").value=world.width;
  $("#world-height").value=world.height;
  $("#gravity").value=world.gravity;
  $("#background").value=world.background;
  deleteGameButton?.removeAttribute("hidden");
  renderList();
  draw();
  await loadAchievements();
  $("#status").textContent=data.is_published?"Juego publicado cargado.":"Borrador cargado.";
  toast("Proyecto cargado en KIIZU Studio.","success");
}

function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
document.querySelector("#create-achievement")?.addEventListener("click",async()=>{
 if(!gameId){toast("Guarda el juego primero para crear logros.","error");return;}
 const name=document.querySelector("#achievement-name").value.trim(), description=document.querySelector("#achievement-description").value.trim(), xp=Number(document.querySelector("#achievement-xp").value)||10, icon=document.querySelector("#achievement-icon").value.trim()||"🏆";
 if(name.length<2){toast("Ponle un nombre al logro.","error");return;}
 const {error}=await supabase.from("game_achievements").insert({game_id:gameId,creator_id:state.session.user.id,name,description,icon,xp_reward:Math.max(1,Math.min(500,xp)),condition:{}});
 if(error){toast(error.message,"error");return;}
 achievementBox.textContent="Logro creado y guardado."; toast("Logro añadido al juego.","success"); await loadAchievements();
});
renderList();resize(); loadAchievements();
async function deleteGame(){if(!gameId)return;if(!confirm("¿Eliminar este juego? Esta acción no se puede deshacer."))return;const code=prompt("Para confirmar la eliminación, escribe ELIMINAR");if(code!=="ELIMINAR"){toast("Eliminación cancelada.","info");return}setBusy(deleteGameButton,true,"Eliminando...");try{const{error}=await supabase.rpc("delete_own_game",{p_game_id:gameId,p_confirmation:code});if(error)throw error;toast("Juego eliminado.","success");location.reload()}catch(e){toast(e.message||"No se pudo eliminar.","error");setBusy(deleteGameButton,false)}}deleteGameButton?.addEventListener("click",deleteGame);
async function loadMyGames(){
  const box=document.querySelector("#my-games");
  if(!box||!state?.session?.user?.id)return;
  const{data,error}=await supabase.from("games")
    .select("id,name,is_published,created_at")
    .eq("creator_id",state.session.user.id)
    .order("created_at",{ascending:false});
  if(error){
    box.innerHTML='<span class="status">No se pudieron cargar tus juegos.</span>';
    return;
  }
  box.innerHTML=(data||[]).map(g=>'<div class="my-game-row"><div><strong>'+escapeHtml(g.name)+'</strong><small>'+(g.is_published?"Publicado":"Borrador")+'</small></div><div class="my-game-actions"><button class="button button--small button--ghost" type="button" data-edit-game="'+g.id+'">Editar</button><button class="button button--small button--ghost danger" type="button" data-game-id="'+g.id+'">Eliminar</button></div></div>').join("")||'<span class="status">Todavía no tienes juegos guardados.</span>';
  box.querySelectorAll("[data-edit-game]").forEach(b=>b.onclick=async()=>{
    setBusy(b,true,"Cargando...");
    try{await loadGameById(b.dataset.editGame);}
    catch(e){toast(e.message||"No se pudo cargar el juego.","error");}
    finally{setBusy(b,false)}
  });
  box.querySelectorAll("[data-game-id]").forEach(b=>b.onclick=async()=>{
    if(!confirm("¿Eliminar este juego? Esta acción no se puede deshacer."))return;
    const code=prompt("Para confirmar la eliminación, escribe ELIMINAR");
    if(code!=="ELIMINAR"){toast("Eliminación cancelada.","info");return}
    setBusy(b,true,"Eliminando...");
    try{
      const{error}=await supabase.rpc("delete_own_game",{p_game_id:b.dataset.gameId,p_confirmation:code});
      if(error)throw error;
      if(gameId===b.dataset.gameId){gameId=null;entities=[];selected=null;hasBuilt=false;deleteGameButton?.setAttribute("hidden","");renderList();draw();}
      toast("Juego eliminado.","success");
      await loadMyGames();
    }catch(e){toast(e.message||"No se pudo eliminar.","error");setBusy(b,false)}
  });
}