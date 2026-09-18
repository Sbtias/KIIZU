import { supabase } from "./app.js";
import { bootShell } from "./nav.js";
import { toast, setBusy } from "./ui.js";

const state=await bootShell();
const grid=document.querySelector("#shop-grid");
let filter="all";

async function load(){
 if(!state||!grid)return;
 grid.innerHTML='<div class="empty-state"><h3>Cargando marketplace...</h3></div>';
 const [{data:items,error:itemError},{data:clothing,error:clothingError}]=await Promise.all([
   supabase.from("items").select("*").order("price"),
   supabase.from("clothing_items").select("id,creator_id,name,description,type,price,design_data,created_at,profiles(username)").eq("is_published",true).order("created_at",{ascending:false})
 ]);
 if(itemError)throw itemError;if(clothingError)throw clothingError;
 const likes=clothing?.length?await Promise.all(clothing.map(async c=>{
   const [{count},mine]=await Promise.all([
     supabase.from("clothing_likes").select("user_id",{count:"exact",head:true}).eq("clothing_id",c.id),
     supabase.from("clothing_likes").select("user_id").eq("clothing_id",c.id).eq("user_id",state.session.user.id).maybeSingle()
   ]));
   return [c.id,{count:count??0,mine:!!mine}];
 })):[];

 grid.innerHTML="";
 const published=clothing||[];
 if(!items?.length&&!published.length){grid.innerHTML='<div class="empty-state"><h3>Marketplace vacío</h3><p>Todavía no hay objetos publicados.</p></div>';return;}

 for(const item of items||[]) grid.appendChild(officialCard(item));
 for(const c of published) grid.appendChild(clothingCard(c,new Map(likes).get(c.id)||{count:0,mine:false}));
}

function officialCard(item){
 const card=document.createElement("article");card.className="item-card";
 card.innerHTML='<div class="item-art">✦</div><div><span class="eyebrow">'+item.category+'</span><h3>'+escapeHtml(item.name)+'</h3><p>'+Number(item.price).toLocaleString()+' 🪙</p></div><button class="button button--small">Comprar</button>';
 const b=card.querySelector("button");
 b.onclick=async()=>{setBusy(b,true,"Comprando...");try{const{error}=await supabase.rpc("purchase_item",{p_item_id:item.id});if(error)throw error;toast(item.name+" añadido al inventario.","success");await load();}catch(e){toast(readableError(e),"error");setBusy(b,false);}};
 return card;
}
function clothingCard(c,like){
 const card=document.createElement("article");card.className="item-card clothing-card";
 card.innerHTML='<div class="item-art clothing-preview"></div><div><span class="eyebrow">'+escapeHtml(c.type)+' · por '+escapeHtml(c.profiles?.username||"Usuario")+'</span><h3>'+escapeHtml(c.name)+'</h3><p>'+Number(c.price).toLocaleString()+' 🪙 · <span class="like-count">'+like.count+'</span> likes</p></div><div class="tool-row"><button class="button button--small like-btn">'+(like.mine?"♥":"♡")+'</button><button class="button button--small buy-btn">Comprar</button></div>';
 const preview=card.querySelector(".clothing-preview");
 try{const img=c.design_data?.layers?.[0]?.data;if(img)preview.style.backgroundImage="url("+img+")";}catch{}
 card.querySelector(".like-btn").onclick=async e=>{setBusy(e.currentTarget,true,"...");try{const{data,error}=await supabase.rpc("toggle_clothing_like",{p_clothing_id:c.id});if(error)throw error;like.mine=data;like.count+=data?1:-1;card.querySelector(".like-btn").textContent=data?"♥":"♡";card.querySelector(".like-count").textContent=like.count;}catch(err){toast(readableError(err),"error")}finally{setBusy(e.currentTarget,false);}};
 card.querySelector(".buy-btn").onclick=async e=>{setBusy(e.currentTarget,true,"Comprando...");try{const{error}=await supabase.rpc("purchase_clothing",{p_clothing_id:c.id});if(error)throw error;toast(c.name+" añadido a tu inventario.","success");await load();}catch(err){toast(readableError(err),"error");setBusy(e.currentTarget,false);}};
 return card;
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function readableError(e){const m=e?.message||"No se pudo completar la operación.";return m.includes("INSUFFICIENT_COINS")?"No tienes suficientes Coins.":m.includes("ALREADY_OWNED")?"Ya tienes este objeto.":m;}
load().catch(e=>{grid.innerHTML='<div class="empty-state"><h3>No se pudo cargar el marketplace</h3><p>Revisa tu conexión e inténtalo de nuevo.</p></div>';toast(e.message,"error");});