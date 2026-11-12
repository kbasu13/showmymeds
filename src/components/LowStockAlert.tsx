import { AlertTriangle, OctagonX, TriangleAlert } from "lucide-react";
import { daysOfStockLeft, doseText, stockLevel, type Med, type StockLevel } from "@/lib/schedule";

const LEVELS: {
  level: StockLevel;
  title: string;
  box: string;
  icon: typeof AlertTriangle;
}[] = [
  {
    level: "empty",
    title: "No stock left - please refill immediately",
    box: "border-destructive bg-destructive text-destructive-foreground",
    icon: OctagonX,
  },
  {
    level: "critical",
    title: "Critically low stock - please refill urgently",
    box: "border-critical bg-critical/60 text-critical-foreground",
    icon: TriangleAlert,
  },
  {
    level: "low",
    title: "Running low — please refill soon",
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
      {groups.map(({ level, title, box, icon: Icon, meds: list }) => (
        <div key={level} role="alert" className={`flex gap-3 rounded-xl border-2 p-4 ${box}`}>
          <Icon className="mt-1 h-8 w-8 shrink-0" />
          <div>
            <p className="text-xl font-bold">{title}</p>
            <ul className="mt-1 text-lg">
              {list.map((m) => (
                <li key={m.id}>
                  <b>{m.name}</b>: about {daysOfStockLeft(m)} day(s) left ({doseText(Number(m.stock), m.form ?? "tablet")} left)
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
