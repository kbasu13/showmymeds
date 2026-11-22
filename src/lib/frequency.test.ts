import { describe, it, expect } from "vitest";
import { isDueOn, daysOfStockLeft } from "./schedule";
import { askAllowanceState } from "./ask-usage";

const base = { start_date: "2026-11-01", end_date: null };
describe("dose frequency", () => {
  it("every 2nd day skips the day after start", () => {
    const m = { ...base, repeat_every: 2, week_days: null };
    expect(isDueOn(m, "2026-11-01")).toBe(true);
    expect(isDueOn(m, "2026-11-02")).toBe(false);
    expect(isDueOn(m, "2026-11-03")).toBe(true);
  });
  it("every 3rd day", () => {
    const m = { ...base, repeat_every: 3, week_days: null };
    expect(isDueOn(m, "2026-11-04")).toBe(true);
    expect(isDueOn(m, "2026-11-03")).toBe(false);
  });
  it("once a week on Sunday only", () => {
    const m = { ...base, repeat_every: 1, week_days: [0] };
    expect(isDueOn(m, "2026-11-08")).toBe(true); // Sunday
    expect(isDueOn(m, "2026-11-09")).toBe(false);
  });
  it("weekly stock lasts 7x longer", () => {
    expect(daysOfStockLeft({ times: ["08:00"], dose_qty: 1, stock: 4, repeat_every: 1, week_days: [0] })).toBe(28);
  });
});
describe("ask allowance", () => {
  it("warns at 80 and blocks at 100", () => {
    expect(askAllowanceState(79)).toBe("ok");
    expect(askAllowanceState(80)).toBe("warn");
    expect(askAllowanceState(100)).toBe("blocked");
  });
});
