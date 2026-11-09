import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Moon, Sun, UserRound, Volume2, VolumeX, Tv, Users, Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSoundPreference, playSound } from "@/lib/sounds";
import { supabase } from "@/integrations/supabase/client";
import { ensureSession } from "@/lib/session";
import { useAuth } from "@/lib/auth";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-display text-2xl font-extrabold ${className}`}>
      <span className="flex h-9 w-9 -rotate-6 items-center justify-center rounded-xl border-2 border-ink bg-primary text-primary-foreground shadow-pop-sm">📸</span>
      <span>FOTO<span className="text-primary">PLAY</span></span>
    </Link>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const d = localStorage.getItem("fp-theme") === "dark";
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
  }, []);
  return (
    <button
      aria-label="Alternar tema"
      className="press flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink bg-card shadow-pop-sm"
      onClick={() => {
        const d = !dark;
        setDark(d);
        localStorage.setItem("fp-theme", d ? "dark" : "light");
        document.documentElement.classList.toggle("dark", d);
      }}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

export function TopBar({ right }: { right?: React.ReactNode }) {
  const sound = useSoundPreference();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Listen for invites and friend requests
  useEffect(() => {
    if (!user || user.is_anonymous) return;

    const checkPending = async () => {
      try {
        const [{ count: inviteCount }, { count: notifCount }] = await Promise.all([
          supabase
            .from("game_invites")
            .select("id", { count: "exact", head: true })
            .eq("recipient_id", user.id)
            .eq("status", "pending"),
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .is("read_at", null),
        ]);
        setUnreadCount((inviteCount ?? 0) + (notifCount ?? 0));
      } catch {}
    };

    checkPending();

    const channel = supabase
      .channel(`global-notifs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_invites", filter: `recipient_id=eq.${user.id}` },
        async (payload: any) => {
          checkPending();
          playSound("round");
          const invite = payload.new;
          if (invite?.status === "pending") {
            const { data: sender } = await supabase
              .from("profiles")
              .select("nickname")
              .eq("id", invite.sender_id)
              .maybeSingle();

            const senderName = sender?.nickname || "Um amigo";

            toast(
              <div className="flex flex-col gap-2">
                <p className="font-bold text-sm">
                  🎮 {senderName} convidou você para jogar!
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="popLime"
                    onClick={async () => {
                      try {
                        const { data: room } = await supabase
                          .from(invite.room_id ? "rooms" : "tv_sessions")
                          .select("code")
                          .eq("id", invite.room_id ?? invite.session_id)
                          .maybeSingle();
                        await supabase
                          .from("game_invites")
                          .update({ status: "accepted" })
                          .eq("id", invite.id);
                        if (room?.code) {
                          if (invite.room_id) {
                            navigate({ to: "/sala/$code", params: { code: room.code } });
                          } else {
                            navigate({ to: "/tv/controle/$code", params: { code: room.code } });
                          }
                        }
                      } catch {}
                    }}
                  >
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await supabase
                        .from("game_invites")
                        .update({ status: "declined" })
                        .eq("id", invite.id);
                      checkPending();
                    }}
                  >
                    Recusar
                  </Button>
                </div>
              </div>,
              { duration: 10000 }
            );
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          checkPending();
          playSound("tap");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
      <Logo />
      <div className="flex flex-wrap items-center gap-2">
        {right}
        <Link
          to="/tv"
          className="press inline-flex h-10 items-center gap-1.5 rounded-xl border-2 border-ink bg-card px-3 text-sm font-bold shadow-pop-sm hover:bg-muted"
        >
          <Tv className="h-4 w-4 text-primary" />
          <span>Modo TV</span>
        </Link>
        <Link
          to="/amigos"
          className="press relative inline-flex h-10 items-center gap-1.5 rounded-xl border-2 border-ink bg-card px-3 text-sm font-bold shadow-pop-sm hover:bg-muted"
        >
          <Users className="h-4 w-4 text-sky" />
          <span>Amizades</span>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-black text-primary-foreground animate-pulse">
              {unreadCount}
            </span>
          )}
        </Link>
        {user && !user.is_anonymous ? (
          <Button variant="ghost" size="sm" onClick={logout} className="h-10 text-xs">
            Sair
          </Button>
        ) : (
          <Link to="/auth" className="text-sm font-bold underline px-1">
            Entrar
          </Link>
        )}
        <Button
          variant="popPlain"
          size="icon"
          className="h-10 w-10"
          aria-label={sound.on ? "Silenciar sons" : "Ativar sons"}
          title={sound.on ? "Silenciar sons" : "Ativar sons"}
          aria-pressed={sound.on}
          onClick={sound.toggle}
        >
          {sound.on ? <Volume2 /> : <VolumeX />}
        </Button>
        <Link
          to="/perfil"
          aria-label="Meu perfil"
          className="press flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink bg-card shadow-pop-sm"
        >
          <UserRound className="h-5 w-5" />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}

/** Real count of people with FOTO PLAY open right now (shared presence channel). */
export function useOnlineCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let live = true;
    ensureSession().then((uid) => {
      if (!live) return;
      channel = supabase.channel("fotoplay-online", { config: { presence: { key: uid } } });
      channel
        .on("presence", { event: "sync" }, () => { if (channel) setCount(Object.keys(channel.presenceState()).length); })
        .subscribe((s) => {
          if (s === "SUBSCRIBED") channel?.track({ at: Date.now() });
        });
    });
    return () => {
      live = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);
  return count;
}

export function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 60 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      dur: 2 + Math.random() * 2,
      color: ["var(--coral)", "var(--lime)", "var(--sky)", "var(--sun)"][i % 4],
    })),
  );
  return (
    <>
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece" style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
      ))}
    </>
  );
}
