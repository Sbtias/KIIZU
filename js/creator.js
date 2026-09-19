import { supabase } from "./app.js";
import { bootShell } from "./nav.js?v=20260919-1426";
import { toast, setBusy } from "./ui.js";

const state = await bootShell();
const canvas = document.querySelector("#design");
const ctx = canvas?.getContext("2d");
const art = document.createElement("canvas");
art.width = 640; art.height = 640;
const artCtx = art.getContext("2d");
const color = document.querySelector("#color");
const type = document.querySelector("#type");
const name = document.querySelector("#name");
const description = document.querySelector("#description");
const price = document.querySelector("#price");
const textValue = document.querySelector("#text-value");
const status = document.querySelector("#creator-status");
const previewTitle = document.querySelector("#preview-title");
const deleteButton = document.querySelector("#delete-creation");
const myClothes = document.querySelector("#my-clothes");
const zoomLabel = document.querySelector("#zoom-label");

let tool = "brush";
let zoom = 1;
let currentId = null;
let history = [];
let redoStack = [];
let drawing = false;
let startPoint = null;
let activeColor = "#171b24";

const GARMENTS = {
  camiseta: "Camiseta",
  camisa: "Camisa",
  pantalon: "Pantalón",
  sudadera: "Sudadera",
  gorra: "Gorra",
  accesorio: "Accesorio"
};

function garmentPath(c, kind = type.value) {
  c.beginPath();
  if (kind === "pantalon") {
    c.moveTo(190,120); c.lineTo(450,120); c.lineTo(438,285); c.lineTo(365,285); c.lineTo(350,540); c.lineTo(290,540); c.lineTo(278,320); c.lineTo(255,540); c.lineTo(195,540); c.lineTo(180,285); c.closePath();
  } else if (kind === "gorra") {
    c.moveTo(205,310); c.quadraticCurveTo(205,165,320,145); c.quadraticCurveTo(435,165,435,310); c.quadraticCurveTo(325,350,205,310); c.closePath();
  } else if (kind === "accesorio") {
    c.moveTo(240,185); c.lineTo(400,185); c.quadraticCurveTo(455,185,455,240); c.lineTo(455,400); c.quadraticCurveTo(455,455,400,455); c.lineTo(240,455); c.quadraticCurveTo(185,455,185,400); c.lineTo(185,240); c.quadraticCurveTo(185,185,240,185); c.closePath();
  } else if (kind === "sudadera") {
    c.moveTo(235,125); c.lineTo(180,165); c.lineTo(95,270); c.lineTo(145,330); c.lineTo(205,275); c.lineTo(205,535); c.lineTo(435,535); c.lineTo(435,275); c.lineTo(495,330); c.lineTo(545,270); c.lineTo(460,165); c.lineTo(405,125); c.quadraticCurveTo(320,175,235,125); c.closePath();
  } else {
    c.moveTo(240,120); c.lineTo(180,155); c.lineTo(90,270); c.lineTo(145,320); c.lineTo(205,260); c.lineTo(205,525); c.lineTo(435,525); c.lineTo(435,260); c.lineTo(495,320); c.lineTo(550,270); c.lineTo(460,155); c.lineTo(400,120); c.quadraticCurveTo(320,170,240,120); c.closePath();
  }
}

function garmentDetails(c, kind = type.value) {
  c.save();
  c.strokeStyle = "rgba(255,255,255,.18)";
  c.lineWidth = 4;
  c.lineJoin = "round";
  if (kind === "gorra") {
    c.beginPath(); c.moveTo(205,310); c.quadraticCurveTo(320,350,435,310); c.stroke();
    c.beginPath(); c.ellipse(320,300,92,34,0,0,Math.PI*2); c.stroke();
  } else if (kind === "accesorio") {
    c.strokeRect(235,235,170,170);
  } else {
    c.beginPath();
    if (kind === "pantalon") {
      c.moveTo(278,120); c.lineTo(290,540); c.moveTo(350,120); c.lineTo(350,540);
    } else {
      c.moveTo(270,125); c.quadraticCurveTo(320,170,370,125);
    }
    c.stroke();
  }
  c.restore();
}

function render() {
  if (!ctx) return;
  ctx.clearRect(0,0,640,640);
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.025)";
  ctx.fillRect(0,0,640,640);
  garmentPath(ctx);
  ctx.fillStyle = activeColor;
  ctx.shadowColor = "rgba(0,0,0,.32)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 16;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.save();
  garmentPath(ctx);
  ctx.clip();
  ctx.drawImage(art,0,0);
  ctx.restore();
  garmentDetails(ctx);
  ctx.restore();
}

function snapshot() {
  history.push(artCtx.getImageData(0,0,640,640));
  if (history.length > 30) history.shift();
  redoStack = [];
}

function restore(img) {
  artCtx.clearRect(0,0,640,640);
  if (img) artCtx.putImageData(img,0,0);
  render();
}

function resetArt() {
  artCtx.clearRect(0,0,640,640);
  history = [];
  redoStack = [];
  render();
}

function pointer(e) {
  const r = canvas.getBoundingClientRect();
  return {x:(e.clientX-r.left) * 640/r.width, y:(e.clientY-r.top) * 640/r.height};
}

function applyShape(p) {
  const x=Math.min(startPoint.x,p.x), y=Math.min(startPoint.y,p.y);
  const w=Math.abs(p.x-startPoint.x), h=Math.abs(p.y-startPoint.y);
  artCtx.strokeStyle=activeColor;
  artCtx.lineWidth=10;
  artCtx.lineCap="round";
  if(tool==="rect") artCtx.strokeRect(x,y,w,h);
  else { artCtx.beginPath(); artCtx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2); artCtx.stroke(); }
}

function fillAt(sx,sy) {
  const img=artCtx.getImageData(0,0,640,640), d=img.data;
  const i=(sy*640+sx)*4, base=[d[i],d[i+1],d[i+2],d[i+3]], target=hexToRgba(activeColor);
  if(base.every((v,k)=>Math.abs(v-target[k])<5)) return;
  const stack=[[sx,sy]], seen=new Uint8Array(640*640);
  while(stack.length){
    const [x,y]=stack.pop();
    if(x<0||y<0||x>=640||y>=640) continue;
    const p=y*640+x;
    if(seen[p]) continue;
    const q=p*4;
    if(Math.abs(d[q]-base[0])>8||Math.abs(d[q+1]-base[1])>8||Math.abs(d[q+2]-base[2])>8||Math.abs(d[q+3]-base[3])>8) continue;
    seen[p]=1;
    d[q]=target[0];d[q+1]=target[1];d[q+2]=target[2];d[q+3]=255;
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  artCtx.putImageData(img,0,0);
}

function start(e) {
  e.preventDefault();
  const p=pointer(e);
  if(canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  if(tool==="fill"){snapshot();fillAt(Math.floor(p.x),Math.floor(p.y));render();return;}
  if(tool==="text"){
    const value=textValue?.value.trim();
    if(!value){toast("Escribe el texto primero.","info");return;}
    snapshot();
    artCtx.fillStyle=activeColor;
    artCtx.font="800 38px 'Space Grotesk',sans-serif";
    artCtx.textAlign="center";
    artCtx.textBaseline="middle";
    artCtx.fillText(value,p.x,p.y);
    artCtx.textAlign="start";
    render();
    return;
  }
  snapshot();
  drawing=true;
  startPoint=p;
  artCtx.beginPath();
  artCtx.moveTo(p.x,p.y);
}

function move(e) {
  if(!drawing)return;
  e.preventDefault();
  const p=pointer(e);
  if(tool==="rect"||tool==="circle"){
    const previous=history[history.length-1];
    if(previous) artCtx.putImageData(previous,0,0);
    applyShape(p);
    render();
    return;
  }
  artCtx.lineCap="round";
  artCtx.lineJoin="round";
  artCtx.lineWidth=tool==="eraser"?34:10;
  if(tool==="eraser"){
    artCtx.globalCompositeOperation="destination-out";
    artCtx.strokeStyle="rgba(0,0,0,1)";
  } else {
    artCtx.globalCompositeOperation="source-over";
    artCtx.strokeStyle=activeColor;
  }
  artCtx.lineTo(p.x,p.y);
  artCtx.stroke();
  artCtx.globalCompositeOperation="source-over";
  render();
}

function end(e){
  if(!drawing)return;
  drawing=false;
  artCtx.closePath();
  if(canvas.releasePointerCapture && e?.pointerId!=null){try{canvas.releasePointerCapture(e.pointerId)}catch{}}
  render();
}

function setTool(next){
  tool=next;
  document.querySelectorAll(".creator-tool").forEach(btn=>btn.classList.toggle("is-active",btn.dataset.tool===next));
}

function hexToRgba(hex){
  const n=parseInt(hex.slice(1),16);
  return [(n>>16)&255,(n>>8)&255,n&255,255];
}

function data(){
  return {version:2,canvas:{width:640,height:640},garment:type.value,baseColor:activeColor,layers:[{id:"art",type:"raster",data:art.toDataURL("image/png")}]};
}

function thumbnail(){return canvas.toDataURL("image/png");}

async function loadMyClothes(){
  if(!myClothes||!state)return;
  const {data,error}=await supabase.from("clothing_items").select("id,name,type,price,is_published,created_at").eq("creator_id",state.session.user.id).order("created_at",{ascending:false});
  if(error){myClothes.innerHTML='<div class="status">No se pudieron cargar tus prendas.</div>';return;}
  myClothes.innerHTML=(data||[]).map(c=>'<article class="my-clothing-row"><div class="my-clothing-mini"><div class="my-clothing-swatch" data-type="'+escapeHtml(c.type)+'"></div><div><strong>'+escapeHtml(c.name)+'</strong><small>'+escapeHtml(GARMENTS[c.type]||c.type)+' · '+(c.is_published?"Publicado":"Borrador")+' · '+Number(c.price||0).toLocaleString()+' Coins</small></div></div><button type="button" class="button button--small button--ghost danger" data-clothing-id="'+c.id+'">Eliminar</button></article>').join("")||'<div class="status">Todavía no tienes prendas guardadas.</div>';
  myClothes.querySelectorAll("[data-clothing-id]").forEach(b=>b.onclick=()=>deleteClothing(b.dataset.clothingId,b));
}

function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

function confirmInApp(title,message,danger="Eliminar"){
  return new Promise(resolve=>{
    const wrap=document.createElement("div");
    wrap.className="kiizu-confirm-backdrop";
    wrap.innerHTML='<div class="kiizu-confirm" role="dialog" aria-modal="true"><div class="kiizu-confirm-icon">!</div><h3>'+escapeHtml(title)+'</h3><p>'+escapeHtml(message)+'</p><div class="kiizu-confirm-actions"><button type="button" class="kiizu-confirm-cancel">Cancelar</button><button type="button" class="kiizu-confirm-danger">'+escapeHtml(danger)+'</button></div></div>';
    document.body.appendChild(wrap);
    const finish=value=>{wrap.remove();resolve(value);};
    wrap.querySelector(".kiizu-confirm-cancel").onclick=()=>finish(false);
    wrap.querySelector(".kiizu-confirm-danger").onclick=()=>finish(true);
    wrap.addEventListener("click",e=>{if(e.target===wrap)finish(false)});
  });
}

async function deleteClothing(id,button){
  if(!(await confirmInApp("Eliminar creación","Esta prenda se eliminará de tus creaciones. Esta acción no se puede deshacer.","Eliminar"))){return;}
  setBusy(button,true,"Eliminando...");
  try{
    const {error}=await supabase.rpc("delete_own_clothing",{p_clothing_id:id,p_confirmation:"ELIMINAR"});
    if(error)throw error;
    if(currentId===id){currentId=null;deleteButton?.setAttribute("hidden","");resetArt();}
    toast("Prenda eliminada.","success");
    await loadMyClothes();
  }catch(e){toast(e.message||"No se pudo eliminar.","error");}
  finally{setBusy(button,false);}
}

async function save(publish=false){
  if(!state)return;
  if(!name.value.trim()){toast("Ponle un nombre a tu creación.","error");return;}
  const btn=document.querySelector(publish?"#publish":"#save");
  setBusy(btn,true,publish?"Publicando...":"Guardando...");
  try{
    const payload={
      creator_id:state.session.user.id,
      name:name.value.trim(),
      description:description.value.trim(),
      type:type.value,
      price:Math.max(0,Math.min(100000,Number(price.value)||0)),
      design_data:data(),
      thumbnail:thumbnail(),
      is_published:publish
    };
    const result=currentId
      ? await supabase.from("clothing_items").update(payload).eq("id",currentId).select().single()
      : await supabase.from("clothing_items").insert(payload).select().single();
    if(result.error)throw result.error;
    currentId=result.data.id;
    deleteButton?.removeAttribute("hidden");
    status.textContent=publish?"Publicado en Marketplace.":"Guardado en tus creaciones.";
    toast(status.textContent,"success");
    await loadMyClothes();
  }catch(e){toast(e.message||"No se pudo guardar.","error");}
  finally{setBusy(btn,false);}
}

document.querySelectorAll(".creator-tool").forEach(btn=>btn.addEventListener("click",()=>setTool(btn.dataset.tool)));
function setColor(value){
  const next=String(value||"").trim().toLowerCase();
  if(!/^#[0-9a-f]{6}$/.test(next)) return;
  activeColor=next;
  if(color) color.value=next;
  document.querySelectorAll("[data-color]").forEach(btn=>btn.classList.toggle("is-selected",btn.dataset.color.toLowerCase()===next));
  render();
}
document.querySelectorAll("[data-color]").forEach(btn=>btn.addEventListener("click",()=>setColor(btn.dataset.color)));
color?.addEventListener("input",e=>setColor(e.target.value));
color?.addEventListener("change",e=>setColor(e.target.value));
setColor(color?.value||activeColor);
type?.addEventListener("change",()=>{previewTitle.textContent=GARMENTS[type.value]||type.value;resetArt();});
canvas?.addEventListener("pointerdown",start);
canvas?.addEventListener("pointermove",move);
window.addEventListener("pointerup",end);

document.querySelector("#undo")?.addEventListener("click",()=>{
  if(!history.length)return;
  redoStack.push(artCtx.getImageData(0,0,640,640));
  restore(history.pop());
});
document.querySelector("#redo")?.addEventListener("click",()=>{
  if(!redoStack.length)return;
  history.push(artCtx.getImageData(0,0,640,640));
  restore(redoStack.pop());
});
document.querySelector("#clear")?.addEventListener("click",()=>{snapshot();resetArt();});
document.querySelector("#zoom-in")?.addEventListener("click",()=>{zoom=Math.min(1.5,zoom+.1);canvas.style.transform="scale("+zoom+")";zoomLabel.textContent=Math.round(zoom*100)+"%";});
document.querySelector("#zoom-out")?.addEventListener("click",()=>{zoom=Math.max(.75,zoom-.1);canvas.style.transform="scale("+zoom+")";zoomLabel.textContent=Math.round(zoom*100)+"%";});
document.querySelector("#fit")?.addEventListener("click",()=>{zoom=1;canvas.style.transform="scale(1)";zoomLabel.textContent="100%";});

document.querySelector("#save")?.addEventListener("click",()=>save(false));
document.querySelector("#publish")?.addEventListener("click",()=>save(true));
deleteButton?.addEventListener("click",()=>currentId&&deleteClothing(currentId,deleteButton));

resetArt();
loadMyClothes();