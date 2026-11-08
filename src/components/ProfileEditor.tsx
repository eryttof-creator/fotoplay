import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "./PlayerAvatar";
import { PhotoCropper } from "./PhotoCropper";
import { AVATARS } from "@/lib/games/catalog";
import { uploadPhoto } from "@/lib/photos";
import { ensureSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export interface ProfileDraft {
  nickname: string;
  avatar: string;
  photo_path: string | null;
}

export function ProfileEditor({
  initial,
  submitLabel,
  onSubmit,
  extra,
}: {
  initial: ProfileDraft;
  submitLabel: string;
  onSubmit: (p: ProfileDraft) => Promise<void>;
  extra?: React.ReactNode;
}) {
  const [draft, setDraft] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (file)
    return (
      <PhotoCropper
        file={file}
        onCancel={() => setFile(null)}
        onDone={async (blob) => {
          setFile(null);
          setUploading(true);
          try {
            const uid = await ensureSession();
            const path = await uploadPhoto(uid, blob);
            setPreview(URL.createObjectURL(blob));
            setDraft((d) => ({ ...d, photo_path: path }));
          } catch {
            toast.error("Não foi possível enviar a foto.");
          } finally {
            setUploading(false);
          }
        }}
      />
    );

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!draft.nickname.trim()) {
          toast.error("Escolha um apelido.");
          return;
        }
        setBusy(true);
        try {
          await onSubmit({ ...draft, nickname: draft.nickname.trim() });
        } catch (err: any) {
          toast.error(err?.message ?? "Algo deu errado.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <PlayerAvatar photoPath={draft.photo_path} avatar={draft.avatar} previewUrl={preview} size={96} />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
              <Loader2 className="animate-spin" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="popLime" size="sm" onClick={() => inputRef.current?.click()}>
            <Camera /> {draft.photo_path ? "Trocar foto" : "Enviar foto"}
          </Button>
          {draft.photo_path && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setDraft((d) => ({ ...d, photo_path: null })); setPreview(null); }}>
              <Trash2 /> Usar avatar
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {!draft.photo_path && (
        <div>
          <p className="mb-2 text-sm font-medium">Ou escolha um avatar</p>
          <div className="grid grid-cols-6 gap-2">
            {Object.entries(AVATARS).map(([k, e]) => (
              <button
                type="button"
                key={k}
                aria-label={`Avatar ${e}`}
                onClick={() => setDraft((d) => ({ ...d, avatar: k }))}
                className={cn(
                  `av-${k} flex aspect-square items-center justify-center rounded-full border-2 text-2xl transition-transform`,
                  draft.avatar === k ? "scale-110 border-ink" : "border-transparent opacity-80",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Apelido</span>
        <Input
          value={draft.nickname}
          maxLength={20}
          placeholder="Como te chamam?"
          onChange={(e) => setDraft((d) => ({ ...d, nickname: e.target.value }))}
          className="h-12 rounded-xl border-2 text-base"
        />
      </label>
      {extra}
      <Button type="submit" variant="pop" size="xl" disabled={busy || uploading}>
        {busy && <Loader2 className="animate-spin" />} {submitLabel}
      </Button>
    </form>
  );
}
