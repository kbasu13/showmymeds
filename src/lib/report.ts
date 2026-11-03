import { dosesForDay, doseText, time12, ymd, type Log, type Med } from "@/lib/schedule";
import type { Medicine, DoseLog } from "@/lib/meds";

type Opts = { patientName: string; meds: Medicine[]; logs: DoseLog[]; days: number };

/** Doctor-friendly PDF: medicine list, then each day (newest first) with doses taken vs due. */
export async function buildDoctorReport(opts: Opts) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const dates = Array.from({ length: opts.days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i); return ymd(d);
  });
  const meds = opts.meds as unknown as Med[];
  const logs = opts.logs as unknown as Log[];
  const label = (n: string, t: string) => `${n} (${time12(t)})`;
  const rows = dates.map((date) => {
    const due = dosesForDay(meds, date);
    const taken = due.filter((d) => logs.some((l) => l.medicine_id === d.med.id && l.scheduled_date === date && l.scheduled_time === d.time));
    const day = new Date(date + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
    return { day, taken, due };
  });
  const totalDue = rows.reduce((s, r) => s + r.due.length, 0);
  const totalTaken = rows.reduce((s, r) => s + r.taken.length, 0);

  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("ShowMyMeds - Medicine report", 14, 18);
  doc.setFontSize(11);
  doc.text(`Patient: ${opts.patientName}`, 14, 27);
  doc.text(`Period: ${dates[dates.length - 1]} to ${dates[0]} (${opts.days} days)`, 14, 33);
  doc.text(`Doses taken: ${totalTaken} of ${totalDue}${totalDue ? ` (${Math.round((totalTaken / totalDue) * 100)}%)` : ""}`, 14, 39);

  autoTable(doc, {
    startY: 46,
    head: [["Medicine", "Composition", "Dose", "Form", "Timings", "Started", "Ends"]],
    body: opts.meds.map((m) => [m.name, m.composition ?? "", doseText(Number(m.dose_qty), m.form), m.form, [...m.times].sort().map(time12).join(", "), m.start_date, m.end_date ?? "Ongoing"]),
    headStyles: { fillColor: [40, 90, 70] },
    styles: { fontSize: 9 },
  });

  autoTable(doc, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [["Date", "Medicines taken", "Medicine doses due"]],
    body: rows.map((r) => [r.day, r.taken.map((d) => label(d.med.name, d.time)).join("\n") || "-", r.due.map((d) => label(d.med.name, d.time)).join("\n") || "-"]),
    headStyles: { fillColor: [40, 90, 70] },
    styles: { fontSize: 9 },
  });

  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString()} - For discussion with your doctor.`, 14, doc.internal.pageSize.getHeight() - 8);
  return { blob: doc.output("blob"), filename: `ShowMyMeds-report-${opts.days}days-${dates[0]}.pdf` };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Opens the phone's share sheet with the PDF; returns false if sharing files isn't supported. */
export async function shareBlob(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "application/pdf" });
  if (!navigator.canShare?.({ files: [file] })) return false;
  try { await navigator.share({ files: [file], title: "Medicine report" }); } catch (e) { if ((e as DOMException).name !== "AbortError") throw e; }
  return true;
}
