import{bootShell}from"./nav.js?v=20260918-1335";import{supabase}from"./app.js";import{toast,setBusy}from"./ui.js";
const state=await bootShell(),grid=document.querySelector("#inventory-grid");
if(state){try{
 const [{data:official,error:e1},{data:created,error:e2},{data:equipped,error:e3}]=await Promise.all([
  supabase.from("inventory").select("item_id,items(*)").eq("user_id",state.session.user.id),
  supabase.from("clothing_inventory").select("clothing_id,clothing_items(*)").eq("user_id",state.session.user.id),
  supabase.from("equipped_clothing").select("clothing_id,slot").eq("user_id",state.session.user.id)
 ]);
 if(e1||e2||e3)throw e1||e2||e3;
 const eq=new Map((equipped||[]).map(x=>[x.clothing_id,x.slot]));
 const all=[];
 for(const x of official||[])all.push('<article class="item-card"><div class="item-art">✦</div><div><span class="eyebrow">'+x.items.category+'</span><h3>'+safe(x.items.name)+'</h3><p>Objeto oficial</p></div></article>');
 for(const x of created||[]){const c=x.clothing_items;const slot=eq.get(c.id);const img=c.design_data?.layers?.[0]?.data;all.push('<article class="item-card"><div class="item-art clothing-preview" style="'+(img?'background-image:url('+img+');':'')+'"></div><div><span class="eyebrow">'+safe(c.type)+'</span><h3>'+safe(c.name)+'</h3><p>'+(slot?'Equipado':'En colección')+'</p></div><button class="button button--small">'+(slot?'Quitar':'Equipar')+'</button></article>');}
 if(!all.length)grid.innerHTML='<div class="empty-state"><h3>Todavía no tienes objetos.</h3><p>Compra o crea tu primera prenda.</p><a class="button button--small" href="shop.html">Ver marketplace</a></div>';else{grid.innerHTML=all.join("");const buttons=[...grid.querySelectorAll("button")];buttons.forEach((b,i)=>{if(i<(official||[]).length)return;const c=(created||[])[i-(official||[]).length].clothing_items;const slot=eq.get(c.id);b.onclick=async()=>{setBusy(b,true,"Guardando...");try{const{error}=slot?await supabase.rpc("unequip_clothing",{p_slot:slot}):await supabase.rpc("equip_clothing",{p_clothing_id:c.id});if(error)throw error;await location.reload()}catch(e){toast(e.message||"No se pudo actualizar el equipamiento.","error");setBusy(b,false)}}})}
}catch(e){grid.innerHTML='<div class="empty-state"><h3>No se pudo cargar el inventario.</h3><p>Comprueba tu conexión.</p></div>';toast(e.message,"error")}}
function safe(v){return String(v??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]))}