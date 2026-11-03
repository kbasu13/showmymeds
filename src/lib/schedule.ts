export type Med = {
  id: string;
  name: string;
  times: string[];
  start_date: string;
  end_date: string | null;
  stock: number;
  dose_qty: number;
  warn_days?: number | null;
};

export type Log = { medicine_id: string; scheduled_date: string; scheduled_time: string; taken_at: string };

export const LOW_STOCK_DAYS = 7;

export function ymd(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isActiveOn(med: Pick<Med, "start_date" | "end_date">, date: string) {
  return med.start_date <= date && (!med.end_date || med.end_date >= date);
}

export function dosesForDay(meds: Med[], date: string) {
  return meds
    .filter((m) => isActiveOn(m, date))
    .flatMap((m) => [...m.times].sort().map((time) => ({ med: m, time })))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** Units used per day. */
export function dailyUse(med: Pick<Med, "times" | "dose_qty">) {
  return med.times.length * Number(med.dose_qty || 1);
}

export function daysOfStockLeft(med: Pick<Med, "times" | "dose_qty" | "stock">) {
  const use = dailyUse(med);
  if (use <= 0) return Infinity;
  return Math.floor(Number(med.stock) / use);
}

/** Low stock = less than a 7-day buffer remaining, for medicines still in course. */
export function isLowStock(med: Med, today: string) {
  if (med.end_date && med.end_date < today) return false;
  return daysOfStockLeft(med) < (med.warn_days ?? LOW_STOCK_DAYS);
}

/** Adherence % per day: taken scheduled doses / scheduled doses. Null when nothing was scheduled. */
export function adherenceByDay(meds: Med[], logs: Log[], days: string[]) {
  return days.map((date) => {
    const scheduled = dosesForDay(meds, date);
    if (scheduled.length === 0) return { date, pct: null as number | null, taken: 0, total: 0 };
    const taken = scheduled.filter((d) =>
      logs.some((l) => l.medicine_id === d.med.id && l.scheduled_date === date && l.scheduled_time === d.time),
    ).length;
    return { date, pct: Math.round((taken / scheduled.length) * 100), taken, total: scheduled.length };
  });
}

/** Number of dose occurrences the current stock covers (calendar export cap). */
export function dosesCoveredByStock(med: Pick<Med, "stock" | "dose_qty">) {
  const q = Number(med.dose_qty || 1);
  return q > 0 ? Math.floor(Number(med.stock) / q) : 0;
}

function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Build an .ics with one event per dose, limited by stock and course end date. */
export function buildIcs(meds: Med[], from: Date = new Date()) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ShowMyMeds//EN", "CALSCALE:GREGORIAN"];
  const stamp = icsDate(new Date());
  for (const med of meds) {
    let remaining = dosesCoveredByStock(med);
    const day = new Date(from);
    day.setHours(0, 0, 0, 0);
    let guard = 0;
    while (remaining > 0 && guard < 400) {
      const date = ymd(day);
      if (med.end_date && date > med.end_date) break;
      if (isActiveOn(med, date)) {
        for (const t of [...med.times].sort()) {
          if (remaining <= 0) break;
          const [h = 0, mi = 0] = t.split(":").map(Number);
          const start = new Date(day);
          start.setHours(h, mi, 0, 0);
          if (start < from) continue;
          const end = new Date(start.getTime() + 15 * 60000);
          lines.push(
            "BEGIN:VEVENT",
            `UID:${med.id}-${date}-${t}@showmymeds`,
            `DTSTAMP:${stamp}`,
            `DTSTART:${icsDate(start)}`,
            `DTEND:${icsDate(end)}`,
            `SUMMARY:Take ${med.name}`,
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            `DESCRIPTION:Time to take ${med.name}`,
            "TRIGGER:PT0M",
            "END:VALARM",
            "END:VEVENT",
          );
          remaining--;
        }
      }
      day.setDate(day.getDate() + 1);
      guard++;
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
