import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { InfoPage } from '@/components/InfoPage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/reset-password')({head:()=>pageHead('Redefinir senha','Escolha uma nova senha para sua conta Foto Play.'),component:Reset});
function Reset(){const [ready,setReady]=useState(false);const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{if(new URLSearchParams(window.location.hash.slice(1)).get('type')==='recovery')setReady(true);const {data:{subscription}}=supabase.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')setReady(true);});return()=>subscription.unsubscribe();},[]);
 return <InfoPage title="Redefinir senha">{ready?<form className="flex max-w-md flex-col gap-4" onSubmit={async e=>{e.preventDefault();if(password!==confirm){setMessage('As senhas precisam ser iguais.');return;}setBusy(true);const {error}=await supabase.auth.updateUser({password});setBusy(false);setMessage(error?error.message:'Senha atualizada!');if(!error)setReady(false);}}><label>Nova senha<Input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirmar nova senha<Input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><Button variant="pop" disabled={busy}>Salvar nova senha</Button></form>:<p>Abra o link enviado ao seu e-mail para redefinir a senha.</p>}{message&&<p role="status">{message}</p>}<Link to="/auth" className="inline-block underline">Voltar ao login</Link></InfoPage>;
}
