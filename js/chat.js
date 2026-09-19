import{bootShell}from"./nav.js?v=20260919-1426";
import{supabase}from"./app.js";
import{toast}from"./ui.js";

const state=await bootShell();
const friendsEl=document.querySelector("#chat-friends");
const messagesEl=document.querySelector("#chat-messages");
const header=document.querySelector("#chat-header");
const form=document.querySelector("#chat-form");
const input=document.querySelector("#chat-input");
const sendButton=form.querySelector("button");
const searchInput=document.querySelector("#chat-search-input");
const countEl=document.querySelector("#chat-count");
const charCount=document.querySelector("#chat-character-count");
const storageEl=document.querySelector("#chat-storage");
const filterButtons=[...document.querySelectorAll("[data-chat-filter]")];

let friends=[];
let activeFriend=null;
let activeChannel=null;
let filter="all";
const unread=new Map();
const esc=v=>String(v??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const initials=v=>String(v||"U").trim().slice(0,2).toUpperCase();
const isOnline=u=>u?.status==="online"&&u?.last_seen&&Date.now()-new Date(u.last_seen).getTime()<90000;
const timeLabel=v=>new Date(v).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const dateLabel=v=>new Date(v).toLocaleDateString([],{day:"numeric",month:"short"});
const byteLength=v=>new TextEncoder().encode(String(v||"")).length;
const formatBytes=n=>n<1024?Math.round(n)+" B":(n/1024).toFixed(1)+" KB";
const friendFromRow=r=>r.requester_id===state.session.user.id?r.addressee:r.requester;

function filteredFriends(){
  const query=(searchInput?.value||"").trim().toLowerCase();
  return friends.filter(u=>(filter==="all"||isOnline(u))&&(!query||(u.username||"").toLowerCase().includes(query)));
}

function renderFriends(){
  const list=filteredFriends();
  countEl.textContent=String(friends.length);
  if(!list.length){
    friendsEl.innerHTML='<div class="chat-empty-list"><span>⌕</span><strong>No hay chats</strong><small>Agrega amigos para empezar a hablar.</small></div>';
    return;
  }
  friendsEl.innerHTML=list.map(u=>{
    const active=activeFriend?.id===u.id;
    const unreadCount=unread.get(u.id)||0;
    const online=isOnline(u);
    return '<button class="chat-friend '+(active?"is-active":"")+'" data-friend-id="'+esc(u.id)+'" type="button">'+
      '<span class="chat-avatar-wrap"><span class="chat-avatar">'+esc(initials(u.username))+'</span><i class="chat-online '+(online?"is-online":"")+'"></i></span>'+
      '<span class="chat-friend-copy"><strong>'+esc(u.username||"Usuario")+'</strong><small>'+esc(online?"En línea":"Fuera de línea")+'</small></span>'+
      (unreadCount?'<b class="chat-unread">'+unreadCount+'</b>':'')+
      '<span class="chat-chevron">›</span></button>';
  }).join("");
  friendsEl.querySelectorAll("[data-friend-id]").forEach(btn=>btn.addEventListener("click",()=>{
    const friend=friends.find(u=>u.id===btn.dataset.friendId);
    if(friend)selectFriend(friend);
  }));
}

async function loadFriends(){
  const{data,error}=await supabase.from("friendships")
    .select("requester_id,addressee_id,status,created_at,requester:profiles!friendships_requester_id_fkey(id,username,status,last_seen),addressee:profiles!friendships_addressee_id_fkey(id,username,status,last_seen)")
    .or("requester_id.eq."+state.session.user.id+",addressee_id.eq."+state.session.user.id)
    .eq("status","accepted").order("created_at",{ascending:false});
  if(error)throw error;
  friends=(data||[]).map(friendFromRow).filter(Boolean);
  renderFriends();
}

function setHeader(friend){
  const online=isOnline(friend);
  header.innerHTML='<div class="chat-header-user">'+
    '<span class="chat-header-avatar">'+esc(initials(friend.username))+'<i class="chat-online '+(online?"is-online":"")+'"></i></span>'+
    '<div><h2>'+esc(friend.username||"Usuario")+'</h2><p class="chat-presence">'+(online?"En línea":"Fuera de línea")+'</p></div>'+
    '</div><a class="chat-profile-link" href="public-profile.html?user='+encodeURIComponent(friend.id)+'">Ver perfil</a>';
}

function setComposer(enabled){
  input.disabled=!enabled;
  sendButton.disabled=!enabled;
  input.placeholder=enabled?"Escribe un mensaje...":"Selecciona un amigo para escribir...";
  if(!enabled){input.value="";updateCharCount()}
}

function updateCharCount(){
  charCount.textContent=input.value.length+"/500";
  charCount.classList.toggle("is-near-limit",input.value.length>=450);
}

function updateStorage(rows){
  const used=(rows||[]).reduce((sum,m)=>sum+byteLength(m.body),0);
  storageEl.textContent=formatBytes(used)+" / 10 KB";
  storageEl.classList.toggle("is-full",used>=10240);
  storageEl.classList.toggle("is-near",used>=8192);
  return used;
}

function renderMessages(rows){
  if(!rows.length){
    messagesEl.innerHTML='<div class="chat-welcome chat-welcome--small"><h3>Aún no hay mensajes</h3><p>Escribe algo para empezar la conversación.</p></div>';
    updateStorage([]);
    return;
  }
  let lastDay="";
  messagesEl.innerHTML=rows.map(m=>{
    const day=dateLabel(m.created_at);
    const divider=day!==lastDay?'<div class="chat-date"><span>'+esc(day)+'</span></div>':"";
    lastDay=day;
    const mine=m.sender_id===state.session.user.id;
    return divider+'<article class="chat-message '+(mine?"is-me":"is-them")+'" data-message-id="'+esc(m.id)+'">'+
      '<div class="chat-message-line"><div class="chat-bubble">'+esc(m.body)+'</div>'+
      '<button class="chat-delete" type="button" data-delete-message="'+esc(m.id)+'" aria-label="Borrar mensaje" title="Borrar">×</button></div>'+
      '<time>'+timeLabel(m.created_at)+'</time></article>';
  }).join("");
  messagesEl.querySelectorAll("[data-delete-message]").forEach(btn=>btn.addEventListener("click",()=>deleteMessage(btn.dataset.deleteMessage)));
  updateStorage(rows);
  requestAnimationFrame(()=>{messagesEl.scrollTop=messagesEl.scrollHeight});
}

async function loadMessages(){
  if(!activeFriend)return;
  const a=state.session.user.id,b=activeFriend.id;
  const{data,error}=await supabase.from("messages")
    .select("id,sender_id,recipient_id,body,created_at")
    .eq("channel","friend")
    .or("and(sender_id.eq."+a+",recipient_id.eq."+b+"),and(sender_id.eq."+b+",recipient_id.eq."+a+")")
    .order("created_at",{ascending:true}).limit(500);
  if(error)throw error;
  renderMessages(data||[]);
}

async function deleteMessage(id){
  if(!id)return;
  try{
    const{error}=await supabase.from("messages").delete().eq("id",id);
    if(error)throw error;
    await loadMessages();
  }catch(error){toast(error.message||"No se pudo borrar el mensaje.","error")}
}

async function selectFriend(friend){
  activeFriend=friend;
  unread.delete(friend.id);
  renderFriends();
  setHeader(friend);
  setComposer(true);
  try{await loadMessages()}catch(error){toast(error.message||"No se pudieron cargar los mensajes.","error")}
  if(activeChannel)await supabase.removeChannel(activeChannel);
  activeChannel=supabase.channel("private-chat-"+state.session.user.id+"-"+friend.id)
    .on("postgres_changes",{event:"*",schema:"public",table:"messages"},payload=>{
      const m=payload.new||payload.old;
      if(!m)return;
      const relevant=(m.sender_id===friend.id&&m.recipient_id===state.session.user.id)||(m.sender_id===state.session.user.id&&m.recipient_id===friend.id);
      if(relevant)loadMessages().catch(()=>{});
    }).subscribe();
}

form.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!activeFriend||!input.value.trim())return;
  const body=input.value.trim();
  sendButton.disabled=true;
  try{
    const{error}=await supabase.rpc("send_friend_message",{p_recipient_id:activeFriend.id,p_body:body});
    if(error){
      if(error.message?.includes("CHAT_STORAGE_FULL"))throw new Error("Este chat llegó a 10 KB. Borra algunos mensajes para liberar espacio.");
      throw error;
    }
    input.value="";updateCharCount();await loadMessages();
  }catch(error){toast(error.message||"No se pudo enviar el mensaje.","error")}
  finally{sendButton.disabled=false;if(activeFriend)input.focus()}
});

input.addEventListener("input",updateCharCount);
searchInput.addEventListener("input",renderFriends);
filterButtons.forEach(btn=>btn.addEventListener("click",()=>{
  filterButtons.forEach(x=>x.classList.remove("is-active"));
  btn.classList.add("is-active");filter=btn.dataset.chatFilter;renderFriends();
}));
window.addEventListener("focus",()=>{if(activeFriend)loadMessages().catch(()=>{})});

if(state)loadFriends().catch(error=>{
  friendsEl.innerHTML='<div class="chat-empty-list"><span>!</span><strong>No se pudieron cargar tus amigos</strong><small>'+esc(error.message||"Error de conexión.")+'</small></div>';
  toast(error.message||"No se pudieron cargar tus amigos.","error");
});