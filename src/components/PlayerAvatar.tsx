import { useSignedUrl } from "@/lib/photos";
import { AVATARS } from "@/lib/games/catalog";
import { cn } from "@/lib/utils";

export function PlayerAvatar({
  photoPath,
  avatar,
  size = 48,
  className,
  ring,
  square,
  previewUrl,
}: {
  photoPath?: string | null | undefined;
  avatar?: string | undefined;
  size?: number;
  className?: string;
  ring?: boolean;
  square?: boolean;
  previewUrl?: string | null;
}) {
  const signed = useSignedUrl(previewUrl ? null : photoPath);
  const url = previewUrl ?? signed;
  const key = avatar && AVATARS[avatar] ? avatar : "a1";
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden border-2 border-ink",
        square ? "rounded-2xl" : "rounded-full",
        !url && `av-${key}`,
        ring && "animate-turn",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <span className="flex h-full w-full items-center justify-center" style={{ fontSize: size * 0.55 }}>
          {AVATARS[key]}
        </span>
      )}
    </div>
  );
}
