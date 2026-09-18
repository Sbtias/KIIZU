import { supabase } from "./js/app.js";
import { bootShell } from "./js/nav.js?v=20260918-1335";
import { toast } from "./js/ui.js";

const state = await bootShell();
const grid = document.querySelector("#clothing-grid");
const preview = document.querySelector("#avatar-preview");
const summary = document.querySelector("#equipped-summary");

function safe(v){return String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function card(item,equipped){
 const image=item.thumbnail||item.design_data?.thumbnail||"";
 return '<article class="clothing-card">'+(image?'<img src="'+safe(image)+'" alt="">':'<div class="clothing-placeholder">KIIZU</div>')+'<div><span class="eyebrow">'+safe(item.type||"ropa")+'</span><h3>'+safe(item.name)+'</h3><small>'+safe(item.description||"Sin descripción")+'</small></div><button class="button button--small '+(equipped?"":"button--ghost")+'" data-equip="'+item.id+'" data-slot="'+safe(item.type||"shirt")+'">'+(equipped?"Equipada":"Equipar")+'</button></article>';
}
async function load(){
 if(!state)return;
 const uid=state.session.user.id;
 const [owned,created,equipped]=await Promise.all([
   supabase.from("clothing_purchases").select("clothing_items(*)").eq("buyer_id",uid),
   supabase.from("clothing_items").select("*").eq("creator_id",uid),
   supabase.from("equipped_clothing").select("slot,clothing_items(*)").eq("user_id",uid)
 ]);
 if(owned.error)throw owned.error;if(created.error)throw created.error;if(equipped.error)throw equipped.error;
 const map=new Map();
 [...(owned.data||[]).map(x=>x.clothing_items),...(created.data||[]).filter(Boolean)].forEach(x=>{if(x)map.set(x.id,x)});
 const equippedMap=new Map((equipped.data||[]).map(x=>[x.slot,x.clothing_items]));
 grid.innerHTML=[...map.values()].map(x=>card(x,[...equippedMap.values()].some(e=>e?.id===x.id))).join("")||'<div class="empty-state"><h3>No tienes ropa todavía.</h3><p>Crea o compra prendas para personalizarte.</p></div>';
 summary.textContent=[...equippedMap.entries()].map(([slot,item])=>slot+": "+(item?.name||"—")).join(" · ")||"Nada equipado";
 preview.innerHTML='<div class="avatar-preview-body"></div>';
 const images=[...equippedMap.values()].filter(Boolean).map(x=>x.thumbnail||x.design_data?.thumbnail).filter(Boolean);
 images.forEach(src=>{const img=document.createElement("img");img.src=src;img.alt="";preview.appendChild(img)});
 grid.querySelectorAll("[data-equip]").forEach(btn=>btn.addEventListener("click",async()=>{
   const {error}=await supabase.rpc("equip_clothing",{p_clothing_id:btn.dataset.equip});
   if(error){toast(error.message,"error");return}
   toast("Ropa equipada.","success");await load();
 }));
}
try{await load()}catch(e){toast(e.message||"No se pudo cargar tu ropa.","error");}