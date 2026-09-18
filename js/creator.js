import { supabase } from "./app.js";
import { bootShell } from "./nav.js";
import { toast, setBusy } from "./ui.js";

const state=await bootShell();
const canvas=document.querySelector("#design"), ctx=canvas?.getContext("2d");
const color=document.querySelector("#color"), type=document.querySelector("#type"), name=document.querySelector("#name"), description=document.querySelector("#description"), price=document.querySelector("#price"), status=document.querySelector("#creator-status");
let drawing=false, tool="brush", zoom=1, currentId=null, history=[];

function resetCanvas(){ctx.fillStyle="#f4f3ef";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle="#d8d5cc";ctx.lineWidth=2;ctx.strokeRect(90,90,460,460);}
function snapshot(){history.push(ctx.getImageData(0,0,canvas.width,canvas.height));if(history.length>20)history.shift();}
function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};}
function start(e){snapshot();drawing=true;const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);}
function move(e){if(!drawing)return;const p=point(e);ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=tool==="eraser"?32:10;ctx.strokeStyle=tool==="eraser"?"#f4f3ef":color.value;ctx.lineTo(p.x,p.y);ctx.stroke();}
function end(){drawing=false;ctx.closePath();}
canvas?.addEventListener("pointerdown",start);canvas?.addEventListener("pointermove",move);window.addEventListener("pointerup",end);
document.querySelector("#brush").onclick=()=>tool="brush";document.querySelector("#eraser").onclick=()=>tool="eraser";
document.querySelector("#undo").onclick=()=>{const img=history.pop();if(img)ctx.putImageData(img,0,0);};
document.querySelector("#clear").onclick=()=>{snapshot();resetCanvas();};
document.querySelector("#zoom-in").onclick=()=>{zoom=Math.min(2,zoom+.1);canvas.style.transform=`scale(${zoom})`;document.querySelector("#zoom-label").textContent=`${Math.round(zoom*100)}%`;};
document.querySelector("#zoom-out").onclick=()=>{zoom=Math.max(.6,zoom-.1);canvas.style.transform=`scale(${zoom})`;document.querySelector("#zoom-label").textContent=`${Math.round(zoom*100)}%`;};

function data(){return {version:1,canvas:{width:canvas.width,height:canvas.height},layers:[{type:"raster",data:canvas.toDataURL("image/png")} ]};}
async function save(publish=false){
 if(!state)return;
 if(!name.value.trim()){toast("Ponle un nombre a tu creación.","error");return;}
 const btn=document.querySelector(publish?"#publish":"#save");setBusy(btn,true,publish?"Publicando...":"Guardando...");
 try{
   const payload={creator_id:state.session.user.id,name:name.value.trim(),description:description.value.trim(),type:type.value,price:Number(price.value)||0,design_data:data(),thumbnail:null,is_published:publish};
   let result;
   if(currentId) result=await supabase.from("clothing_items").update(payload).eq("id",currentId).select().single();
   else result=await supabase.from("clothing_items").insert(payload).select().single();
   if(result.error)throw result.error;
   currentId=result.data.id;
   status.textContent=publish?"Publicado en Marketplace.":"Guardado en tus creaciones.";
   toast(status.textContent,"success");
 }catch(e){toast(e.message||"No se pudo guardar.","error");}finally{setBusy(btn,false);}
}
document.querySelector("#save").onclick=()=>save(false);document.querySelector("#publish").onclick=()=>save(true);
resetCanvas();