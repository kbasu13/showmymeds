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
            <BarChart data={data} margin={{ top: 20, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={range === 7 ? 0 : "preserveStartEnd"} minTickGap={8} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={40} />
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
