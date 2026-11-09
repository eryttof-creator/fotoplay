import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Trophy, Gamepad2, Frown, Star, Shield, Lock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/Chrome";
import { ProfileEditor } from "@/components/ProfileEditor";
import { useMyProfile } from "@/lib/profile";
import { gameInfo } from "@/lib/games/catalog";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { saveAccountProfile } from "@/lib/api/social.functions";
import { useServerFn } from "@tanstack/react-start";
import { getLocalPreferences, setProfilePrivacy } from "@/lib/socialPreferences";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — FOTO PLAY" },
      { name: "description", content: "Sua foto, apelido, vitórias, derrotas e jogos favoritos no FOTO PLAY." },
      { property: "og:title", content: "Meu perfil — FOTO PLAY" },
      { property: "og:description", content: "Veja suas estatísticas de partidas no FOTO PLAY." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, loading, save, reload } = useMyProfile();
  const { user } = useAuth();
  const saveAccount = useServerFn(saveAccountProfile);
  const [username, setUsername] = useState<string | undefined>();
  const [bio, setBio] = useState<string | undefined>();
  const [isPrivate, setIsPrivate] = useState<boolean>(false);

  useEffect(() => {
    if (user?.id) {
      const prefs = getLocalPreferences(user.id);
      setIsPrivate(prefs.isPrivate);
    }
  }, [user?.id]);

  const favorites = Object.entries(profile?.game_counts ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return (
    <div className="min-h-screen bg-hero">
      <TopBar />
      <main className="mx-auto grid max-w-4xl gap-6 px-4 pb-16 md:grid-cols-2">
        {loading || !profile ? (
          <Loader2 className="mx-auto animate-spin" />
        ) : (
          <>
            <section className="rounded-3xl border-2 border-ink bg-card p-6 shadow-pop">
              <div className="mb-5 flex items-center justify-between">
                <h1 className="text-3xl font-extrabold">Meu perfil</h1>
                {profile.username && (
                  <Link
                    to="/jogador/$username"
                    params={{ username: profile.username }}
                    className="flex items-center gap-1 text-xs font-bold text-primary underline"
                  >
                    Ver público <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
              <ProfileEditor
                extra={
                  user && !user.is_anonymous ? (
                    <>
                      <label className="space-y-2">
                        <span className="text-sm font-bold">@usuário exclusivo</span>
                        <Input
                          required
                          minLength={3}
                          maxLength={20}
                          pattern="[a-z0-9_]{3,20}"
                          value={username ?? profile.username ?? ""}
                          onChange={(e) => setUsername(e.target.value.toLowerCase())}
                          placeholder="ex: joaosilva"
                        />
                        <span className="text-xs text-muted-foreground block">
                          Seu identificador único para amigos encontrarem você.
                        </span>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-bold">Sobre você (Bio)</span>
                        <Input
                          maxLength={160}
                          value={bio ?? profile.bio ?? ""}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Fã de jogos com a galera..."
                        />
                      </label>
                      <div className="flex items-center justify-between rounded-2xl border-2 border-ink bg-muted/50 p-3">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-xs font-bold">Perfil Privado</p>
                            <p className="text-[11px] text-muted-foreground">
                              Apenas amigos podem ver fotos e status.
                            </p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isPrivate}
                          onChange={async (e) => {
                            const val = e.target.checked;
                            setIsPrivate(val);
                            if (user?.id) await setProfilePrivacy(user.id, val);
                          }}
                          className="h-5 w-5 rounded border-ink text-primary focus:ring-0"
                        />
                      </div>
                    </>
                  ) : undefined
                }
                initial={{ nickname: profile.nickname, avatar: profile.avatar, photo_path: profile.photo_path }}
                submitLabel="Salvar perfil"
                onSubmit={async (p) => {
                  if (user && !user.is_anonymous) {
                    await saveAccount({
                      data: {
                        username: username ?? profile.username ?? "",
                        bio: bio ?? profile.bio ?? "",
                      },
                    });
                    if (user?.id) await setProfilePrivacy(user.id, isPrivate);
                  }
                  await save(p);
                  await reload();
                  toast.success("Perfil salvo com sucesso!");
                }}
              />
            </section>
            <section className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Gamepad2, label: "Partidas", value: profile.matches, cls: "bg-sky" },
                  { icon: Trophy, label: "Vitórias", value: profile.wins, cls: "bg-accent" },
                  { icon: Frown, label: "Derrotas", value: profile.losses, cls: "bg-primary text-primary-foreground" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-3xl border-2 border-ink p-4 shadow-pop-sm ${s.cls}`}>
                    <s.icon className="mb-2 h-5 w-5" />
                    <p className="font-display text-3xl font-extrabold">{s.value}</p>
                    <p className="text-xs font-medium">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-3xl border-2 border-ink bg-card p-5 shadow-pop-sm">
                <h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><Star className="h-5 w-5 text-primary" /> Jogos favoritos</h2>
                {favorites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Jogue algumas partidas para ver seus favoritos aqui.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {favorites.map(([id, n]) => (
                      <li key={id} className="flex items-center gap-3 rounded-2xl bg-muted p-3">
                        <span className="text-2xl">{gameInfo(id).emoji}</span>
                        <span className="flex-1 font-bold">{gameInfo(id).name}</span>
                        <span className="text-sm text-muted-foreground">{n} partida(s)</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
