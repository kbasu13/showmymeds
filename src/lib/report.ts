import { adherenceByDay, ymd, type Log, type Med } from "@/lib/schedule";
import type { Medicine, DoseLog } from "@/lib/meds";

/** Builds and downloads a doctor-friendly PDF: medicine list + daily doses taken. */
export async function downloadDoctorReport(opts: { patientName: string; meds: Medicine[]; logs: DoseLog[]; days: number }) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const dates = Array.from({ length: opts.days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (opts.days - 1 - i)); return ymd(d);
  });
  const rows = adherenceByDay(opts.meds as unknown as Med[], opts.logs as unknown as Log[], dates);
  const scored = rows.filter((r) => r.pct !== null);
  const avg = scored.length ? Math.round(scored.reduce((s, r) => s + (r.pct ?? 0), 0) / scored.length) : 0;

  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text("ShowMyMeds — Medicine report", 14, 18);
  doc.setFontSize(11);
  doc.text(`Patient: ${opts.patientName}`, 14, 27);
  doc.text(`Period: ${dates[0]} to ${dates[dates.length - 1]} (${opts.days} days)`, 14, 33);
  doc.text(`Average doses taken: ${avg}%`, 14, 39);

  autoTable(doc, {
    startY: 46,
    head: [["Medicine", "Dose", "Form", "Times", "Started", "Ends"]],
    body: opts.meds.map((m) => [m.name, m.dosage ?? "", m.form, [...m.times].sort().join(", "), m.start_date, m.end_date ?? "Ongoing"]),
    headStyles: { fillColor: [40, 90, 70] },
  });

  autoTable(doc, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [["Date", "Doses taken", "Doses due", "% taken"]],
    body: rows.map((r) => [r.date, String(r.taken), String(r.total), r.pct === null ? "—" : `${r.pct}%`]),
    headStyles: { fillColor: [40, 90, 70] },
  });

  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString()} · For discussion with your doctor.`, 14, doc.internal.pageSize.getHeight() - 8);
  doc.save(`ShowMyMeds-report-${dates[dates.length - 1]}.pdf`);
}
