import{bootShell}from"./nav.js";import{supabase}from"./app.js";import{toast,setBusy}from"./ui.js";
const state=await bootShell();let id=null;const $=s=>document.querySelector(s);
async function save(publish=false){
 if(!state)return;
 const btn=$(publish?"#publish":"#save");setBusy(btn,true,publish?"Publicando...":"Guardando...");
 try{
  const n=$("#name").value.trim(),d=$("#description").value.trim(),min=Number($("#min").value),max=Number($("#max").value),target=Number($("#target").value),time=Number($("#time").value),mech=$("#mechanic").value;
  if(n.length<2||n.length>60)throw new Error("El nombre debe tener entre 2 y 60 caracteres.");
  if(min<1||max<min||max>8)throw new Error("Revisa el número de jugadores.");
  if(target<1||target>100)throw new Error("El objetivo debe estar entre 1 y 100.");
  if(time<5||time>120)throw new Error("El tiempo debe estar entre 5 y 120 segundos.");
  const config={mechanic:mech,target_score:target,time_limit:time};
  if(id){
   const{data,error}=await supabase.from("games").update({name:n,description:d,min_players:min,max_players:max,game_config:config}).eq("id",id).eq("creator_id",state.session.user.id).select().single();
   if(error)throw error;
   if(publish){const{error:e}=await supabase.rpc("publish_game",{p_game_id:id});if(e)throw e;statusText("Publicado y listo para jugar.");}else statusText("Guardado.");
  }else{
   const{data,error}=await supabase.rpc("create_game",{p_name:n,p_description:d,p_mechanic:mech,p_min:min,p_max:max});
   if(error)throw error;
   id=data.id;
   const{error:updateError}=await supabase.from("games").update({game_config:config}).eq("id",id).eq("creator_id",state.session.user.id);
   if(updateError)throw updateError;
   if(publish){const{error:e}=await supabase.rpc("publish_game",{p_game_id:id});if(e)throw e;statusText("Publicado y listo para jugar.");}else statusText("Guardado.");
  }
  toast($("#status").textContent,"success");
 }catch(e){toast(e.message||"No se pudo guardar.","error")}finally{setBusy(btn,false)}
}
function statusText(t){$("#status").textContent=t}
$("#save").onclick=()=>save(false);$("#publish").onclick=()=>save(true);