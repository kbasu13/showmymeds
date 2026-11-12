import { AlertTriangle, OctagonX, TriangleAlert } from "lucide-react";
import { daysOfStockLeft, stockLevel, type Med, type StockLevel } from "@/lib/schedule";

const LEVELS: {
  level: StockLevel;
  title: (days: number) => string;
  box: string;
  icon: typeof AlertTriangle;
}[] = [
  {
    level: "empty",
    title: () => "No stock left - please refill immediately.",
    box: "border-destructive bg-destructive text-destructive-foreground",
    icon: OctagonX,
  },
  {
    level: "critical",
    title: (days) => `Critically low stock - please refill urgently in ${days} ${days === 1 ? "day" : "days"}`,
    box: "border-critical bg-critical/60 text-critical-foreground",
    icon: TriangleAlert,
  },
  {
    level: "low",
    title: () => "Running low — please refill soon",
    box: "border-warning bg-warning/30 text-warning-foreground",
    icon: AlertTriangle,
  },
];

/** Grouped refill warnings: dark red when empty, pinkish when under 2 days, yellow when under the warn buffer. */
export function LowStockAlert({ meds, today }: { meds: Med[]; today: string }) {
  const groups = LEVELS.map((cfg) => ({
    ...cfg,
    meds: meds.filter((m) => stockLevel(m, today) === cfg.level),
  })).filter((g) => g.meds.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-3">
      {groups.map(({ level, title, box, icon: Icon, meds: list }) => {
        // Days left is per-medicine; with several critical meds show the soonest run-out.
        const days = Math.min(...list.map((m) => daysOfStockLeft(m)));
        return (
          <div key={level} role="alert" className={`flex gap-3 rounded-xl border-2 p-4 ${box}`}>
            <Icon className="mt-1 h-8 w-8 shrink-0" />
            <div>
              <p className="text-xl font-bold">{title(days)}</p>
              <ul className="mt-1 text-lg">
                {list.map((m) => (
                  <li key={m.id}>
                    <b>{m.name}</b>: about {daysOfStockLeft(m)} day(s) left ({Number(m.stock)} left)
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
