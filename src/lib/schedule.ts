export type Med = {
  id: string;
  name: string;
  times: string[];
  start_date: string;
  end_date: string | null;
  stock: number;
  dose_qty: number;
  form?: string;
  warn_days?: number | null;
  /** 1 = daily, 2 = every 2nd day… counted from start_date. Ignored when week_days is set. */
  repeat_every?: number | null;
  /** 0 = Sunday … 6 = Saturday. Null/empty = not weekday-based. */
  week_days?: number[] | null;
  /** active | paused | discontinued */
  status?: string | null;
  paused_from?: string | null;
  /** Finished pause/stop periods, inclusive dates. These days are never due. */
  breaks?: unknown;
};

export type Log = { medicine_id: string; scheduled_date: string; scheduled_time: string; taken_at: string };

export const LOW_STOCK_DAYS = 7;
export const CRITICAL_STOCK_DAYS = 2;

export function ymd(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isActiveOn(med: Pick<Med, "start_date" | "end_date">, date: string) {
  return med.start_date <= date && (!med.end_date || med.end_date >= date);
}

type Freq = Pick<Med, "start_date" | "end_date" | "repeat_every" | "week_days"> & { status?: string | null; paused_from?: string | null; breaks?: unknown };

export type Break = { from: string; to: string };

export function breaksOf(med: { breaks?: unknown }): Break[] {
  return Array.isArray(med.breaks) ? (med.breaks as Break[]).filter((b) => b && typeof b.from === "string" && typeof b.to === "string") : [];
}

function addDays(date: string, n: number) {
  const d = new Date(date + "T00:00");
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Patch for changing a medicine's state on `today`, keeping finished breaks so they never count as missed. */
export function lifecyclePatch(
  med: { status?: string | null; paused_from?: string | null; end_date: string | null; breaks?: unknown },
  status: "active" | "paused" | "discontinued",
  today: string,
) {
  const breaks = breaksOf(med);
  if (status === "paused") return { status, paused_from: today };
  if (status === "discontinued") {
    // A paused medicine stopped: its last due day was the day before the pause.
    const last = med.status === "paused" && med.paused_from ? addDays(med.paused_from, -1) : today;
    return { status, paused_from: null, end_date: med.end_date && med.end_date < last ? med.end_date : last };
  }
  const yesterday = addDays(today, -1);
  let from: string | null = null;
  if (med.status === "paused" && med.paused_from) from = med.paused_from;
  if (med.status === "discontinued" && med.end_date) from = addDays(med.end_date, 1);
  const next = from && from <= yesterday ? [...breaks, { from, to: yesterday }] : breaks;
  return { status, paused_from: null, breaks: next, ...(med.status === "discontinued" ? { end_date: null } : {}) };
}

/** Only active medicines get reminders, stock alerts and calendar entries. */
export function isRunning(med: { status?: string | null }) {
  return !med.status || med.status === "active";
}

/** Is this medicine scheduled on this date (course range + repeat rule)? */
export function isDueOn(med: Freq, date: string) {
  if (!isActiveOn(med, date)) return false;
  if (med.status === "paused" && (!med.paused_from || date >= med.paused_from)) return false;
  if (breaksOf(med).some((b) => date >= b.from && date <= b.to)) return false;
  const d = new Date(date + "T00:00");
  if (med.week_days?.length) return med.week_days.includes(d.getDay());
  const every = Math.max(1, Number(med.repeat_every) || 1);
  if (every === 1) return true;
  const diff = Math.round((d.getTime() - new Date(med.start_date + "T00:00").getTime()) / 864e5);
  return diff % every === 0;
}

/** Fraction of days the medicine is taken (1 daily, 0.5 alternate days, 1/7 weekly). */
export function dayFraction(med: Pick<Med, "repeat_every" | "week_days">) {
  if (med.week_days?.length) return med.week_days.length / 7;
  return 1 / Math.max(1, Number(med.repeat_every) || 1);
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Every day", "Every 2nd day", "Every Mon and Thu" */
export function frequencyText(med: Pick<Med, "repeat_every" | "week_days">) {
  if (med.week_days?.length) {
    const t = [...med.week_days].sort().map((i) => WD[i]!);
    return t.length === 7 ? "Every day" : `Every ${t.length <= 1 ? t[0] : `${t.slice(0, -1).join(", ")} and ${t[t.length - 1]}`}`;
  }
  const n = Math.max(1, Number(med.repeat_every) || 1);
  if (n === 1) return "Every day";
  const suf = n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : n % 10 === 1 && n !== 11 ? "st" : "th";
  return `Every ${n}${suf} day`;
}

export function dosesForDay(meds: Med[], date: string) {
  return meds
    .filter((m) => isDueOn(m, date))
    .flatMap((m) => [...m.times].sort().map((time) => ({ med: m, time })))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** Units used per day. */
export function dailyUse(med: Pick<Med, "times" | "dose_qty" | "repeat_every" | "week_days">) {
  return med.times.length * Number(med.dose_qty || 1) * dayFraction(med);
}

export function daysOfStockLeft(med: Pick<Med, "times" | "dose_qty" | "stock" | "repeat_every" | "week_days">) {
  const use = dailyUse(med);
  if (use <= 0) return Infinity;
  return Math.floor(Number(med.stock) / use);
}

/** Low stock = less than a 7-day buffer remaining, for medicines still in course. */
export function isLowStock(med: Med, today: string) {
  if (!isRunning(med)) return false;
  if (med.end_date && med.end_date < today) return false;
  return daysOfStockLeft(med) < (med.warn_days ?? LOW_STOCK_DAYS);
}

export type StockLevel = "empty" | "critical" | "low";

/**
 * Stock urgency for a medicine still in course:
 * "empty" = nothing left, "critical" = under 2 days left, "low" = under the warn buffer, null = fine.
 */
export function stockLevel(med: Med, today: string): StockLevel | null {
  if (!isRunning(med)) return null;
  if (med.end_date && med.end_date < today) return null;
  if (Number(med.stock) <= 0) return "empty";
  const days = daysOfStockLeft(med);
  if (days < CRITICAL_STOCK_DAYS) return "critical";
  if (days < (med.warn_days ?? LOW_STOCK_DAYS)) return "low";
  return null;
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

/** Available stock can never be below zero: negatives, blanks and junk all become 0. */
export function clampStock(v: string | number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
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
    if (!isRunning(med)) continue;
    let remaining = dosesCoveredByStock(med);
    const day = new Date(from);
    day.setHours(0, 0, 0, 0);
    let guard = 0;
    while (remaining > 0 && guard < 400) {
      const date = ymd(day);
      if (med.end_date && date > med.end_date) break;
      if (isDueOn(med, date)) {
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

/** "14:30" -> "2:30 PM" */
export function time12(t: string) {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const UNIT: Record<string, [string, string]> = {
  tablet: ["tablet", "tablets"], capsule: ["capsule", "capsules"], syrup: ["ml", "ml"], drops: ["drop", "drops"],
  injection: ["injection", "injections"], inhaler: ["puff", "puffs"], cream: ["application", "applications"],
};
/** 1 + "tablet" -> "1 tablet", 2 -> "2 tablets", 0.5 -> "½ tablet" */
export function doseText(qty: number, form: string) {
  const n0 = Number(qty);
  const q = Number.isFinite(n0) ? n0 : 1;
  const [one, many] = UNIT[form] ?? ["unit", "units"];
  const n = q === 0.5 ? "½" : q === 0.25 ? "¼" : String(q);
  return `${n} ${q === 1 || q === 0.5 || q === 0.25 ? one : many}`;
}

/** "2026-11-01" -> "01-11-2026, Sun" */
export function dmyDay(date: string) {
  const [y, m, d] = date.split("-");
  const wd = new Date(date + "T00:00").toLocaleDateString("en-US", { weekday: "short" });
  return `${d}-${m}-${y}, ${wd}`;
}

/** "Sun Pharma" stays, "CIPLA LTD" -> "Cipla Ltd" */
export function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** ["08:00","14:00","22:00"] -> "8:00 AM, 2:00 PM and 10:00 PM" */
export function joinTimes(times: string[]) {
  const t = [...times].sort().map(time12);
  return t.length <= 1 ? (t[0] ?? "") : `${t.slice(0, -1).join(", ")} and ${t[t.length - 1]}`;
}

/** "2026-11-03" -> "Tue, Nov 3" */
export function shortDay(date: string) {
  return new Date(date + "T00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
