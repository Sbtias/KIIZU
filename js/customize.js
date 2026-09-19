import { supabase } from "./app.js";
import { bootShell } from "./nav.js?v=20260919-1426";
import { toast } from "./ui.js";

const state = await bootShell();
const grid=document.querySelector("#clothing-grid");
const tabs=document.querySelector("#clothing-tabs");
const layers=document.querySelector("#avatar-layers");
const summary=document.querySelector("#equipped-summary");

const CATEGORIES=[
 {id:"all",label:"Todo",types:[]},
 {id:"camiseta",label:"Camisetas",types:["camiseta"]},
 {id:"camisa",label:"Camisas",types:["camisa"]},
 {id:"sudadera",label:"Sudaderas",types:["sudadera"]},
 {id:"pantalon",label:"Pantalones",types:["pantalon"]},
 {id:"gorra",label:"Sombreros",types:["gorra"]},
 {id:"accesorio",label:"Accesorios",types:["accesorio"]},
];
let allItems=[];
let equippedMap=new Map();
let activeCategory="all";
const body={height:100,width:100,head:100,shoulders:100,legs:100};
const rig=document.querySelector("#avatar-rig");
const bodyControls={height:document.querySelector("#body-height"),width:document.querySelector("#body-width"),head:document.querySelector("#body-head"),shoulders:document.querySelector("#body-shoulders"),legs:document.querySelector("#body-legs")};
const bodyValues={height:document.querySelector("#height-value"),width:document.querySelector("#width-value"),head:document.querySelector("#head-value"),shoulders:document.querySelector("#shoulder-value"),legs:document.querySelector("#leg-value")};
function applyBody(){if(!rig)return;Object.keys(bodyControls).forEach(k=>{body[k]=Number(bodyControls[k]?.value||100);if(bodyValues[k])bodyValues[k].textContent=body[k]+"%";});rig.style.setProperty("--body-height",body.height/100);rig.style.setProperty("--body-width",body.width/100);rig.style.setProperty("--body-head",body.head/100);rig.style.setProperty("--body-shoulders",body.shoulders/100);rig.style.setProperty("--body-legs",body.legs/100);}
Object.entries(bodyControls).forEach(([k,input])=>input?.addEventListener("input",applyBody));
document.querySelector("#body-reset")?.addEventListener("click",()=>{Object.values(bodyControls).forEach(x=>{if(x)x.value=100});applyBody();});
applyBody();

function safe(v){return String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function typeOf(item){return String(item?.type||"camiseta").toLowerCase();}
function imageOf(item){return item?.thumbnail||item?.design_data?.thumbnail||item?.design_data?.layers?.find(l=>l?.data)?.data||"";}
function labelOf(type){return CATEGORIES.find(c=>c.types.includes(type))?.label||type;}

function renderTabs(){
 tabs.innerHTML=CATEGORIES.map(c=>'<button type="button" class="clothing-tab '+(activeCategory===c.id?"is-active":"")+'" data-category="'+c.id+'">'+safe(c.label)+'</button>').join("");
 tabs.querySelectorAll("[data-category]").forEach(btn=>btn.addEventListener("click",()=>{activeCategory=btn.dataset.category;renderTabs();renderGrid();}));
}

function card(item){
 const type=typeOf(item), image=imageOf(item), equipped=equippedMap.get(type)?.id===item.id;
 return '<article class="clothing-card customize-clothing-card '+(equipped?"is-equipped":"")+'">'+
  '<div class="customize-item-preview">'+(image?'<img src="'+safe(image)+'" alt="">':'<span>KIIZU</span>')+'</div>'+
  '<div class="customize-item-copy"><span class="eyebrow">'+safe(labelOf(type))+'</span><h3>'+safe(item.name)+'</h3><small>'+safe(item.description||"Sin descripción")+'</small></div>'+
  '<button class="button button--small '+(equipped?"":"button--ghost")+'" data-equip="'+safe(item.id)+'">'+(equipped?"Equipada":"Equipar")+'</button>'+
 '</article>';
}

function renderGrid(){
 const category=CATEGORIES.find(c=>c.id===activeCategory);
 const items=category?.types?.length?allItems.filter(x=>category.types.includes(typeOf(x))):allItems;
 grid.innerHTML=items.map(card).join("")||'<div class="empty-state"><h3>No hay prendas en esta sección.</h3><p>Crea o compra algo y aparecerá aquí.</p></div>';
 grid.querySelectorAll("[data-equip]").forEach(btn=>btn.addEventListener("click",equip));
}

function renderCharacter(){
 layers.innerHTML="";
 const order=["pantalon","camiseta","camisa","sudadera","accesorio","gorra"];
 order.forEach(type=>{
  const item=equippedMap.get(type); if(!item)return;
  const src=imageOf(item); if(!src)return;
  const img=document.createElement("img");
  img.src=src; img.alt=item.name||""; img.className="avatar-clothing-layer avatar-layer-"+type;
  layers.appendChild(img);
 });
 const names=[...equippedMap.entries()].map(([slot,item])=>labelOf(slot)+": "+(item?.name||"—"));
 summary.innerHTML=names.length?'<span>Equipado</span><small>'+safe(names.join(" · "))+'</small>':'<span>Nada equipado todavía</span><small>Elige una categoría para empezar.</small>';
}

async function equip(event){
 const btn=event.currentTarget;
 btn.disabled=true;
 const {error}=await supabase.rpc("equip_clothing",{p_clothing_id:btn.dataset.equip});
 btn.disabled=false;
 if(error){toast(error.message,"error");return;}
 toast("Ropa equipada.","success");
 await load();
}

async function load(){
 if(!state?.session?.user?.id||!grid)return;
 const uid=state.session.user.id;
 const [owned,created,equipped]=await Promise.all([
  supabase.from("clothing_purchases").select("clothing_items(*)").eq("buyer_id",uid),
  supabase.from("clothing_items").select("*").eq("creator_id",uid).order("created_at",{ascending:false}),
  supabase.from("equipped_clothing").select("slot,clothing_items(*)").eq("user_id",uid)
 ]);
 if(owned.error)throw owned.error;
 if(created.error)throw created.error;
 if(equipped.error)throw equipped.error;
 const map=new Map();
 [...(owned.data||[]).map(x=>x.clothing_items),...(created.data||[])].forEach(x=>{if(x)map.set(x.id,x);});
 allItems=[...map.values()];
 equippedMap=new Map((equipped.data||[]).map(x=>[String(x.slot||"").toLowerCase(),x.clothing_items]).filter(([,item])=>item));
 renderTabs(); renderGrid(); renderCharacter();
}
try{await load()}catch(e){toast(e.message||"No se pudo cargar tu personalización.","error");}