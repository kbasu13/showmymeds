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
    expect(r[0]!.pct).toBe(50);
  });
});

describe("calendar export", () => {
  it("is limited by available stock", () => {
    const ics = buildIcs([med({ stock: 5 })], new Date(2026, 1, 1, 0, 0));
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(5);
  });
});
import { time12, doseText, dmyDay } from "./schedule";
test("times show in AM/PM", () => { expect(time12("08:00")).toBe("8:00 AM"); expect(time12("20:30")).toBe("8:30 PM"); expect(time12("00:15")).toBe("12:15 AM"); });
test("dose shows full unit", () => { expect(doseText(1, "tablet")).toBe("1 tablet"); expect(doseText(2, "capsule")).toBe("2 capsules"); expect(doseText(5, "syrup")).toBe("5 ml"); });
test("start date as dd-mm-yyyy, day", () => expect(dmyDay("2026-11-01")).toBe("01-11-2026, Sun"));

import { joinTimes, shortDay } from "./schedule";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("joinTimes", () => {
  i2("uses 'and' before the last time", () => {
    e2(joinTimes(["22:00", "08:00"])).toBe("8:00 AM and 10:00 PM");
    e2(joinTimes(["08:00", "14:00", "22:00"])).toBe("8:00 AM, 2:00 PM and 10:00 PM");
  });
  i2("formats short day", () => e2(shortDay("2026-11-03")).toBe("Tue, Nov 3"));
});
