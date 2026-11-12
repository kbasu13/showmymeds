import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, Plus, BellRing, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MedImage } from "@/components/MedImage";
import { LowStockAlert } from "@/components/LowStockAlert";
import { usePremium } from "@/components/Premium";
import { useUser, useMeds, useLogs, takeDose, useRefreshMeds } from "@/lib/meds";
import { dosesForDay, ymd, time12, doseText, type Med } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/today")({ staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Today's doses — ShowMyMeds" }, { name: "description", content: "Your medicines for today." }, { property: "og:title", content: "Today's doses — ShowMyMeds" }, { property: "og:description", content: "Your medicines for today." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: TodayPage,
});

function TodayPage() {
  const { data: user } = useUser();
  const { data: premium } = usePremium(user?.id);
  const today = ymd(new Date());
  const { data: meds = [], isLoading } = useMeds(user?.id);
  const { data: logs = [] } = useLogs(user?.id, today);
  const refresh = useRefreshMeds();

  const doses = dosesForDay(meds as unknown as Med[], today);
  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const take = async (id: string, time: string, name: string) => {
    try {
      await takeDose(id, today, time);
      toast.success(`${name} marked as taken at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message.includes("duplicate") ? "Already taken" : (e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-lg text-muted-foreground">{dateLabel}</p>
        <h1 className="text-2xl font-semibold text-primary">Today</h1>
      </div>
      <Button asChild variant="outline" size="lg" className="w-full text-base"><Link to="/notifications"><BellRing /> Allow notifications {!premium && <Gem className="h-4 w-4 text-premium" aria-label="Premium" />}</Link></Button>

      <LowStockAlert meds={meds as unknown as Med[]} today={today} />

      {isLoading ? (
        <p className="text-lg">Loading…</p>
      ) : doses.length === 0 ? (
        <div className="rounded-xl bg-hero p-8 text-center">
          <p className="text-xl">No medicines scheduled today.</p>
          <Button asChild size="lg" className="mt-4"><Link to="/medicines"><Plus /> Add a medicine</Link></Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {doses.map(({ med, time }) => {
            const m = meds.find((x) => x.id === med.id)!;
            const log = logs.find((l) => l.medicine_id === med.id && l.scheduled_time === time);
            return (
              <li key={`${med.id}-${time}`} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-soft sm:flex-nowrap sm:gap-4 sm:p-4">
                <MedImage src={m.image_url} form={m.form} name={m.name} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-lg font-semibold leading-tight text-primary">{m.name}</p>
                  <p className="font-medium">at {time12(time)}</p>
                  <p className="text-muted-foreground">{doseText(Number(m.dose_qty), m.form)}</p>
                </div>
                {log ? (
                  <div className="ml-auto flex shrink-0 flex-col items-center text-success">
                    <CheckCircle2 className="h-10 w-10" />
                    <span className="text-sm font-bold">
                      {new Date(log.taken_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}
                    </span>
                  </div>
                ) : (
                  <Button variant="take" size="lg" className="ml-auto shrink-0" onClick={() => take(m.id, time, m.name)}>Take Now</Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
