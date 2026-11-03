import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Pill, Tablets, FlaskConical, Droplet, Syringe, Wind, Hand, X, ZoomIn } from "lucide-react";
import { signedUrl } from "@/lib/meds";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Pill> = {
  tablet: Tablets, capsule: Pill, syrup: FlaskConical, drops: Droplet,
  injection: Syringe, inhaler: Wind, cream: Hand,
};

export function MedImage({ src, form, name, className, zoomable = true }: {
  src: string | null; form: string; name: string; className?: string; zoomable?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!src) return setUrl(null);
    if (src.startsWith("http")) return setUrl(src);
    signedUrl(src).then(setUrl);
  }, [src]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); setOpen(false); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  const Icon = ICONS[form] ?? Pill;
  const hasPhoto = !!url && !failed;
  const canZoom = hasPhoto && zoomable;

  const tile = (
    <div className={cn(
      "flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary text-primary",
      className ?? "h-20 w-20",
    )}>
      {hasPhoto ? (
        <img src={url} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <Icon className="h-1/2 w-1/2" aria-label={name} />
      )}
    </div>
  );

  return (
    <>
      {canZoom ? (
        <button
          type="button"
          className="group relative shrink-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setOpen(true)}
          aria-label={`Enlarge photo of ${name}`}
        >
          {tile}
          <span className="pointer-events-none absolute bottom-1 right-1 grid size-5 place-items-center rounded-md bg-background/80 text-foreground opacity-0 transition-opacity group-hover:opacity-100">
            <ZoomIn className="size-3" aria-hidden />
          </span>
        </button>
      ) : tile}

      {open && hasPhoto && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={name}
          className="pointer-events-auto fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/95 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <img
            src={url}
            alt={name}
            className="max-h-[75vh] max-w-full rounded-2xl border bg-card object-contain shadow-soft"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="max-w-md text-center text-base font-semibold text-primary">{name}</p>
          <button
            type="button"
            className="rounded-full border bg-card p-2 text-primary hover:bg-secondary"
            aria-label="Close photo"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
