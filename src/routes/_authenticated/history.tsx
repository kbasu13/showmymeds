import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { usePremium, PremiumBadge } from "@/components/Premium";
import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { useUser, useMeds, useLogs, takeDose, untakeDose, useRefreshMeds } from "@/lib/meds";
import { downloadDoctorReport } from "@/lib/report";
import { adherenceByDay, dosesForDay, ymd, type Med, type Log } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History & insights — ShowMyMeds" }, { name: "description", content: "How well you kept to your medicine schedule." }] }),
  component: HistoryPage,
});

export function AdherenceView({ userId, patientName }: { userId: string; patientName?: string }) {
  const [range, setRange] = useState<7 | 30>(7);
  const { data: me } = useUser();
  const { data: premium } = usePremium(me?.id);
  const navigate = useNavigate();
  const days = Array.from({ length: range }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (range - 1 - i)); return ymd(d);
  });
  const { data: meds = [] } = useMeds(userId);
  const { data: logs = [] } = useLogs(userId, days[0]!);
  const data = adherenceByDay(meds as unknown as Med[], logs as unknown as Log[], days).map((d) => ({
    ...d, label: new Date(d.date + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }), value: d.pct ?? 0,
  }));
  const scored = data.filter((d) => d.pct !== null);
  const avg = scored.length ? Math.round(scored.reduce((s, d) => s + (d.pct ?? 0), 0) / scored.length) : 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={range === 7 ? "default" : "outline"} onClick={() => setRange(7)}>Last 7 days</Button>
        <Button variant={range === 30 ? "default" : "outline"} onClick={() => setRange(30)}>Last month</Button>
      </div>
      <Button size="lg" variant="secondary" className="w-full" onClick={() => !premium ? navigate({ to: "/premium" }) :
        downloadDoctorReport({ patientName: patientName ?? "Patient", meds, logs, days: range })
      }>Download PDF report for doctor <PremiumBadge /></Button>
      <div className="rounded-xl bg-hero p-5">
        <p className="text-lg">Average doses taken</p>
        <p className="font-display text-4xl font-semibold text-primary">{avg}%</p>
      </div>
      <div className="w-full min-w-0 overflow-hidden rounded-xl border bg-card p-2">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={range === 7 ? 0 : "preserveStartEnd"} minTickGap={8} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={36} tickFormatter={(v) => `${v}%`} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {range === 7 && <LabelList dataKey="value" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 12, fontWeight: 600 }} />}
                {data.map((d) => (
                  <Cell key={d.date} fill={d.value >= 80 ? "var(--chart-1)" : d.value >= 50 ? "var(--chart-3)" : "var(--chart-4)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <DoseChecklist meds={meds} logs={logs} days={days} readOnly={userId !== me?.id} />
    </div>
  );
}

/** Per-day list of scheduled doses for the selected range, with taken/not-taken toggles. */
function DoseChecklist({ meds, logs, days, readOnly }: { meds: Med[]; logs: Log[]; days: string[]; readOnly: boolean }) {
  const refresh = useRefreshMeds();
  const [busy, setBusy] = useState<string | null>(null);
  const shown = [...days].reverse();

  const toggle = async (medId: string, date: string, time: string, taken: boolean) => {
    if (readOnly || busy) return;
    const key = `${medId}-${date}-${time}`;
    setBusy(key);
    try {
      if (taken) await untakeDose(medId, date, time);
      else await takeDose(medId, date, time);
      refresh();
    } catch {
      toast.error("Could not update the dose. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Doses by day</h2>
      {shown.map((date) => {
        const doses = dosesForDay(meds, date);
        if (doses.length === 0) return null;
        const label = new Date(date + "T00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
        return (
          <div key={date} className="rounded-xl border bg-card p-3">
            <p className="mb-2 font-semibold">{label}</p>
            <ul className="space-y-1.5">
              {doses.map(({ med, time }) => {
                const log = logs.find((l) => l.medicine_id === med.id && l.scheduled_date === date && l.scheduled_time === time);
                const taken = !!log;
                const key = `${med.id}-${date}-${time}`;
                return (
                  <li key={key} className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={readOnly || busy === key}
                      onClick={() => toggle(med.id, date, time, taken)}
                      aria-label={taken ? `Mark ${med.name} at ${time} as not taken` : `Mark ${med.name} at ${time} as taken`}
                      className="shrink-0 disabled:opacity-60"
                    >
                      {taken
                        ? <CheckCircle2 className="h-6 w-6 text-success" />
                        : <Circle className="h-6 w-6 text-muted-foreground" />}
                    </button>
                    <span className={taken ? "" : "text-muted-foreground"}>
                      <b>{time}</b> · {med.name}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function HistoryPage() {
  const { data: user } = useUser();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-primary">History</h1>
      {user && <AdherenceView userId={user.id} patientName={user.user_metadata?.['full_name'] || user.email || user.phone} />}
    </div>
  );
}
