import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { useUser, useMeds, useLogs } from "@/lib/meds";
import { adherenceByDay, ymd, type Med, type Log } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History & insights — ShowMyMeds" }, { name: "description", content: "How well you kept to your medicine schedule." }] }),
  component: HistoryPage,
});

export function AdherenceView({ userId }: { userId: string }) {
  const [range, setRange] = useState<7 | 30>(7);
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
      <div className="rounded-2xl bg-hero p-5">
        <p className="text-lg">Average doses taken</p>
        <p className="font-display text-5xl font-bold text-primary">{avg}%</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card p-3">
        <div style={{ width: Math.max(range * 56, 320), height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 13 }} interval={0} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 13 }} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                <LabelList dataKey="value" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 12, fontWeight: 700 }} />
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
      <h1 className="text-4xl font-bold text-primary">History</h1>
      {user && <AdherenceView userId={user.id} />}
    </div>
  );
}
