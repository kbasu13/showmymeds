import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { usePremium, PremiumBadge } from "@/components/Premium";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { useUser, useMeds, useLogs, takeDose, untakeDose, useRefreshMeds } from "@/lib/meds";
import { buildDoctorReport, downloadBlob, shareBlob } from "@/lib/report";
import { adherenceByDay, dosesForDay, ymd, time12, type Med, type Log } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History & insights — ShowMyMeds" }, { name: "description", content: "How well you kept to your medicine schedule." }] }),
  component: HistoryPage,
});

export function AdherenceView({ userId, patientName }: { userId: string; patientName?: string }) {
  const [range, setRange] = useState<number>(7);
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
  const today = ymd(new Date());
  const [reportDays, setReportDays] = useState<number | "custom">(7);
  const [cFrom, setCFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); return ymd(d); });
  const [cTo, setCTo] = useState(today);
  const span = (() => {
    if (reportDays !== "custom") { const d = new Date(); d.setDate(d.getDate() - (reportDays - 1)); return { from: ymd(d), to: today }; }
    return cFrom <= cTo ? { from: cFrom, to: cTo } : { from: cTo, to: cFrom };
  })();
  const spanDays = Math.round((new Date(span.to + "T00:00").getTime() - new Date(span.from + "T00:00").getTime()) / 864e5) + 1;
  const { data: reportLogs } = useLogs(userId, span.from);
  const [report, setReport] = useState<{ blob: Blob; filename: string } | null>(null);
  useEffect(() => {
    if (!premium || !reportLogs) return;
    let live = true;
    setReport(null);
    buildDoctorReport({ patientName: patientName ?? "Patient", meds, logs: reportLogs, days: spanDays, to: span.to }).then((r) => live && setReport(r));
    return () => { live = false; };
  }, [premium, reportLogs, meds, spanDays, span.to, patientName]);
  const share = async () => {
    if (!report) return;
    try { if (!(await shareBlob(report.blob, report.filename))) { downloadBlob(report.blob, report.filename); toast("Sharing isn't supported here, so the report was downloaded instead."); } }
    catch { toast.error("Could not share the report."); }
  };
  const scored = data.filter((d) => d.pct !== null);
  const avg = scored.length ? Math.round(scored.reduce((s, d) => s + (d.pct ?? 0), 0) / scored.length) : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <p className="flex flex-wrap items-center justify-center gap-2 text-center text-lg font-semibold">Report for your doctor (PDF) <PremiumBadge /></p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([7, 15, 30, "custom"] as const).map((d) => (
            <Button key={d} variant={reportDays === d ? "default" : "outline"} onClick={() => setReportDays(d)}>
              {d === "custom" ? "Choose dates" : d === 30 ? "Last 1 month" : `Last ${d} days`}
            </Button>
          ))}
        </div>
        {reportDays === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-medium">From<input type="date" max={today} value={cFrom} onChange={(e) => setCFrom(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-2" /></label>
            <label className="text-sm font-medium">To<input type="date" max={today} value={cTo} onChange={(e) => setCTo(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-2" /></label>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="lg" variant="secondary" disabled={!!premium && !report}
            onClick={() => (!premium ? navigate({ to: "/premium" }) : report && downloadBlob(report.blob, report.filename))}><Download /> Download report</Button>
          <Button size="lg" variant="secondary" disabled={!!premium && !report}
            onClick={() => (!premium ? navigate({ to: "/premium" }) : share())}><Share2 /> Share report</Button>
        </div>
      </div>
      <div className="rounded-xl bg-hero p-5">
        <p className="text-lg">Average doses taken</p>
        <p className="font-display text-4xl font-semibold text-primary">{avg}%</p>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {[7, 15, 30, 45, 60].map((n) => (
          <Button key={n} size="sm" variant={range === n ? "default" : "outline"} onClick={() => setRange(n)}>{n} days</Button>
        ))}
      </div>
      <div className="w-full min-w-0 overflow-hidden rounded-xl border bg-card p-2">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={range <= 7 ? 0 : "preserveStartEnd"} minTickGap={8} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={36} tickFormatter={(v) => `${v}%`} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {range <= 7 && <LabelList dataKey="value" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 12, fontWeight: 600 }} />}
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
      <h2 className="text-xl font-semibold">Doses by day</h2>
      {shown.map((date) => {
        const doses = dosesForDay(meds, date);
        if (doses.length === 0) return null;
        const label = new Date(date + "T00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        return (
          <div key={date} className="rounded-xl border bg-card p-3">
            <p className="mb-2 text-lg font-semibold">{label}</p>
            <ul className="space-y-1">
              {doses.map(({ med, time }) => {
                const log = logs.find((l) => l.medicine_id === med.id && l.scheduled_date === date && l.scheduled_time === time);
                const taken = !!log;
                const key = `${med.id}-${date}-${time}`;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      disabled={readOnly || busy === key}
                      onClick={() => toggle(med.id, date, time, taken)}
                      aria-label={taken ? `Mark ${med.name} at ${time12(time)} as not taken` : `Mark ${med.name} at ${time12(time)} as taken`}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-secondary disabled:opacity-70"
                    >
                      <span className="w-20 shrink-0 font-semibold">{time12(time)}</span>
                      <span className={`min-w-0 flex-1 break-words font-medium ${taken ? "text-success" : "text-destructive"}`}>{med.name}</span>
                      <span className={`shrink-0 text-sm ${taken ? "text-success" : "text-destructive"}`}>{taken ? "Taken" : "Not taken"}</span>
                      {taken
                        ? <CheckCircle2 className="h-8 w-8 shrink-0 text-success" />
                        : <Circle className="h-8 w-8 shrink-0 text-destructive" />}
                    </button>
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
