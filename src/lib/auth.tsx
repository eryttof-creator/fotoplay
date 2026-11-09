import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resetSession } from '@/lib/session';
import { socialHeartbeat } from '@/lib/api/social.functions';
const AuthContext=createContext<{user:User|null;loading:boolean;logout:()=>Promise<void>}>({user:null,loading:true,logout:async()=>{}});
export const useAuth=()=>useContext(AuthContext);
export function AuthProvider({children}:{children:ReactNode}) {
 const [user,setUser]=useState<User|null>(null); const [loading,setLoading]=useState(true); const router=useRouter(); const queries=useQueryClient();
 useEffect(()=>{
  let live=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
   if(!live) return; setUser(session?.user??null); setLoading(false);
   if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event)) { resetSession(); void router.invalidate(); if(event!=='SIGNED_OUT') void queries.invalidateQueries(); }
  });
  supabase.auth.getUser().then(({data})=>{if(live){setUser(data.user);setLoading(false);}});
  return()=>{live=false;subscription.unsubscribe();};
 },[router,queries]);
 useEffect(()=>{
  if(!user||user.is_anonymous)return;
  const beat=()=>{void socialHeartbeat().catch(()=>{});}; beat(); const timer=setInterval(beat,30000); return()=>clearInterval(timer);
 },[user?.id,user?.is_anonymous]);
 const logout=async()=>{await queries.cancelQueries();queries.clear();await supabase.auth.signOut();resetSession();await router.navigate({to:'/auth',replace:true});};
 return <AuthContext.Provider value={{user,loading,logout}}>{children}</AuthContext.Provider>;
}
