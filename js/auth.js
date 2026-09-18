import { supabase } from "./app.js";

export async function getSession() {
  if (!supabase) return { session:null, error:new Error("Supabase no está configurado.") };
  return supabase.auth.getSession();
}
export async function requireAuth({redirect="login.html"}={}) {
  const {data,error}=await getSession();
  if(error||!data?.session){window.location.href=redirect;return null;}
  return data.session;
}
export async function signUp({email,password,username}) {
  if(!supabase) throw new Error("Supabase no está configurado.");
  const redirectUrl=new URL("./login.html",window.location.href).href;
  const {data,error}=await supabase.auth.signUp({email,password,options:{data:{username},emailRedirectTo:redirectUrl}});
  if(error) throw error;
  if(data.user && Array.isArray(data.user.identities) && data.user.identities.length===0) throw new Error("Este correo electrónico ya está registrado.");
  return data;
}
export async function signIn(email,password) {
  if(!supabase) throw new Error("Supabase no está configurado.");
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error) throw error;
  return data;
}
export async function resetPassword(email) {
  if(!supabase) throw new Error("Supabase no está configurado.");
  const redirectUrl=new URL("./login.html?reset=1",window.location.href).href;
  const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:redirectUrl});
  if(error) throw error;
}
export async function signOut() {
  if(supabase) await supabase.auth.signOut();
  window.location.href="index.html";
}
export function bindAuthState(callback) {
  if(!supabase)return()=>{};
  const {data}=supabase.auth.onAuthStateChange((_event,session)=>callback(session));
  return()=>data.subscription.unsubscribe();
}
