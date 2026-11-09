import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Star,
  Gamepad2,
  Trash2,
  Shield,
  ShieldAlert,
  Search,
  Bell,
  Check,
  X,
  Clock,
  Sparkles,
} from "lucide-react";
import { TopBar } from "@/components/Chrome";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  socialData,
  friendshipAction,
  answerInvite,
  sendInvite,
} from "@/lib/api/social.functions";
import { createRoom } from "@/lib/api/rooms.functions";
import { pageHead } from "@/lib/metadata";
import {
  getLocalPreferences,
  toggleFavorite,
  blockUser,
  unblockUser,
} from "@/lib/socialPreferences";

export const Route = createFileRoute("/amigos")({
  head: () =>
    pageHead(
      "Amizades — FOTO PLAY",
      "Gerencie seus amigos, aceite solicitações, envie convites para partidas e marque seus favoritos."
    ),
  component: FriendsHub,
});

type Tab = "amigos" | "favoritos" | "solicitacoes" | "adicionar" | "bloqueados";

function FriendsHub() {
  const { user, loading } = useAuth();
  const account = !!user && !user.is_anonymous;
  const queries = useQueryClient();
  const navigate = useNavigate();

  const fetchSocial = useServerFn(socialData);
  const change = useServerFn(friendshipAction);
  const acceptInvite = useServerFn(answerInvite);
  const invite = useServerFn(sendInvite);
  const newRoom = useServerFn(createRoom);

  const { data, error } = useQuery({
    queryKey: ["social", user?.id],
    queryFn: () => fetchSocial(),
    enabled: account,
    refetchInterval: 20000,
  });

  const [activeTab, setActiveTab] = useState<Tab>("amigos");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Array<any>>([]);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState(() => getLocalPreferences(user?.id));

  const refresh = () => {
    queries.invalidateQueries({ queryKey: ["social"] });
    setPrefs(getLocalPreferences(user?.id));
  };

  useEffect(() => {
    if (!account) return;
    const ch = supabase
      .channel(`social-hub-${user?.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        void refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        void refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_invites" }, () => {
        void refresh();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [account, user?.id, queries]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  };

  // Accepted friends
  const acceptedFriendships = (data?.friendships || []).filter((f) => f.status === "accepted");
  const acceptedFriendIds = new Set(
    acceptedFriendships
      .flatMap((f) => [f.sender_id, f.recipient_id])
      .filter((id) => id !== user?.id)
  );

  const allFriends = (data?.profiles || []).filter(
    (p) => acceptedFriendIds.has(p.id) && !prefs.blocked.includes(p.id)
  );

  // Pending requests received and sent
  const pendingReceived = (data?.friendships || []).filter(
    (f) => f.recipient_id === user?.id && f.status === "pending"
  );
  const pendingSent = (data?.friendships || []).filter(
    (f) => f.sender_id === user?.id && f.status === "pending"
  );
  const pendingTotal = pendingReceived.length;

  // Favorites
  const favoriteFriends = allFriends.filter((f) => prefs.favorites.includes(f.id));

  // Blocked profiles
  const blockedProfiles = (data?.profiles || []).filter((p) => prefs.blocked.includes(p.id));

  const handleToggleFavorite = async (friendId: string) => {
    if (!user) return;
    const isNowFav = await toggleFavorite(user.id, friendId);
    setPrefs(getLocalPreferences(user.id));
    toast.success(isNowFav ? "Adicionado aos favoritos ⭐" : "Removido dos favoritos");
  };

  const handleBlock = async (targetId: string, name: string) => {
    if (!user) return;
    if (confirm(`Deseja bloquear ${name}? Ele não poderá enviar solicitações nem convites.`)) {
      await blockUser(user.id, targetId);
      setPrefs(getLocalPreferences(user.id));
      toast.success(`${name} foi bloqueado.`);
    }
  };

  const handleUnblock = async (targetId: string) => {
    if (!user) return;
    await unblockUser(user.id, targetId);
    setPrefs(getLocalPreferences(user.id));
    toast.success("Usuário desbloqueado.");
  };

  const handleInviteToPlay = async (friendId: string) => {
    await run(async () => {
      const { data: p, error } = await supabase
        .from("profiles")
        .select("nickname,avatar,photo_path")
        .eq("id", user?.id ?? "")
        .single();
      if (error) throw error;

      const r = await newRoom({ data: { ...p, nickname: p.nickname || "Jogador" } });
      const { data: room } = await supabase
        .from("rooms")
        .select("id")
        .eq("code", r.code)
        .single();
      if (!room) throw new Error("Sala não encontrada.");
      await invite({ data: { userId: friendId, roomId: room.id } });
      toast.success("Convite enviado! Entrando na sala...");
      await navigate({ to: "/sala/$code", params: { code: r.code } });
    });
  };

  return (
    <div className="min-h-screen bg-hero">
      <TopBar />
      <main className="mx-auto max-w-5xl px-4 py-8 pb-20">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-sky/30 px-3 py-1 text-xs font-bold shadow-pop-sm">
              <Users className="h-3.5 w-3.5" /> COMUNIDADE FOTO PLAY
            </div>
            <h1 className="text-4xl font-extrabold sm:text-5xl">Sistema de Amizades</h1>
            <p className="mt-1 text-muted-foreground">
              Conecte-se com seus amigos, monte partidas privadas e jogue com suas fotos.
            </p>
          </div>
          <Button
            variant="pop"
            size="lg"
            onClick={() => setActiveTab("adicionar")}
            className="flex items-center gap-2"
          >
            <UserPlus className="h-5 w-5" /> Adicionar Amigo
          </Button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Carregando perfil...</div>
        ) : !account ? (
          <div className="rounded-3xl border-2 border-ink bg-card p-8 text-center shadow-pop">
            <Users className="mx-auto h-16 w-16 text-primary mb-3" />
            <h2 className="text-2xl font-extrabold">Crie sua conta para fazer amigos!</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Com uma conta você ganha seu @usuário exclusivo, foto de perfil protegida, lista de amigos e
              convites diretos para salas.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="pop" size="lg" onClick={() => navigate({ to: "/auth" })}>
                Entrar na conta
              </Button>
              <Button variant="popLime" size="lg" onClick={() => navigate({ to: "/cadastro" })}>
                Criar conta gratuita
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tabs Bar */}
            <div className="flex flex-wrap gap-2 border-b-2 border-ink/20 pb-3">
              <button
                onClick={() => setActiveTab("amigos")}
                className={`press flex items-center gap-2 rounded-2xl border-2 px-4 py-2 font-bold text-sm transition-all ${
                  activeTab === "amigos"
                    ? "border-ink bg-primary text-primary-foreground shadow-pop-sm"
                    : "border-ink/20 bg-card hover:border-ink"
                }`}
              >
                <Users className="h-4 w-4" /> Todos ({allFriends.length})
              </button>
              <button
                onClick={() => setActiveTab("favoritos")}
                className={`press flex items-center gap-2 rounded-2xl border-2 px-4 py-2 font-bold text-sm transition-all ${
                  activeTab === "favoritos"
                    ? "border-ink bg-sun text-ink shadow-pop-sm"
                    : "border-ink/20 bg-card hover:border-ink"
                }`}
              >
                <Star className="h-4 w-4" /> Favoritos ({favoriteFriends.length})
              </button>
              <button
                onClick={() => setActiveTab("solicitacoes")}
                className={`press relative flex items-center gap-2 rounded-2xl border-2 px-4 py-2 font-bold text-sm transition-all ${
                  activeTab === "solicitacoes"
                    ? "border-ink bg-lime text-ink shadow-pop-sm"
                    : "border-ink/20 bg-card hover:border-ink"
                }`}
              >
                <Bell className="h-4 w-4" /> Solicitações
                {pendingTotal > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">
                    {pendingTotal}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("adicionar")}
                className={`press flex items-center gap-2 rounded-2xl border-2 px-4 py-2 font-bold text-sm transition-all ${
                  activeTab === "adicionar"
                    ? "border-ink bg-sky text-ink shadow-pop-sm"
                    : "border-ink/20 bg-card hover:border-ink"
                }`}
              >
                <UserPlus className="h-4 w-4" /> Pesquisar @usuário
              </button>
              <button
                onClick={() => setActiveTab("bloqueados")}
                className={`press flex items-center gap-2 rounded-2xl border-2 px-4 py-2 font-bold text-sm transition-all ${
                  activeTab === "bloqueados"
                    ? "border-ink bg-muted text-foreground shadow-pop-sm"
                    : "border-ink/20 bg-card hover:border-ink"
                }`}
              >
                <Shield className="h-4 w-4" /> Privacidade & Bloqueios
              </button>
            </div>

            {/* TAB: AMIGOS (TODOS) */}
            {activeTab === "amigos" && (
              <section className="space-y-4">
                {allFriends.length === 0 ? (
                  <div className="rounded-3xl border-2 border-dashed border-ink/30 bg-card p-10 text-center">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                    <h3 className="text-xl font-bold">Nenhum amigo adicionado ainda</h3>
                    <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                      Pesquise pelo @usuário dos seus amigos para adicioná-los e jogar juntos!
                    </p>
                    <Button
                      variant="pop"
                      size="sm"
                      onClick={() => setActiveTab("adicionar")}
                      className="mt-4"
                    >
                      Pesquisar amigos
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {allFriends.map((friend) => {
                      const isFav = prefs.favorites.includes(friend.id);
                      const isOnline =
                        friend.last_active &&
                        Date.now() - new Date(friend.last_active).getTime() < 65000;

                      return (
                        <div
                          key={friend.id}
                          className="flex flex-col justify-between rounded-3xl border-2 border-ink bg-card p-4 shadow-pop-sm"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <PlayerAvatar
                                photoPath={friend.photo_path}
                                avatar={friend.avatar}
                                size={50}
                              />
                              <span
                                className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card ${
                                  isOnline ? "bg-success" : "bg-muted-foreground"
                                }`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  to="/jogador/$username"
                                  params={{ username: friend.username ?? "" }}
                                  className="font-extrabold text-base truncate hover:underline"
                                >
                                  {friend.nickname}
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleToggleFavorite(friend.id)}
                                  title={isFav ? "Remover dos favoritos" : "Marcar como favorito"}
                                  className="press text-muted-foreground hover:text-sun"
                                >
                                  <Star
                                    className={`h-4 w-4 ${
                                      isFav ? "fill-sun text-sun" : "text-muted-foreground"
                                    }`}
                                  />
                                </button>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                @{friend.username} · {isOnline ? "Online agora" : "Offline"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                            <Button
                              variant="popLime"
                              size="sm"
                              disabled={busy}
                              onClick={() => handleInviteToPlay(friend.id)}
                              className="text-xs"
                            >
                              <Gamepad2 className="h-3.5 w-3.5 mr-1" /> Convidar
                            </Button>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => run(() => change({ data: { userId: friend.id, action: "remove" } }))}
                                className="text-xs text-muted-foreground hover:text-destructive"
                              >
                                Remover
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleBlock(friend.id, friend.nickname)}
                                className="text-xs text-muted-foreground hover:text-destructive"
                                title="Bloquear"
                              >
                                Bloquear
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* TAB: FAVORITOS */}
            {activeTab === "favoritos" && (
              <section className="space-y-4">
                {favoriteFriends.length === 0 ? (
                  <div className="rounded-3xl border-2 border-dashed border-ink/30 bg-card p-10 text-center">
                    <Star className="mx-auto h-12 w-12 text-sun mb-3" />
                    <h3 className="text-xl font-bold">Nenhum amigo favoritado ainda</h3>
                    <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                      Clique na estrelinha ⭐ ao lado do nome de um amigo para adicioná-lo aos favoritos e
                      encontrá-lo facilmente nas partidas!
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {favoriteFriends.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between rounded-3xl border-2 border-ink bg-card p-4 shadow-pop-sm"
                      >
                        <div className="flex items-center gap-3">
                          <PlayerAvatar
                            photoPath={friend.photo_path}
                            avatar={friend.avatar}
                            size={44}
                          />
                          <div>
                            <p className="font-extrabold flex items-center gap-1 text-sm">
                              {friend.nickname}
                              <Star className="h-3.5 w-3.5 fill-sun text-sun" />
                            </p>
                            <p className="text-xs text-muted-foreground">@{friend.username}</p>
                          </div>
                        </div>
                        <Button
                          variant="pop"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleInviteToPlay(friend.id)}
                        >
                          Jogar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* TAB: SOLICITAÇÕES */}
            {activeTab === "solicitacoes" && (
              <div className="space-y-6">
                {/* Received */}
                <div>
                  <h3 className="text-xl font-extrabold mb-3">Solicitações Recebidas ({pendingReceived.length})</h3>
                  {pendingReceived.length === 0 ? (
                    <p className="text-sm text-muted-foreground rounded-2xl border-2 border-dashed border-ink/30 p-6 text-center">
                      Nenhuma solicitação de amizade pendente no momento.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {pendingReceived.map((req) => {
                        const sender = (data?.profiles || []).find((p) => p.id === req.sender_id);
                        return (
                          <div
                            key={req.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-ink bg-card p-4 shadow-pop-sm"
                          >
                            <div className="flex items-center gap-3">
                              {sender && (
                                <PlayerAvatar
                                  photoPath={sender.photo_path}
                                  avatar={sender.avatar}
                                  size={44}
                                />
                              )}
                              <div>
                                <p className="font-bold">{sender?.nickname || "Um jogador"}</p>
                                <p className="text-xs text-muted-foreground">@{sender?.username}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="popLime"
                                size="sm"
                                disabled={busy}
                                onClick={() => run(() => change({ data: { userId: req.sender_id, action: "accept" } }))}
                              >
                                <Check className="h-4 w-4 mr-1" /> Aceitar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => run(() => change({ data: { userId: req.sender_id, action: "reject" } }))}
                              >
                                <X className="h-4 w-4 mr-1" /> Recusar
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Sent */}
                {pendingSent.length > 0 && (
                  <div className="border-t border-border pt-4">
                    <h3 className="text-lg font-bold mb-3 text-muted-foreground">
                      Solicitações Enviadas ({pendingSent.length})
                    </h3>
                    <div className="space-y-2">
                      {pendingSent.map((req) => {
                        const recipient = (data?.profiles || []).find((p) => p.id === req.recipient_id);
                        return (
                          <div
                            key={req.id}
                            className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3"
                          >
                            <span className="text-sm font-medium">
                              @{recipient?.username || "Jogador"} (Aguardando resposta)
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => run(() => change({ data: { userId: req.recipient_id, action: "cancel" } }))}
                            >
                              Cancelar
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: ADICIONAR AMIGO */}
            {activeTab === "adicionar" && (
              <div className="space-y-6">
                <div className="rounded-3xl border-2 border-ink bg-card p-6 shadow-pop">
                  <h3 className="text-xl font-extrabold mb-2">Pesquisar Jogadores</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Digite o @usuário ou nome do amigo para encontrá-lo e enviar solicitação.
                  </p>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        const { data: res, error } = await supabase.rpc("search_players", { term });
                        if (error) throw error;
                        setResults((res ?? []).filter((x) => x.id !== user?.id && !prefs.blocked.includes(x.id)));
                      });
                    }}
                  >
                    <Input
                      aria-label="Pesquisar @usuário"
                      placeholder="Ex: @erick ou nome..."
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                      required
                      className="h-12 text-base"
                    />
                    <Button variant="pop" size="lg" disabled={busy}>
                      <Search className="h-5 w-5 mr-1" /> Buscar
                    </Button>
                  </form>
                </div>

                {results.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-lg font-bold">Resultados da busca ({results.length})</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {results.map((player) => {
                        const existingFriendship = (data?.friendships || []).find(
                          (x) => x.sender_id === player.id || x.recipient_id === player.id
                        );

                        return (
                          <div
                            key={player.id}
                            className="flex items-center justify-between rounded-2xl border-2 border-ink bg-card p-4 shadow-pop-sm"
                          >
                            <div className="flex items-center gap-3">
                              <PlayerAvatar
                                photoPath={player.photo_path}
                                avatar={player.avatar}
                                size={44}
                              />
                              <div>
                                <Link
                                  to="/jogador/$username"
                                  params={{ username: player.username }}
                                  className="font-bold hover:underline"
                                >
                                  {player.nickname}
                                </Link>
                                <p className="text-xs text-muted-foreground">@{player.username}</p>
                              </div>
                            </div>

                            <div>
                              {!existingFriendship ? (
                                <Button
                                  variant="popLime"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => run(() => change({ data: { userId: player.id, action: "request" } }))}
                                >
                                  <UserPlus className="h-4 w-4 mr-1" /> Adicionar
                                </Button>
                              ) : existingFriendship.status === "accepted" ? (
                                <span className="text-xs font-bold text-accent-foreground">Amigo ✓</span>
                              ) : existingFriendship.recipient_id === user?.id ? (
                                <Button
                                  variant="popLime"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => run(() => change({ data: { userId: player.id, action: "accept" } }))}
                                >
                                  Aceitar
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">Pendente</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: BLOQUEADOS & PRIVACIDADE */}
            {activeTab === "bloqueados" && (
              <div className="rounded-3xl border-2 border-ink bg-card p-6 shadow-pop space-y-6">
                <div>
                  <h3 className="text-xl font-extrabold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" /> Privacidade e Segurança
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    No Foto Play, seus dados como e-mail e senha são 100% confidenciais e nunca são
                    exibidos a outros jogadores. Suas fotos de perfil são protegidas e visíveis apenas
                    para quem joga na mesma sala ou amigos confirmados.
                  </p>
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-destructive" /> Usuários Bloqueados ({prefs.blocked.length})
                  </h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    Usuários bloqueados não podem enviar solicitações de amizade nem convidar você para partidas.
                  </p>

                  {prefs.blocked.length === 0 ? (
                    <p className="text-sm text-muted-foreground rounded-2xl bg-muted p-4">
                      Você não possui nenhum usuário bloqueado.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {prefs.blocked.map((blockedId) => {
                        const prof = blockedProfiles.find((p) => p.id === blockedId);
                        return (
                          <div
                            key={blockedId}
                            className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/40"
                          >
                            <span className="text-sm font-bold">
                              {prof?.nickname || "Usuário Bloqueado"} (@{prof?.username || "bloqueado"})
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnblock(blockedId)}
                              className="text-xs"
                            >
                              Desbloquear
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
