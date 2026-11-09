import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trophy, Gamepad2, UserPlus, Check, X, ShieldAlert, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { TopBar } from "@/components/Chrome";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/metadata";
import { friendshipAction, createRoom, sendInvite } from "@/lib/api/social.functions";
import { getLocalPreferences, blockUser } from "@/lib/socialPreferences";

export const Route = createFileRoute("/jogador/$username")({
  head: ({ params }) =>
    pageHead(`@${params.username} — FOTO PLAY`, "Perfil de jogador no FOTO PLAY."),
  component: PlayerProfilePage,
});

function PlayerProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queries = useQueryClient();

  const change = useServerFn(friendshipAction);
  const [busy, setBusy] = useState(false);
  const prefs = getLocalPreferences(user?.id);

  const { data: player, isLoading, error } = useQuery({
    queryKey: ["player", username, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_players", { term: username });
      if (error) throw error;
      return data?.find((p) => p.username?.toLowerCase() === username.toLowerCase()) ?? null;
    },
  });

  const { data: friendship } = useQuery({
    queryKey: ["player-friendship", player?.id, user?.id],
    enabled: !!user && !!player?.id,
    queryFn: async () => {
      if (!player?.id || !user?.id) return null;
      const { data } = await supabase
        .from("friendships")
        .select("*")
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${player.id}),and(sender_id.eq.${player.id},recipient_id.eq.${user.id})`)
        .maybeSingle();
      return data;
    },
  });

  const isMe = user?.id === player?.id;
  const isBlocked = player ? prefs.blocked.includes(player.id) : false;

  const handleAction = async (action: any) => {
    if (!player) return;
    setBusy(true);
    try {
      await change({ data: { userId: player.id, action } });
      queries.invalidateQueries({ queryKey: ["player-friendship"] });
      queries.invalidateQueries({ queryKey: ["social"] });
      toast.success("Solicitação atualizada!");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  };

  const handleBlock = async () => {
    if (!user || !player) return;
    if (confirm(`Tem certeza que deseja bloquear @${player.username}?`)) {
      await blockUser(user.id, player.id);
      toast.success("Usuário bloqueado.");
      navigate({ to: "/amigos" });
    }
  };

  return (
    <div className="min-h-screen bg-hero">
      <TopBar />
      <main className="mx-auto max-w-lg px-4 py-8 pb-16">
        <Link to="/amigos" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar para Amizades
        </Link>

        {!user ? (
          <div className="rounded-3xl border-2 border-ink bg-card p-8 text-center shadow-pop">
            <h2 className="text-xl font-bold">Entre na sua conta</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Você precisa estar conectado para visualizar o perfil público de @{username}.
            </p>
            <Button variant="pop" className="mt-4" onClick={() => navigate({ to: "/auth" })}>
              Entrar
            </Button>
          </div>
        ) : isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground mt-2">Carregando jogador...</p>
          </div>
        ) : error || !player ? (
          <div className="rounded-3xl border-2 border-ink bg-card p-8 text-center shadow-pop">
            <h2 className="text-2xl font-extrabold">Jogador não encontrado</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Não encontramos nenhum jogador com o @usuário <strong>@{username}</strong>.
            </p>
            <Button variant="pop" className="mt-4" onClick={() => navigate({ to: "/amigos" })}>
              Buscar outros amigos
            </Button>
          </div>
        ) : (
          <div className="rounded-3xl border-2 border-ink bg-card p-6 shadow-pop space-y-6">
            {/* Header info */}
            <div className="flex flex-col items-center text-center">
              <PlayerAvatar
                photoPath={player.photo_path}
                avatar={player.avatar}
                size={84}
                className="shadow-pop-sm mb-3"
              />
              <h1 className="text-3xl font-extrabold">{player.nickname}</h1>
              <p className="text-sm font-bold text-primary">@{player.username}</p>
              {player.bio && (
                <p className="mt-2 text-sm text-muted-foreground max-w-xs">{player.bio}</p>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-sky/30 p-3 shadow-pop-sm">
                <Gamepad2 className="h-6 w-6 text-sky" />
                <div>
                  <p className="text-xl font-black">{player.matches}</p>
                  <p className="text-xs text-muted-foreground font-medium">Partidas</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-accent p-3 shadow-pop-sm">
                <Trophy className="h-6 w-6 text-emerald-800" />
                <div>
                  <p className="text-xl font-black">{player.wins}</p>
                  <p className="text-xs text-muted-foreground font-medium">Vitórias</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            {!isMe && (
              <div className="border-t border-border pt-4 flex flex-col gap-2">
                {!friendship ? (
                  <Button
                    variant="popLime"
                    size="lg"
                    disabled={busy || isBlocked}
                    onClick={() => handleAction("request")}
                    className="w-full"
                  >
                    <UserPlus className="h-5 w-5 mr-2" /> Enviar solicitação de amizade
                  </Button>
                ) : friendship.status === "accepted" ? (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-accent text-emerald-950 font-bold text-sm">
                    <span className="flex items-center gap-1.5">
                      <Check className="h-4 w-4" /> Vocês são amigos!
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => handleAction("remove")}
                      className="text-xs hover:text-destructive"
                    >
                      Desfazer amizade
                    </Button>
                  </div>
                ) : friendship.recipient_id === user.id ? (
                  <div className="flex gap-2">
                    <Button
                      variant="popLime"
                      size="lg"
                      className="flex-1"
                      disabled={busy}
                      onClick={() => handleAction("accept")}
                    >
                      <Check className="h-4 w-4 mr-1" /> Aceitar Amizade
                    </Button>
                    <Button
                      variant="ghost"
                      size="lg"
                      disabled={busy}
                      onClick={() => handleAction("reject")}
                    >
                      Recusar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted text-sm font-medium">
                    <span>Solicitação enviada</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => handleAction("cancel")}
                    >
                      Cancelar
                    </Button>
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBlock}
                  className="mt-2 text-xs text-muted-foreground hover:text-destructive self-center"
                >
                  <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Bloquear jogador
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
