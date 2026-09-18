import{bootShell}from"./nav.js?v=20260918-1510";
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
const filterButtons=[...document.querySelectorAll("[data-chat-filter]")];

let friends=[];
let activeFriend=null;
let activeChannel=null;
let friendRows=[];
let filter="all";
const unread=new Map();

const esc=v=>String(v??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const initials=v=>String(v||"U").trim().slice(0,2).toUpperCase();
const isOnline=u=>u?.status==="online"&&u?.last_seen&&Date.now()-new Date(u.last_seen).getTime()<90000;
const timeLabel=v=>new Date(v).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
const dateLabel=v=>new Date(v).toLocaleDateString([], {day:"numeric",month:"short"});
const friendFromRow=r=>r.requester_id===state.session.user.id?r.addressee:r.requester;

function filteredFriends(){
  const query=(searchInput?.value||"").trim().toLowerCase();
  return friends.filter(u=>(filter==="all"||isOnline(u))&&!query||((filter==="all"||isOnline(u))&&(u.username||"").toLowerCase().includes(query)));
}

function renderFriends(){
  const list=filteredFriends();
  countEl.textContent=String(friends.length);
  if(!list.length){
    friendsEl.innerHTML='<div class="chat-empty-list"><span>⌕</span><strong>No encontramos conversaciones</strong><small>Prueba otro nombre o cambia el filtro.</small></div>';
    return;
  }
  friendsEl.innerHTML=list.map(u=>{
    const active=activeFriend?.id===u.id;
    const unreadCount=unread.get(u.id)||0;
    const online=isOnline(u);
    return '<button class="chat-friend '+(active?"is-active":"")+'" data-friend-id="'+esc(u.id)+'" type="button">'+
      '<span class="chat-avatar-wrap"><span class="chat-avatar">'+esc(initials(u.username))+'</span><i class="chat-online '+(online?"is-online":"")+'"></i></span>'+
      '<span class="chat-friend-copy"><strong>'+esc(u.username||"Usuario")+'</strong><small>'+esc(online?"En línea":"Última conexión no disponible")+'</small></span>'+
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
  friendRows=data||[];
  friends=friendRows.map(friendFromRow).filter(Boolean);
  renderFriends();
}

function setHeader(friend){
  const online=isOnline(friend);
  header.innerHTML='<div class="chat-header-user">'+
    '<span class="chat-header-avatar">'+esc(initials(friend.username))+'<i class="chat-online '+(online?"is-online":"")+'"></i></span>'+
    '<div><span class="eyebrow">CONVERSACIÓN PRIVADA</span><h2>'+esc(friend.username||"Usuario")+'</h2><p class="chat-presence">'+(online?"● En línea":"○ Fuera de línea")+'</p></div>'+
    '</div><a class="chat-profile-link" href="profile.html">Perfil <span>→</span></a>';
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

async function selectFriend(friend){
  activeFriend=friend;
  unread.delete(friend.id);
  renderFriends();
  setHeader(friend);
  setComposer(true);
  await loadMessages();
  if(activeChannel)await supabase.removeChannel(activeChannel);
  activeChannel=supabase.channel("private-chat-"+state.session.user.id+"-"+friend.id)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},payload=>{
      const m=payload.new;
      if(!m)return;
      const relevant=(m.sender_id===friend.id&&m.recipient_id===state.session.user.id)||(m.sender_id===state.session.user.id&&m.recipient_id===friend.id);
      if(!relevant)return;
      if(m.sender_id===friend.id&&!document.hidden)unread.delete(friend.id);
      loadMessages().catch(()=>{});
      if(m.sender_id===friend.id&&document.hidden){
        unread.set(friend.id,(unread.get(friend.id)||0)+1);
        renderFriends();
      }
    }).subscribe();
}

async function loadMessages(){
  if(!activeFriend)return;
  const a=state.session.user.id,b=activeFriend.id;
  const{data,error}=await supabase.from("messages")
    .select("id,sender_id,recipient_id,body,created_at")
    .or("and(sender_id.eq."+a+",recipient_id.eq."+b+"),and(sender_id.eq."+b+",recipient_id.eq."+a+")")
    .order("created_at",{ascending:true}).limit(200);
  if(error)throw error;
  const rows=data||[];
  if(!rows.length){
    messagesEl.innerHTML='<div class="chat-welcome chat-welcome--small"><div class="chat-welcome-icon">✦</div><h3>Empieza la conversación</h3><p>Aún no hay mensajes con '+esc(activeFriend.username)+'.</p></div>';
    return;
  }
  let lastDay="";
  messagesEl.innerHTML=rows.map(m=>{
    const day=dateLabel(m.created_at);
    const divider=day!==lastDay?'<div class="chat-date"><span>'+esc(day)+'</span></div>':"";
    lastDay=day;
    return divider+'<article class="chat-message '+(m.sender_id===a?"is-me":"is-them")+'"><div class="chat-bubble">'+esc(m.body)+'</div><time>'+timeLabel(m.created_at)+'</time></article>';
  }).join("");
  requestAnimationFrame(()=>{messagesEl.scrollTop=messagesEl.scrollHeight});
}

form.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!activeFriend||!input.value.trim())return;
  const body=input.value.trim();
  sendButton.disabled=true;
  try{
    const{error}=await supabase.rpc("send_friend_message",{p_recipient_id:activeFriend.id,p_body:body});
    if(error)throw error;
    input.value="";updateCharCount();await loadMessages();
  }catch(error){toast(error.message||"No se pudo enviar el mensaje.","error")}
  finally{sendButton.disabled=false;if(activeFriend){input.focus()}}
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