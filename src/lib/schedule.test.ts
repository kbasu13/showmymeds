import { describe, it, expect } from "vitest";
import { isLowStock, daysOfStockLeft, adherenceByDay, buildIcs, type Med } from "./schedule";

const med = (o: Partial<Med> = {}): Med => ({
  id: "m1", name: "Aspirin", times: ["08:00", "20:00"], start_date: "2026-01-01",
  end_date: null, stock: 20, dose_qty: 1, ...o,
});

describe("stock rules", () => {
  it("flags stock below a 7-day buffer", () => {
    expect(daysOfStockLeft(med({ stock: 13 }))).toBe(6);
    expect(isLowStock(med({ stock: 13 }), "2026-02-01")).toBe(true);
    expect(isLowStock(med({ stock: 14 }), "2026-02-01")).toBe(false);
  });
});

describe("adherence", () => {
  it("computes percentage of scheduled doses taken", () => {
    const r = adherenceByDay([med()], [
      { medicine_id: "m1", scheduled_date: "2026-02-01", scheduled_time: "08:00", taken_at: "" },
    ], ["2026-02-01"]);
    expect(r[0].pct).toBe(50);
  });
});

describe("calendar export", () => {
  it("is limited by available stock", () => {
    const ics = buildIcs([med({ stock: 5 })], new Date(2026, 1, 1, 0, 0));
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(5);
  });
});
