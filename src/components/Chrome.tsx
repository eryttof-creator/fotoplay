import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Moon, Sun, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureSession } from "@/lib/session";

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
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4">
      <Logo />
      <div className="flex items-center gap-2">
        {right}
        <Link to="/perfil" aria-label="Meu perfil" className="press flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink bg-card shadow-pop-sm">
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
        .on("presence", { event: "sync" }, () => setCount(Object.keys(channel!.presenceState()).length))
        .subscribe((s) => {
          if (s === "SUBSCRIBED") channel!.track({ at: Date.now() });
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
