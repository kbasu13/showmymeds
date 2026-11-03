import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MedImage } from "@/components/MedImage";
import { useUser, useMeds, useLogs, takeDose, useRefreshMeds } from "@/lib/meds";
import { dosesForDay, isLowStock, daysOfStockLeft, ymd, time12, doseText, type Med } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({ meta: [{ title: "Today's doses — ShowMyMeds" }, { name: "description", content: "Your medicines for today." }] }),
  component: TodayPage,
});

function TodayPage() {
  const { data: user } = useUser();
  const today = ymd(new Date());
  const { data: meds = [], isLoading } = useMeds(user?.id);
  const { data: logs = [] } = useLogs(user?.id, today);
  const refresh = useRefreshMeds();

  const doses = dosesForDay(meds as unknown as Med[], today);
  const low = meds.filter((m) => isLowStock(m as unknown as Med, today));
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

      {low.length > 0 && (
        <div role="alert" className="flex gap-3 rounded-xl border-2 border-warning bg-warning/30 p-4 text-warning-foreground">
          <AlertTriangle className="mt-1 h-8 w-8 shrink-0" />
          <div>
            <p className="text-xl font-bold">Running low — please refill soon</p>
            <ul className="mt-1 text-lg">
              {low.map((m) => (
                <li key={m.id}><b>{m.name}</b>: about {daysOfStockLeft(m as unknown as Med)} day(s) left ({Number(m.stock)} left)</li>
              ))}
            </ul>
          </div>
        </div>
      )}

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
