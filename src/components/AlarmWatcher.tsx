import { useEffect, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLogs, useMeds, useRefreshMeds, takeDose, type Medicine } from "@/lib/meds";
import { dosesForDay, ymd } from "@/lib/schedule";
import { MedImage } from "./MedImage";

type Due = { med: Medicine; time: string; date: string };

/** Watches the clock and rings a loud alarm with a full-screen popup at each dose time. */
export function AlarmWatcher({ userId }: { userId: string }) {
  const today = ymd(new Date());
  const { data: meds = [] } = useMeds(userId);
  const { data: logs = [] } = useLogs(userId, today);
  const refresh = useRefreshMeds();
  const [due, setDue] = useState<Due[]>([]);
  const rung = useRef(new Set<string>());
  const audio = useRef<{ ctx: AudioContext; timer: number } | null>(null);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const date = ymd(now);
      const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const fresh = dosesForDay(meds as never, date)
        .filter((d) => d.time === hm)
        .filter((d) => !logs.some((l) => l.medicine_id === d.med.id && l.scheduled_date === date && l.scheduled_time === d.time))
        .filter((d) => !rung.current.has(`${d.med.id}-${date}-${d.time}`));
      if (fresh.length) {
        fresh.forEach((d) => rung.current.add(`${d.med.id}-${date}-${d.time}`));
        setDue((p) => [...p, ...fresh.map((d) => ({ med: d.med as unknown as Medicine, time: d.time, date }))]);
      }
    };
    check();
    const id = window.setInterval(check, 15000);
    return () => window.clearInterval(id);
  }, [meds, logs]);

  useEffect(() => {
    if (due.length && !audio.current) {
      try {
        const ctx = new AudioContext();
        const beep = () => {
          [0, 0.3, 0.6].forEach((t) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "square";
            o.frequency.value = 880;
            g.gain.value = 0.6;
            o.connect(g).connect(ctx.destination);
            o.start(ctx.currentTime + t);
            o.stop(ctx.currentTime + t + 0.2);
          });
        };
        beep();
        audio.current = { ctx, timer: window.setInterval(beep, 1500) };
        navigator.vibrate?.([500, 200, 500]);
      } catch {
        /* audio blocked until the user taps the page once */
      }
    }
    if (!due.length && audio.current) {
      window.clearInterval(audio.current.timer);
      audio.current.ctx.close();
      audio.current = null;
    }
  }, [due.length]);

  if (!due.length) return null;
  const cur = due[0];
  const dismiss = () => setDue((p) => p.slice(1));

  return (
    <div role="alertdialog" aria-modal="true" aria-label="Medicine alarm"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-primary p-6 text-center text-primary-foreground">
      <BellRing className="alarm-pulse h-24 w-24" />
      <p className="text-2xl font-bold">It's {cur.time} — time for your medicine</p>
      <MedImage src={cur.med.image_url} form={cur.med.form} name={cur.med.name} className="h-32 w-32" />
      <h2 className="text-4xl font-bold">{cur.med.name}</h2>
      {cur.med.dosage && <p className="text-xl">{cur.med.dosage}</p>}
      <div className="flex w-full max-w-sm flex-col gap-3">
        <Button size="lg" variant="take" onClick={async () => {
          try { await takeDose(cur.med.id, cur.date, cur.time); toast.success(`${cur.med.name} taken`); refresh(); }
          catch (e) { toast.error((e as Error).message); }
          dismiss();
        }}>I've taken it</Button>
        <Button size="lg" variant="secondary" onClick={dismiss}>Remind me later</Button>
      </div>
    </div>
  );
}
