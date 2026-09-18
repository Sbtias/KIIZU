import{bootShell}from"./nav.js?v=20260918-1335";import{supabase}from"./app.js";import{toast,setBusy}from"./ui.js";import{buildWorld}from"./game-engine.js";
const state=await bootShell();let id=null;const $=s=>document.querySelector(s);
const canvas=$("#creator-preview"),ctx=canvas?.getContext("2d");
function world(){return document.querySelector('input[name="world"]:checked')?.value||"adventure"}
function preview(){if(!canvas)return;const type=world(),built=buildWorld(type),w=canvas.clientWidth||500,h=canvas.clientHeight||360,dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#090b10";ctx.fillRect(0,0,w,h);const sx=w/built.world.width,sy=h/built.world.height;ctx.save();ctx.scale(sx,sy);for(const e of built.entities){if(e.type==="platform"){ctx.fillStyle=e.variant==="stone"?"#424a53":"#343d37";ctx.fillRect(e.x,e.y,e.w,e.h)}else if(e.type==="coin"&&!e.collected){ctx.fillStyle="#d7dce4";ctx.beginPath();ctx.arc(e.x+12,e.y+12,9,0,Math.PI*2);ctx.fill()}else if(e.type==="tree"){ctx.fillStyle="#5b473b";ctx.fillRect(e.x+34,e.y+72,12,108);ctx.fillStyle="#3b5145";ctx.beginPath();ctx.arc(e.x+40,e.y+58,34,0,Math.PI*2);ctx.fill()}else if(e.type==="rock"){ctx.fillStyle="#505861";ctx.fillRect(e.x,e.y,e.w,e.h)}else if(e.type==="hazard"){ctx.fillStyle="#7d4b52";ctx.beginPath();ctx.moveTo(e.x,e.y+e.h);ctx.lineTo(e.x+e.w/2,e.y);ctx.lineTo(e.x+e.w,e.y+e.h);ctx.fill()}else if(e.type==="goal"){ctx.strokeStyle="#fff";ctx.strokeRect(e.x,e.y,e.w,e.h)}}ctx.restore()}
async function save(publish=false){
 if(!state)return;
 const btn=$(publish?"#publish":"#save");setBusy(btn,true,publish?"Publicando...":"Guardando...");
 try{
  const n=$("#name").value.trim(),d=$("#description").value.trim(),min=Number($("#min").value),max=Number($("#max").value),time=Number($("#time").value),objective=$("#objective").value.trim()||"Llega a la meta",w=world();
  if(n.length<2||n.length>60)throw new Error("El nombre debe tener entre 2 y 60 caracteres.");
  if(min<1||max<min||max>8)throw new Error("Revisa el número de jugadores.");
  if(time<20||time>600)throw new Error("El tiempo debe estar entre 20 y 600 segundos.");
  const config={engine:"kiizu-2d",world:w,objective:objective,time_limit:time,version:1};
  if(id){
   const{error}=await supabase.from("games").update({name:n,description:d,min_players:min,max_players:max,game_config:config}).eq("id",id).eq("creator_id",state.session.user.id);if(error)throw error;
  }else{
   const{data,error}=await supabase.rpc("create_game",{p_name:n,p_description:d,p_mechanic:"world2d",p_min:min,p_max:max});if(error)throw error;
   id=data.id;const{error:e}=await supabase.from("games").update({game_config:config}).eq("id",id).eq("creator_id",state.session.user.id);if(e)throw e;
  }
  if(publish){const{error}=await supabase.rpc("publish_game",{p_game_id:id});if(error)throw error;$("#status").textContent="Publicado. Tu mundo ya forma parte de KIIZU."}else $("#status").textContent="Mundo guardado.";
  toast($("#status").textContent,"success");
 }catch(e){toast(e.message||"No se pudo guardar.","error")}finally{setBusy(btn,false)}
}
$("#save").onclick=()=>save(false);$("#publish").onclick=()=>save(true);document.querySelectorAll('input[name="world"]').forEach(x=>x.addEventListener("change",preview));addEventListener("resize",preview);preview();