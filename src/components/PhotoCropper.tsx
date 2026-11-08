import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { loadImage } from "@/lib/photos";

const FRAME = 260;
const OUT = 400;

/** Square crop with drag-to-move and zoom, exported as a JPEG blob. */
export function PhotoCropper({ file, onDone, onCancel }: { file: File; onDone: (b: Blob) => void; onCancel: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setSrc(u);
    loadImage(u).then(setImg).catch(() => {});
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const scale = img ? Math.max(FRAME / img.width, FRAME / img.height) * zoom : 1;
  const w = img ? img.width * scale : 0;
  const h = img ? img.height * scale : 0;
  const clamp = (o: { x: number; y: number }) => ({
    x: Math.max(Math.min(o.x, (w - FRAME) / 2), -(w - FRAME) / 2),
    y: Math.max(Math.min(o.y, (h - FRAME) / 2), -(h - FRAME) / 2),
  });
  const pos = clamp(off);
  const left = FRAME / 2 - w / 2 + pos.x;
  const top = FRAME / 2 - h / 2 + pos.y;

  const exportCrop = () => {
    if (!img) return;
    const c = document.createElement("canvas");
    c.width = c.height = OUT;
    const k = OUT / FRAME;
    c.getContext("2d")!.drawImage(img, left * k, top * k, w * k, h * k);
    c.toBlob((b) => b && onDone(b), "image/jpeg", 0.88);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative touch-none overflow-hidden rounded-full border-4 border-ink bg-muted"
        style={{ width: FRAME, height: FRAME, cursor: "grab" }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setOff({ x: drag.current.ox + e.clientX - drag.current.x, y: drag.current.oy + e.clientY - drag.current.y });
        }}
        onPointerUp={() => (drag.current = null)}
      >
        {src && img && (
          <img src={src} alt="Recorte" draggable={false} className="absolute max-w-none select-none" style={{ left, top, width: w, height: h }} />
        )}
      </div>
      <div className="w-full max-w-[260px]">
        <p className="mb-2 text-center text-xs text-muted-foreground">Arraste para ajustar · deslize para dar zoom</p>
        <Slider min={1} max={3} step={0.01} value={[zoom]} onValueChange={([z]) => setZoom(z ?? 1)} aria-label="Zoom" />
      </div>
      <div className="flex gap-2">
        <Button variant="popPlain" onClick={onCancel}>Cancelar</Button>
        <Button variant="pop" onClick={exportCrop} disabled={!img}>Usar foto</Button>
      </div>
    </div>
  );
}
