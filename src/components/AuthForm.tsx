import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TopBar } from '@/components/Chrome';
import { useAuth } from '@/lib/auth';
export function AuthForm({signup=false}:{signup?:boolean}) {
 const {user,logout}=useAuth(); const navigate=useNavigate();
 const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [username,setUsername]=useState(''); const [nickname,setNickname]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [error,setError]=useState(''); const [forgot,setForgot]=useState(false);
 return <div className="min-h-[70vh] bg-hero"><TopBar/><main className="mx-auto max-w-md px-4 py-8 pb-16"><h1 className="mb-6 text-4xl font-extrabold">{forgot?'Recuperar senha':signup?'Criar conta':'Entrar na conta'}</h1>{user&&!user.is_anonymous?<div className="space-y-4"><p>Você já está conectado.</p><Button variant="popLime" onClick={()=>navigate({to:'/perfil'})}>Meu perfil</Button><Button variant="ghost" onClick={logout}>Sair da conta</Button></div>:<form className="flex flex-col gap-4" onSubmit={async e=>{
 e.preventDefault();setBusy(true);setError('');setMessage('');
 try {
  if(forgot){const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/reset-password`});if(error)throw error;setMessage('Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha.');}
  else if(signup){
   const normalized=username.toLowerCase().trim();
   if(!/^[a-z0-9_]{3,20}$/.test(normalized))throw new Error('Use de 3 a 20 letras, números ou _ no @usuário.');
   const {error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin,data:{username:normalized,nickname:nickname.trim()}}});
   if(error)throw error;setMessage('Confira seu e-mail para confirmar o cadastro. Depois, entre na sua conta.');
  }else{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;await navigate({to:'/perfil'});}
 }catch(err){setError(err instanceof Error?err.message:'Não foi possível concluir.');}finally{setBusy(false);}
 }}>
 {signup&&!forgot&&<><label className="space-y-2">Nome ou apelido<Input required maxLength={20} value={nickname} onChange={e=>setNickname(e.target.value)} autoComplete="nickname"/></label><label className="space-y-2">@usuário<Input required maxLength={20} minLength={3} pattern="[a-z0-9_]{3,20}" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())} autoComplete="username"/></label></>}
 <label className="space-y-2">E-mail<Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
 {!forgot&&<label className="space-y-2">Senha<Input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={signup?'new-password':'current-password'}/></label>}
 {signup&&!forgot&&<label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" required/><span>Li e aceito os <Link className="underline" to="/termos">Termos de Uso</Link> e a <Link className="underline" to="/privacidade">Política de Privacidade</Link>.</span></label>}
 {error&&<p role="alert" className="text-destructive">{error}</p>}{message&&<p role="status" className="rounded-xl bg-accent p-3">{message}</p>}
 <Button variant="pop" size="xl" disabled={busy}>{busy?'Aguarde…':forgot?'Enviar link':signup?'Cadastrar':'Entrar'}</Button>
 {!signup&&<Button variant="ghost" type="button" onClick={()=>{setForgot(!forgot);setError('');setMessage('');}}>{forgot?'Voltar ao login':'Esqueci minha senha'}</Button>}
 <Link className="text-center font-bold underline" to={signup?'/auth':'/cadastro'}>{signup?'Já tenho conta':'Criar uma conta'}</Link><Link className="text-center text-sm underline" to="/">Continuar como visitante</Link>
 </form>}</main></div>;
}
