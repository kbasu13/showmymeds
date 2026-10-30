import { useEffect, useState } from "react";
import { Pill, Tablets, FlaskConical, Droplet, Syringe, Wind, Hand } from "lucide-react";
import { signedUrl } from "@/lib/meds";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Pill> = {
  tablet: Tablets, capsule: Pill, syrup: FlaskConical, drops: Droplet,
  injection: Syringe, inhaler: Wind, cream: Hand,
};

export function MedImage({ src, form, name, className }: { src: string | null; form: string; name: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!src) return setUrl(null);
    if (src.startsWith("http")) return setUrl(src);
    signedUrl(src).then(setUrl);
  }, [src]);

  const Icon = ICONS[form] ?? Pill;
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-secondary text-primary", className ?? "h-20 w-20")}>
      {url && !failed ? (
        <img src={url} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <Icon className="h-1/2 w-1/2" aria-label={name} />
      )}
    </div>
  );
}
