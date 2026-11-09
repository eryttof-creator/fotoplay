import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

async function dbAdmin() { return (await import('@/integrations/supabase/client.server')).supabaseAdmin; }
async function account(client: any) { const { data, error } = await client.auth.getUser(); if(error || !data.user || data.user.is_anonymous) throw new Error('Entre em uma conta para usar Amigos.'); return data.user; }
export async function notify(db: any, userId: string, actor: string, kind: string, message: string, target?: string) {
  const { error } = await db.from('notifications').insert({user_id:userId, actor_id:actor, kind, message, target:target ?? null});
  if(error) throw new Error('Não foi possível enviar a notificação.');
}
export const socialData = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  await account(context.supabase);
  const [f,n,i] = await Promise.all([
    context.supabase.from('friendships').select('*'),
    context.supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(50),
    context.supabase.from('game_invites').select('*').order('created_at',{ascending:false}).limit(50),
  ]);
  if(f.error || n.error || i.error) throw new Error('Não foi possível carregar Amigos.');
  const ids = [...new Set((f.data ?? []).flatMap(x=>[x.sender_id,x.recipient_id]).filter(x=>x!==context.userId))];
  const db=await dbAdmin();
  const {data:profiles}=ids.length ? await db.from('profiles').select('id,username,nickname,avatar,bio,photo_path,last_active,matches,wins').in('id',ids) : {data:[]};
  const friends = new Set((f.data ?? []).filter(x=>x.status==='accepted').flatMap(x=>[x.sender_id,x.recipient_id]));
  return { friendships:f.data ?? [], notifications:n.data ?? [], invites:i.data ?? [], profiles:(profiles ?? []).map((p:any)=>({...p,photo_path:friends.has(p.id)?p.photo_path:null,last_active:friends.has(p.id)?p.last_active:null})) };
});
export const friendshipAction = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d)=>z.object({userId:z.string().uuid(),action:z.enum(['request','accept','reject','cancel','remove'])}).parse(d)).handler(async({data,context})=>{
  await account(context.supabase);
  if(data.userId===context.userId) throw new Error('Escolha outro jogador.');
  const db=await dbAdmin();
  const {data:other}=await db.from('profiles').select('username').eq('id',data.userId).maybeSingle();
  if(!other?.username) throw new Error('Jogador não encontrado.');
  const {data:rows,error}=await context.supabase.from('friendships').select('*');
  if(error) throw error;
  const row=rows?.find(x=>x.sender_id===data.userId||x.recipient_id===data.userId);
  const {data:me}=await context.supabase.from('profiles').select('nickname').eq('id',context.userId).maybeSingle();
  const name=me?.nickname||'Um jogador';
  if(data.action==='request') {
    if(row) throw new Error('Já existe uma amizade ou solicitação.');
    const {error}=await db.from('friendships').insert({sender_id:context.userId,recipient_id:data.userId}); if(error) throw new Error('Não foi possível enviar.');
    await notify(db,data.userId,context.userId,'friend_request',`${name} enviou uma solicitação de amizade.`,'/amigos');
  } else {
    if(!row) throw new Error('Solicitação não encontrada.');
    if(['accept','reject'].includes(data.action) && (row.recipient_id!==context.userId||row.status!=='pending')) throw new Error('Solicitação inválida.');
    if(data.action==='cancel' && (row.sender_id!==context.userId||row.status!=='pending')) throw new Error('Solicitação inválida.');
    if(data.action==='remove' && row.status!=='accepted') throw new Error('Amizade inválida.');
    const result=data.action==='accept'?await db.from('friendships').update({status:'accepted'}).eq('id',row.id):await db.from('friendships').delete().eq('id',row.id);
    if(result.error) throw result.error;
    if(data.action==='accept') await notify(db,data.userId,context.userId,'friend_accepted',`${name} aceitou sua amizade.`,'/amigos');
  }
  return {ok:true};
});
export const sendInvite = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d)=>z.object({userId:z.string().uuid(),roomId:z.string().uuid().optional(),sessionId:z.string().uuid().optional()}).refine(d=>!!d.roomId !== !!d.sessionId).parse(d)).handler(async({data,context})=>{
  await account(context.supabase);
  const {data:friends}=await context.supabase.rpc('are_friends',{a:context.userId,b:data.userId}); if(!friends) throw new Error('Convide alguém da sua lista de amigos.');
  const db=await dbAdmin();
  const table=data.roomId?'rooms':'tv_sessions'; const id=data.roomId??data.sessionId;
  if (!id) throw new Error('Sessão inválida.');
  const {data:game}=await db.from(table).select('id,code,host_id,status').eq('id',id).maybeSingle();
  if(!game || game.status!=='lobby') throw new Error('A sessão não está disponível para convites.');
  const allowed=data.roomId ? (await context.supabase.rpc('is_room_member',{_room:game.id,_user:context.userId})).data : (await context.supabase.rpc('is_tv_member',{s:game.id,u:context.userId})).data;
  if(!allowed) throw new Error('Você não está nesta sessão.');
  const {data:pending}=await context.supabase.from('game_invites').select('id').eq('recipient_id',data.userId).eq('status','pending').eq(data.roomId?'room_id':'session_id',game.id);
  if(pending?.length) throw new Error('Convite já enviado.');
  const {error}=await db.from('game_invites').insert({sender_id:context.userId,recipient_id:data.userId,room_id:data.roomId??null,session_id:data.sessionId??null}); if(error) throw error;
  const {data:me}=await context.supabase.from('profiles').select('nickname').eq('id',context.userId).maybeSingle();
  await notify(db,data.userId,context.userId,'game_invite',`${me?.nickname||'Seu amigo'} convidou você para jogar.`,'/amigos');
  return {ok:true};
});
export const answerInvite = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d)=>z.object({id:z.string().uuid(),accept:z.boolean()}).parse(d)).handler(async({data,context})=>{
  await account(context.supabase);
  const {data:invite}=await context.supabase.from('game_invites').select('*').eq('id',data.id).maybeSingle();
  if(!invite || invite.recipient_id!==context.userId || invite.status!=='pending') throw new Error('Convite indisponível.');
  const db=await dbAdmin();
  const targetId = invite.room_id ?? invite.session_id;
  if (!targetId) throw new Error('Convite inválido.');
  const {data:target}=await db.from(invite.room_id?'rooms':'tv_sessions').select('code,status').eq('id',targetId).maybeSingle();
  if(data.accept && (!target||target.status!=='lobby')) throw new Error('A partida já começou ou foi encerrada.');
  const {error}=await db.from('game_invites').update({status:data.accept?'accepted':'declined'}).eq('id',data.id); if(error) throw error;
  return {code:target?.code??null,tv:!!invite.session_id};
});
export const socialHeartbeat = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  await account(context.supabase); const {error}=await context.supabase.from('profiles').update({last_active:new Date().toISOString()}).eq('id',context.userId); if(error) throw error; return {ok:true};
});
export const saveAccountProfile=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({username:z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/,'Use 3 a 20 letras, números ou _. '),bio:z.string().trim().max(160)}).parse(d)).handler(async({data,context})=>{
  await account(context.supabase); const {error}=await context.supabase.from('profiles').update(data).eq('id',context.userId); if(error) throw new Error(error.code==='23505'?'Este @usuário já está em uso.':'Não foi possível salvar.'); return {ok:true};
});
