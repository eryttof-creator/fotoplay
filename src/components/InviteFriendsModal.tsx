import { useEffect, useState } from "react";
import { Users, Send, Check, Clock, X, Star, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { socialData, sendInvite } from "@/lib/api/social.functions";
import { useServerFn } from "@tanstack/react-start";

interface InviteFriendsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  roomCode: string;
  roomStatus: string;
}

export function InviteFriendsModal({
  open,
  onOpenChange,
  roomId,
  roomCode,
  roomStatus,
}: InviteFriendsModalProps) {
  const { user } = useAuth();
  const fetchSocial = useServerFn(socialData);
  const doInvite = useServerFn(sendInvite);

  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [sending, setSending] = useState(false);

  const isLobby = roomStatus === "lobby";
  const [prefs, setPrefs] = useState<{ favorites: string[] }>({ favorites: [] });

  const loadData = async () => {
    if (!user || user.is_anonymous) return;
    setLoading(true);
    try {
      const data = await fetchSocial();
      setPrefs({ favorites: data.favorites ?? [] });
      // Friends are profiles whose friendship is accepted
      const acceptedFriendIds = new Set(
        (data.friendships || [])
          .filter((f: any) => f.status === "accepted")
          .flatMap((f: any) => [f.sender_id, f.recipient_id])
          .filter((id: string) => id !== user.id)
      );

      const friendList = (data.profiles || []).filter((p: any) => acceptedFriendIds.has(p.id) && !(data.blocked ?? []).includes(p.id));

      // Sort favorites first
      friendList.sort((a: any, b: any) => {
        const aFav = (data.favorites ?? []).includes(a.id);
        const bFav = (data.favorites ?? []).includes(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return a.nickname.localeCompare(b.nickname);
      });

      setFriends(friendList);

      // Load invites sent for this room
      const { data: roomInvites } = await supabase
        .from("game_invites")
        .select("*")
        .eq("room_id", roomId);
      setInvites(roomInvites ?? []);
    } catch {
      // Handled silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
      setSelectedIds([]);
    }
  }, [open, roomId]);

  // Realtime subscription to game_invites for this room
  useEffect(() => {
    if (!open || !roomId) return;

    const channel = supabase
      .channel(`room-invites-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_invites", filter: `room_id=eq.${roomId}` },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            setInvites((prev) => [...prev, payload.new]);
          } else if (payload.eventType === "UPDATE") {
            setInvites((prev) =>
              prev.map((inv) => (inv.id === payload.new.id ? payload.new : inv))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, roomId]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const uninvited = friends
      .filter((f) => !invites.some((inv) => inv.recipient_id === f.id))
      .map((f) => f.id);
    if (selectedIds.length === uninvited.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(uninvited);
    }
  };

  const handleSend = async () => {
    if (!selectedIds.length) return;
    setSending(true);
    let count = 0;

    for (const friendId of selectedIds) {
      try {
        await doInvite({ data: { userId: friendId, roomId } });
        count++;
      } catch (err: any) {
        toast.error(`Não foi possível convidar: ${err.message}`);
      }
    }

    if (count > 0) {
      toast.success(`${count} convite(s) enviado(s) com sucesso!`);
      setSelectedIds([]);
      await loadData();
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-2 border-ink max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Convidar Amigos para Jogar
          </DialogTitle>
          <DialogDescription>
            Sala <strong className="font-display tracking-widest text-primary">{roomCode}</strong>.
            Seus amigos receberão uma notificação instantânea para entrar.
          </DialogDescription>
        </DialogHeader>

        {!user || user.is_anonymous ? (
          <div className="rounded-2xl border-2 border-ink bg-sun/30 p-4 text-center">
            <p className="text-sm font-bold">
              Entre em uma conta com e-mail para salvar amigos e poder convidá-los diretamente!
            </p>
          </div>
        ) : !isLobby ? (
          <div className="rounded-2xl border-2 border-ink bg-destructive/10 p-4 text-center flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-destructive shrink-0" />
            <p className="text-sm font-medium">
              A partida já começou ou a sala não está no lobby. Novos convites só podem ser enviados antes do início.
            </p>
          </div>
        ) : loading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground mt-2">Carregando seus amigos...</p>
          </div>
        ) : friends.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-ink/40 p-6 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <h4 className="font-bold">Nenhum amigo adicionado</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Adicione seus amigos pela seção <strong>Amigos</strong> no menu superior pesquisando pelo @usuário deles.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Friends Selector List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold">Seus Amigos ({friends.length})</span>
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs font-bold text-primary underline"
                >
                  {selectedIds.length ===
                  friends.filter((f) => !invites.some((inv) => inv.recipient_id === f.id)).length
                    ? "Desmarcar todos"
                    : "Selecionar todos"}
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {friends.map((friend) => {
                  const isFavorite = prefs.favorites.includes(friend.id);
                  const isOnline =
                    friend.last_active &&
                    Date.now() - new Date(friend.last_active).getTime() < 65000;
                  const alreadyInvited = invites.find((inv) => inv.recipient_id === friend.id);
                  const isChecked = selectedIds.includes(friend.id);

                  return (
                    <div
                      key={friend.id}
                      onClick={() => !alreadyInvited && toggleSelect(friend.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${
                        alreadyInvited
                          ? "border-muted bg-muted/40 opacity-70 cursor-not-allowed"
                          : isChecked
                          ? "border-ink bg-accent shadow-pop-sm cursor-pointer"
                          : "border-ink/20 bg-card hover:border-ink cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked || !!alreadyInvited}
                          disabled={!!alreadyInvited}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-ink text-primary focus:ring-0"
                        />
                        <div className="relative">
                          <PlayerAvatar
                            photoPath={friend.photo_path}
                            avatar={friend.avatar}
                            size={36}
                          />
                          <span
                            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-card ${
                              isOnline ? "bg-success" : "bg-muted-foreground"
                            }`}
                          />
                        </div>
                        <div>
                          <p className="font-bold text-sm flex items-center gap-1">
                            {friend.nickname}
                            {isFavorite && <Star className="h-3 w-3 fill-sun text-sun" />}
                          </p>
                          <p className="text-xs text-muted-foreground">@{friend.username}</p>
                        </div>
                      </div>

                      <div>
                        {alreadyInvited ? (
                          <span className="text-xs font-bold text-muted-foreground">Já convidado</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {isOnline ? "Online" : "Offline"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                variant="pop"
                size="lg"
                disabled={selectedIds.length === 0 || sending}
                onClick={handleSend}
                className="w-full mt-4"
              >
                <Send className="h-4 w-4 mr-2" />
                {sending
                  ? "Enviando convites..."
                  : `Enviar convite${selectedIds.length > 1 ? "s" : ""} (${selectedIds.length})`}
              </Button>
            </div>

            {/* Live Invites Tracking */}
            {invites.length > 0 && (
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> Status dos Convites nesta Sala
                </h4>
                <div className="space-y-2">
                  {invites.map((inv) => {
                    const friend = friends.find((f) => f.id === inv.recipient_id);
                    return (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-muted/40"
                      >
                        <div className="flex items-center gap-2">
                          {friend && (
                            <PlayerAvatar
                              photoPath={friend.photo_path}
                              avatar={friend.avatar}
                              size={28}
                            />
                          )}
                          <span className="font-bold text-sm">
                            {friend ? friend.nickname : "Jogador"}
                          </span>
                        </div>

                        <div>
                          {inv.status === "pending" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sun px-2.5 py-0.5 text-xs font-bold text-ink">
                              <Clock className="h-3 w-3" /> Aguardando
                            </span>
                          )}
                          {inv.status === "accepted" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-emerald-900">
                              <Check className="h-3 w-3" /> Aceitou
                            </span>
                          )}
                          {inv.status === "declined" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                              <X className="h-3 w-3" /> Recusou
                            </span>
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
      </DialogContent>
    </Dialog>
  );
}
