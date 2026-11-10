import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

async function dbAdmin() { return (await import('@/integrations/supabase/client.server')).supabaseAdmin; }
async function account(client: any) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) throw new Error('Entre em uma conta para usar Amigos.');
  return data.user;
}
/** Notifications are best-effort: a failed notice never undoes the action that already happened. */
export async function notify(db: any, userId: string, actor: string, kind: string, message: string, target?: string) {
  const { error } = await db.from('notifications').insert({ user_id: userId, actor_id: actor, kind, message, target: target ?? null });
  if (error) console.error('notify failed', error.message);
}
async function blockedBetween(db: any, a: string, b: string) {
  const { data } = await db.from('user_blocks').select('blocker_id')
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`).limit(1);
  return (data ?? []).length > 0;
}
async function pairRow(db: any, a: string, b: string) {
  const { data, error } = await db.from('friendships').select('*')
    .or(`and(sender_id.eq.${a},recipient_id.eq.${b}),and(sender_id.eq.${b},recipient_id.eq.${a})`).maybeSingle();
  if (error) throw new Error('Não foi possível carregar a amizade.');
  return data as { id: string; sender_id: string; recipient_id: string; status: string } | null;
}
async function myName(client: any, uid: string) {
  const { data } = await client.from('profiles').select('nickname,username').eq('id', uid).maybeSingle();
  return data?.nickname || (data?.username ? `@${data.username}` : 'Um jogador');
}

export const socialData = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await account(context.supabase);
  const me = context.userId;
  const [f, n, i, b, fav, mine] = await Promise.all([
    context.supabase.from('friendships').select('*').or(`sender_id.eq.${me},recipient_id.eq.${me}`),
    context.supabase.from('notifications').select('*').eq('user_id', me).order('created_at', { ascending: false }).limit(50),
    context.supabase.from('game_invites').select('*').or(`sender_id.eq.${me},recipient_id.eq.${me}`).order('created_at', { ascending: false }).limit(50),
    context.supabase.from('user_blocks').select('blocked_id').eq('blocker_id', me),
    context.supabase.from('favorite_friends').select('friend_id').eq('user_id', me),
    context.supabase.from('profiles').select('username').eq('id', me).maybeSingle(),
  ]);
  if (f.error || n.error || i.error || b.error || fav.error) throw new Error('Não foi possível carregar Amigos.');
  const blocked = (b.data ?? []).map((x) => x.blocked_id);
  const linked = [
    ...(f.data ?? []).flatMap((x) => [x.sender_id, x.recipient_id]),
    ...(i.data ?? []).flatMap((x) => [x.sender_id, x.recipient_id]),
    ...(n.data ?? []).map((x) => x.actor_id).filter(Boolean) as string[],
    ...blocked,
  ];
  const ids = [...new Set(linked.filter((x) => x !== me))];
  const db = await dbAdmin();
  const { data: profiles } = ids.length
    ? await db.from('profiles').select('id,username,nickname,avatar,bio,photo_path,last_active,matches,wins').in('id', ids)
    : { data: [] as any[] };
  // Photos and online status only for confirmed friends of the caller.
  const friends = new Set((f.data ?? []).filter((x) => x.status === 'accepted').map((x) => (x.sender_id === me ? x.recipient_id : x.sender_id)));
  return {
    myUsername: mine.data?.username ?? null,
    friendships: f.data ?? [],
    notifications: n.data ?? [],
    invites: i.data ?? [],
    blocked,
    favorites: (fav.data ?? []).map((x) => x.friend_id),
    profiles: (profiles ?? []).map((p: any) => ({ ...p, photo_path: friends.has(p.id) ? p.photo_path : null, last_active: friends.has(p.id) ? p.last_active : null })),
  };
});

export const friendshipAction = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), action: z.enum(['request', 'accept', 'reject', 'cancel', 'remove']) }).parse(d))
  .handler(async ({ data, context }) => {
    await account(context.supabase);
    const me = context.userId;
    if (data.userId === me) throw new Error('Escolha outro jogador.');
    const db = await dbAdmin();
    const { data: other } = await db.from('profiles').select('username').eq('id', data.userId).maybeSingle();
    if (!other?.username) throw new Error('Jogador não encontrado.');
    const row = await pairRow(db, me, data.userId);
    const name = await myName(context.supabase, me);

    if (data.action === 'request') {
      if (await blockedBetween(db, me, data.userId)) throw new Error('Não é possível adicionar este jogador.');
      if (row?.status === 'accepted') throw new Error('Vocês já são amigos.');
      if (row && row.sender_id === me) throw new Error('Solicitação já enviada.');
      if (row && row.recipient_id === me) {
        // The other person already asked: adding them back accepts it.
        const { error } = await db.from('friendships').update({ status: 'accepted' }).eq('id', row.id).eq('status', 'pending');
        if (error) throw new Error('Não foi possível aceitar.');
        await notify(db, data.userId, me, 'friend_accepted', `${name} aceitou sua amizade.`, '/amigos');
        return { ok: true, status: 'accepted' as const };
      }
      const { error } = await db.from('friendships').insert({ sender_id: me, recipient_id: data.userId });
      if (error) throw new Error(error.code === '23505' ? 'Já existe uma solicitação entre vocês.' : 'Não foi possível enviar.');
      await notify(db, data.userId, me, 'friend_request', `${name} enviou uma solicitação de amizade.`, '/amigos');
      return { ok: true, status: 'pending' as const };
    }

    if (!row) throw new Error('Solicitação não encontrada.');
    if (['accept', 'reject'].includes(data.action) && (row.recipient_id !== me || row.status !== 'pending')) throw new Error('Solicitação inválida.');
    if (data.action === 'cancel' && (row.sender_id !== me || row.status !== 'pending')) throw new Error('Solicitação inválida.');
    if (data.action === 'remove' && row.status !== 'accepted') throw new Error('Amizade inválida.');
    if (data.action === 'accept') {
      const { error } = await db.from('friendships').update({ status: 'accepted' }).eq('id', row.id).eq('status', 'pending');
      if (error) throw new Error('Não foi possível aceitar.');
      await notify(db, data.userId, me, 'friend_accepted', `${name} aceitou sua amizade.`, '/amigos');
      return { ok: true, status: 'accepted' as const };
    }
    const { error } = await db.from('friendships').delete().eq('id', row.id);
    if (error) throw new Error('Não foi possível concluir.');
    if (data.action === 'remove') await db.from('favorite_friends').delete().or(`and(user_id.eq.${me},friend_id.eq.${data.userId}),and(user_id.eq.${data.userId},friend_id.eq.${me})`);
    return { ok: true, status: 'none' as const };
  });

export const blockAction = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), block: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await account(context.supabase);
    const me = context.userId;
    if (data.userId === me) throw new Error('Escolha outro jogador.');
    const db = await dbAdmin();
    if (!data.block) {
      const { error } = await db.from('user_blocks').delete().eq('blocker_id', me).eq('blocked_id', data.userId);
      if (error) throw new Error('Não foi possível desbloquear.');
      return { ok: true };
    }
    const { error } = await db.from('user_blocks').upsert({ blocker_id: me, blocked_id: data.userId });
    if (error) throw new Error('Não foi possível bloquear.');
    // Blocking ends the friendship, favorites and any pending invites between both.
    await db.from('friendships').delete().or(`and(sender_id.eq.${me},recipient_id.eq.${data.userId}),and(sender_id.eq.${data.userId},recipient_id.eq.${me})`);
    await db.from('favorite_friends').delete().or(`and(user_id.eq.${me},friend_id.eq.${data.userId}),and(user_id.eq.${data.userId},friend_id.eq.${me})`);
    await db.from('game_invites').update({ status: 'declined' }).eq('status', 'pending')
      .or(`and(sender_id.eq.${me},recipient_id.eq.${data.userId}),and(sender_id.eq.${data.userId},recipient_id.eq.${me})`);
    return { ok: true };
  });

export const sendInvite = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), roomId: z.string().uuid().optional(), sessionId: z.string().uuid().optional() }).refine((d) => !!d.roomId !== !!d.sessionId).parse(d))
  .handler(async ({ data, context }) => {
    await account(context.supabase);
    const me = context.userId;
    if (data.userId === me) throw new Error('Você não pode convidar a si mesmo.');
    const { data: friends } = await context.supabase.rpc('are_friends', { a: me, b: data.userId });
    if (!friends) throw new Error('Convide alguém da sua lista de amigos.');
    const db = await dbAdmin();
    if (await blockedBetween(db, me, data.userId)) throw new Error('Não é possível convidar este jogador.');
    const isRoom = !!data.roomId;
    const id = (data.roomId ?? data.sessionId)!;
    const { data: game } = await db.from(isRoom ? 'rooms' : 'tv_sessions').select('id,code,status').eq('id', id).maybeSingle();
    if (!game || game.status !== 'lobby') throw new Error('A sessão não está disponível para convites.');
    const allowed = isRoom
      ? (await context.supabase.rpc('is_room_member', { _room: game.id, _user: me })).data
      : (await context.supabase.rpc('is_tv_member', { s: game.id, u: me })).data;
    if (!allowed) throw new Error('Você não está nesta sessão.');
    const member = isRoom
      ? (await db.from('room_players').select('user_id').eq('room_id', game.id).eq('user_id', data.userId).maybeSingle()).data
      : (await db.from('tv_participants').select('user_id').eq('session_id', game.id).eq('user_id', data.userId).maybeSingle()).data;
    if (member) throw new Error('Este amigo já está na sessão.');
    const { error } = await db.from('game_invites').insert({ sender_id: me, recipient_id: data.userId, room_id: data.roomId ?? null, session_id: data.sessionId ?? null });
    if (error) throw new Error(error.code === '23505' ? 'Convite já enviado.' : 'Não foi possível enviar o convite.');
    const name = await myName(context.supabase, me);
    await notify(db, data.userId, me, 'game_invite', `${name} convidou você para jogar${isRoom ? '' : ' na TV'}.`, '/amigos');
    return { ok: true };
  });

export const answerInvite = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), accept: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await account(context.supabase);
    const { data: invite } = await context.supabase.from('game_invites').select('*').eq('id', data.id).maybeSingle();
    if (!invite || invite.recipient_id !== context.userId || invite.status !== 'pending') throw new Error('Convite indisponível.');
    const db = await dbAdmin();
    const targetId = invite.room_id ?? invite.session_id;
    if (!targetId) throw new Error('Convite inválido.');
    const { data: target } = await db.from(invite.room_id ? 'rooms' : 'tv_sessions').select('code,status').eq('id', targetId).maybeSingle();
    if (data.accept && (!target || target.status !== 'lobby')) {
      await db.from('game_invites').update({ status: 'declined' }).eq('id', data.id).eq('status', 'pending');
      throw new Error('A partida já começou ou foi encerrada.');
    }
    const { data: updated, error } = await db.from('game_invites').update({ status: data.accept ? 'accepted' : 'declined' }).eq('id', data.id).eq('status', 'pending').select('id');
    if (error) throw new Error('Não foi possível responder.');
    if (!updated?.length) throw new Error('Convite já respondido.');
    await db.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', context.userId).eq('actor_id', invite.sender_id).eq('kind', 'game_invite').is('read_at', null);
    return { code: data.accept ? (target?.code ?? null) : null, tv: !!invite.session_id };
  });

export const socialHeartbeat = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await account(context.supabase);
  const { error } = await context.supabase.from('profiles').update({ last_active: new Date().toISOString() }).eq('id', context.userId);
  if (error) throw error;
  return { ok: true };
});

export const saveAccountProfile = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/, 'Use 3 a 20 letras minúsculas, números ou _.'), bio: z.string().trim().max(160) }).parse(d))
  .handler(async ({ data, context }) => {
    await account(context.supabase);
    const { error } = await context.supabase.from('profiles').update(data).eq('id', context.userId);
    if (error) throw new Error(error.code === '23505' ? 'Este @usuário já está em uso.' : 'Não foi possível salvar.');
    return { ok: true };
  });
