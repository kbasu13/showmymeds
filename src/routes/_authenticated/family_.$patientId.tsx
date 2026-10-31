import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, ArrowLeft, AlertTriangle } from "lucide-react";
import { useMeds, useLogs } from "@/lib/meds";
import { dosesForDay, isLowStock, ymd, type Med } from "@/lib/schedule";
import { MedImage } from "@/components/MedImage";
import { AdherenceView } from "./history";

export const Route = createFileRoute("/_authenticated/family_/$patientId")({
  head: () => ({ meta: [{ title: "Family member — ShowMyMeds" }, { name: "description", content: "Medicines of someone you care for." }] }),
  component: PatientView,
});

function PatientView() {
  const { patientId } = Route.useParams();
  const today = ymd(new Date());
  const { data: meds = [] } = useMeds(patientId);
  const { data: logs = [] } = useLogs(patientId, today);
  const doses = dosesForDay(meds as unknown as Med[], today);
  const low = meds.filter((m) => isLowStock(m as unknown as Med, today));

  return (
    <div className="space-y-5">
      <Link to="/family" className="inline-flex items-center gap-2 text-lg font-bold text-primary"><ArrowLeft /> Family</Link>
      <h1 className="text-3xl font-bold text-primary">Today's doses</h1>
      {low.length > 0 && (
        <div className="flex gap-2 rounded-2xl border-2 border-warning bg-warning/30 p-3 text-warning-foreground">
          <AlertTriangle /> Low stock: {low.map((m) => m.name).join(", ")}
        </div>
      )}
      <ul className="space-y-2">
        {doses.map(({ med, time }) => {
          const m = meds.find((x) => x.id === med.id)!;
          const log = logs.find((l) => l.medicine_id === med.id && l.scheduled_time === time);
          return (
            <li key={`${med.id}-${time}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <MedImage src={m.image_url} form={m.form} name={m.name} className="h-14 w-14" />
              <div className="flex-1"><b className="text-xl">{time}</b> · {m.name}</div>
              {log ? <CheckCircle2 className="h-8 w-8 text-success" aria-label="Taken" /> : <Circle className="h-8 w-8 text-muted-foreground" aria-label="Not taken" />}
            </li>
          );
        })}
        {doses.length === 0 && <p className="text-muted-foreground">Nothing scheduled today.</p>}
      </ul>
      <h2 className="text-2xl font-bold">Adherence</h2>
      <AdherenceView userId={patientId} />
    </div>
  );
}
