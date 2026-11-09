import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { InfoPage } from '@/components/InfoPage';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/jogador/$username')({head:({params})=>pageHead(`@${params.username}`,'Perfil de jogador no Foto Play.'),component:Player});
function Player(){const {username}=Route.useParams();const {user}=useAuth();const {data,isLoading,error}=useQuery({queryKey:['player',username,user?.id],enabled:!!user,queryFn:async()=>{const {data,error}=await supabase.rpc('search_players',{term:username});if(error)throw error;return data?.find(p=>p.username===username)??null;}});return <InfoPage title={`@${username}`}>{!user?<p>Entre ou continue como visitante pelo início para consultar este perfil.</p>:isLoading?<p>Carregando…</p>:error?<p>Não foi possível carregar o perfil.</p>:!data?<p>Jogador não encontrado.</p>:<><PlayerAvatar avatar={data.avatar} photoPath={data.photo_path} size={96}/><h2>{data.nickname}</h2><p>{data.bio}</p><div className="flex gap-6"><p><strong>{data.matches}</strong> partidas</p><p><strong>{data.wins}</strong> vitórias</p></div></>}</InfoPage>;}
